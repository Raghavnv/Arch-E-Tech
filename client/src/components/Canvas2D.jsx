import { useEffect, useRef, useState } from 'react';
import { fabric } from 'fabric';
import { Ruler, Maximize2, Compass, Layers, Check, X, ShieldAlert } from 'lucide-react';
import { installSymbol, drawRoomLabel } from '../utils/planSymbols';

/**
 * Metric to Imperial formatter (e.g. 4.5m -> 14' 9")
 */
function formatMetersToFeet(meters) {
  const totalInches = Math.round(meters * 39.3701);
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return `${feet}' ${inches}"`;
}

/**
 * Provides human-readable real-world 3D architectural specs based on 2D drawing length
 */
function get3DSpecs(type, lengthMeters) {
  const len = Math.max(0.1, lengthMeters);
  switch (type) {
    case 'wall':
      return {
        label: 'Wall',
        icon: '🧱',
        height3D: '3.00 m (9\' 10")',
        thickness3D: '0.20 m (8")',
        desc: `3D: ${len.toFixed(2)}m (L) × 0.20m (T) × 3.0m (H)`
      };
    case 'door':
      return {
        label: 'Door Opening',
        icon: '🚪',
        height3D: '2.20 m (7\' 3")',
        thickness3D: '0.10 m (4")',
        desc: `3D Opening: ${len.toFixed(2)}m (W) × 2.20m (H)`
      };
    case 'window':
      return {
        label: 'Window Pane',
        icon: '🪟',
        height3D: '1.30 m (4\' 3")',
        sill3D: '0.90 m (3\' 0")',
        desc: `3D Glazing: ${len.toFixed(2)}m (W) × 1.30m (H) [Sill 0.9m]`
      };
    case 'stairs':
      return {
        label: 'Architectural Stairs',
        icon: '🪜',
        height3D: '3.00 m Story Rise',
        desc: `3D Staircase: ${len.toFixed(2)}m Run → 3.0m Rise (14 Treads)`
      };
    case 'furniture_bed':
      return {
        label: 'King Bed',
        icon: '🛏️',
        height3D: '0.60 m',
        desc: '3D: 2.0m (L) × 1.6m (W) × 0.6m (H)'
      };
    case 'furniture_sofa':
      return {
        label: 'Lounge Sofa',
        icon: '🛋️',
        height3D: '0.85 m',
        desc: '3D: 2.0m (L) × 0.9m (W) × 0.85m (H)'
      };
    case 'furniture_table':
      return {
        label: 'Dining Table',
        icon: '🪑',
        height3D: '0.75 m',
        desc: '3D: 1.6m (L) × 0.9m (W) × 0.75m (H)'
      };
    default:
      return {
        label: type,
        icon: '📐',
        height3D: '3.00 m',
        desc: `3D: ${len.toFixed(2)}m length`
      };
  }
}

export default function Canvas2D({ elements, drawingMode, setCanvasElements, blueprintMode, activeTab }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const lastPosX = useRef(0);
  const lastPosY = useRef(0);
  const currentLine = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const hasLoadedElements = useRef(false);
  // true while elements are being swapped in programmatically, so removals don't write a half-empty list back
  const reloadingRef = useRef(false);

  // Sync ref to prevent stale closures and ghost drawing
  const drawingModeRef = useRef(drawingMode);
  drawingModeRef.current = drawingMode;

  // Real-time HUD states
  const [drawingHUD, setDrawingHUD] = useState(null);
  const [selectedHUD, setSelectedHUD] = useState(null);

  // Recalculate canvas offset and rerender when tab activates
  useEffect(() => {
    if (activeTab === '2D' && fabricRef.current) {
      fabricRef.current.calcOffset();
      fabricRef.current.requestRenderAll();
    } else if (activeTab !== '2D') {
      setDrawingHUD(null);
      setSelectedHUD(null);
    }
  }, [activeTab]);

  // Update Background and Styles on blueprintMode change
  useEffect(() => {
    if (fabricRef.current) {
      const canvas = fabricRef.current;
      canvas.backgroundColor = blueprintMode ? '#1e3a8a' : '#09090b';
      canvas.__blueprint = blueprintMode;

      canvas.getObjects().forEach(obj => {
        if (obj.isGrid) {
          obj.set('stroke', blueprintMode ? '#3b82f6' : '#18181b');
          obj.set('opacity', blueprintMode ? 0.3 : 1);
        } else if (obj.type === 'wall') {
          obj.set('fill', blueprintMode ? 'transparent' : '#e4e4e7');
          obj.set('stroke', blueprintMode ? '#ffffff' : '#e4e4e7');
          obj.set('strokeWidth', blueprintMode ? 2 : 1);
        } else if (obj.type === 'door') {
          obj.set('fill', blueprintMode ? 'transparent' : '#facc15');
          obj.set('stroke', blueprintMode ? '#facc15' : '#facc15');
          obj.set('strokeWidth', blueprintMode ? 2 : 1);
        } else if (obj.type === 'window') {
          obj.set('fill', blueprintMode ? 'transparent' : '#60a5fa');
          obj.set('stroke', blueprintMode ? '#60a5fa' : '#60a5fa');
          obj.set('strokeWidth', blueprintMode ? 2 : 1);
        } else if (obj.type === 'stairs') {
          obj.set('fill', blueprintMode ? 'transparent' : '#c084fc');
          obj.set('stroke', blueprintMode ? '#c084fc' : '#c084fc');
          obj.set('strokeWidth', blueprintMode ? 2 : 1);
        }
      });

      canvas.renderAll();
    }
  }, [blueprintMode, elements]);

  // Sync elements to parent state
  const syncElements = () => {
    if (!fabricRef.current || reloadingRef.current) return;
    const canvas = fabricRef.current;
    const currentElements = canvas.getObjects().filter(obj => !obj.isGrid).map(obj => ({
      id: obj.id || Math.random().toString(36).substr(2, 9),
      type: obj.type,
      left: obj.left,
      top: obj.top,
      width: obj.width * (obj.scaleX || 1),
      height: obj.height * (obj.scaleY || 1),
      angle: obj.angle,
      material: obj.material || null,
      isColor: obj.isColor || false,
      fill: obj.fill || null,
      ...(obj.swing != null ? { swing: obj.swing, hinge: obj.hinge } : {}),
      ...(obj.type === 'room' ? { kind: obj.kind, name: obj.name, area: obj.area } : {}),
    }));
    setCanvasElements(currentElements);
  };

  // Helper to calculate HUD position for selected object
  const updateSelectedHUD = () => {
    if (!fabricRef.current || drawingModeRef.current) {
      setSelectedHUD(null);
      return;
    }
    const canvas = fabricRef.current;
    const activeObj = canvas.getActiveObject();
    if (!activeObj || activeObj.isGrid) {
      setSelectedHUD(null);
      return;
    }

    const widthPx = (activeObj.width || 0) * (activeObj.scaleX || 1);
    const heightPx = (activeObj.height || 0) * (activeObj.scaleY || 1);
    const lengthMeters = widthPx * 0.05;
    const thicknessMeters = heightPx * 0.05;
    const angle = Math.round(activeObj.angle || 0) % 360;

    // Get screen coordinates using bounding rect and viewport transform
    const bound = activeObj.getBoundingRect(true, true);
    const vpt = canvas.viewportTransform;
    const screenX = bound.left * vpt[0] + vpt[4] + (bound.width * vpt[0]) / 2;
    const screenY = bound.top * vpt[3] + vpt[5];

    setSelectedHUD({
      id: activeObj.id,
      type: activeObj.type || 'element',
      lengthMeters,
      lengthFeet: formatMetersToFeet(lengthMeters),
      thicknessMeters,
      angle: (angle + 360) % 360,
      screenX,
      screenY: Math.max(30, screenY - 50),
      specs: get3DSpecs(activeObj.type || 'wall', lengthMeters)
    });
  };

  // Main Canvas Setup & Persistent Event Listener Registration
  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric canvas
    fabricRef.current = new fabric.Canvas(canvasRef.current, {
      width: window.innerWidth - 320,
      height: window.innerHeight,
      backgroundColor: blueprintMode ? '#1e3a8a' : '#09090b',
      selectionColor: 'rgba(255,255,255,0.08)',
      selectionBorderColor: 'rgba(255,255,255,0.25)',
      selectionLineWidth: 1,
      fireRightClick: true,
      stopContextMenu: true,
    });

    const canvas = fabricRef.current;

    // Grid background: 40px grid (each cell is 2.0m x 2.0m in 3D)
    const gridSize = 40;
    for (let i = -50; i < 100; i++) {
      canvas.add(new fabric.Line([i * gridSize, -2000, i * gridSize, 4000], {
        stroke: '#18181b', selectable: false, evented: false, isGrid: true
      }));
    }
    for (let i = -50; i < 100; i++) {
      canvas.add(new fabric.Line([-2000, i * gridSize, 4000, i * gridSize], {
        stroke: '#18181b', selectable: false, evented: false, isGrid: true
      }));
    }

    const handleResize = () => {
      canvas.setWidth(window.innerWidth - 320);
      canvas.setHeight(window.innerHeight);
      canvas.renderAll();
      updateSelectedHUD();
    };

    // room names sit on top of everything, so furniture never hides them
    canvas.on('after:render', () => {
      const ctx = canvas.getContext();
      const v = canvas.viewportTransform;
      ctx.save();
      ctx.transform(v[0], v[1], v[2], v[3], v[4], v[5]);
      canvas.getObjects().forEach((o) => {
        if (o.type === 'room') drawRoomLabel(ctx, o, !!canvas.__blueprint);
      });
      ctx.restore();
    });

    canvas.on('object:modified', () => {
      syncElements();
      updateSelectedHUD();
    });
    canvas.on('object:removed', () => {
      syncElements();
      setSelectedHUD(null);
    });
    canvas.on('selection:created', updateSelectedHUD);
    canvas.on('selection:updated', updateSelectedHUD);
    canvas.on('selection:cleared', () => setSelectedHUD(null));
    canvas.on('object:moving', updateSelectedHUD);
    canvas.on('object:scaling', updateSelectedHUD);
    canvas.on('object:rotating', updateSelectedHUD);

    const handleKeyDown = (e) => {
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
          activeObjects.forEach(obj => {
            if (!obj.isGrid) canvas.remove(obj);
          });
          canvas.discardActiveObject();
          canvas.renderAll();
          syncElements();
          setSelectedHUD(null);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    // Zooming logic
    canvas.on('mouse:wheel', function(opt) {
      const delta = opt.e.deltaY;
      let zoom = canvas.getZoom();
      zoom *= 0.999 ** delta;
      if (zoom > 20) zoom = 20;
      if (zoom < 0.1) zoom = 0.1;
      canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
      opt.e.preventDefault();
      opt.e.stopPropagation();
      updateSelectedHUD();
    });

    // Panning & Drawing: Unified MOUSE:DOWN
    canvas.on('mouse:down', function(opt) {
      // 1. Pan logic (Alt + Drag or Middle/Right click)
      if (opt.e.altKey || opt.button === 2 || opt.button === 3) {
        isPanning.current = true;
        canvas.selection = false;
        lastPosX.current = opt.e.clientX;
        lastPosY.current = opt.e.clientY;
        return;
      }

      // 2. DRAWING LOGIC: If no drawing tool is selected, EXIT IMMEDIATELY!
      // This strictly prevents the normal cursor from drawing stray walls/lines.
      const currentMode = drawingModeRef.current;
      if (!currentMode) return;

      isDrawing.current = true;
      const pointer = canvas.getPointer(opt.e);
      startPos.current = { x: pointer.x, y: pointer.y };

      let strokeColor = '#e4e4e7';
      let strokeWidth = 8;

      if (currentMode === 'wall') { strokeColor = '#e4e4e7'; strokeWidth = 8; }
      else if (currentMode === 'door') { strokeColor = '#facc15'; strokeWidth = 5; }
      else if (currentMode === 'window') { strokeColor = '#60a5fa'; strokeWidth = 5; }
      else if (currentMode === 'stairs') { strokeColor = '#c084fc'; strokeWidth = 18; }

      currentLine.current = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 0,
        height: strokeWidth,
        fill: strokeColor,
        originX: 'left',
        originY: 'center',
        selectable: false,
        evented: false,
        type: currentMode,
        cornerColor: '#ffffff',
        borderColor: '#ffffff',
        transparentCorners: false,
        cornerSize: 8,
      });

      installSymbol(currentLine.current);
      canvas.add(currentLine.current);
    });

    // Panning & Drawing: Unified MOUSE:MOVE
    canvas.on('mouse:move', function(opt) {
      // 1. Handle Panning
      if (isPanning.current) {
        const e = opt.e;
        const vpt = canvas.viewportTransform;
        vpt[4] += e.clientX - lastPosX.current;
        vpt[5] += e.clientY - lastPosY.current;
        canvas.requestRenderAll();
        lastPosX.current = e.clientX;
        lastPosY.current = e.clientY;
        updateSelectedHUD();
        return;
      }

      // 2. Handle Drawing
      if (!isDrawing.current || !currentLine.current || !drawingModeRef.current) return;
      const currentMode = drawingModeRef.current;
      const pointer = canvas.getPointer(opt.e);

      const dx = pointer.x - startPos.current.x;
      const dy = pointer.y - startPos.current.y;

      let length = Math.sqrt(dx * dx + dy * dy);
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;

      // Smart Snapping (Shift key or proximity to 45 degree angles)
      const snapThreshold = 6; // degrees
      const snappedAngle = Math.round(angle / 45) * 45;
      const isSnapped = Math.abs(angle - snappedAngle) < snapThreshold || opt.e.shiftKey;

      if (isSnapped) {
        angle = snappedAngle;
        const rad = angle * Math.PI / 180;
        const dot = (dx * Math.cos(rad) + dy * Math.sin(rad));
        length = Math.max(0, dot);
      }

      currentLine.current.set({
        width: length,
        angle: angle
      });

      canvas.requestRenderAll();

      // Real-time Dimension Calculations (1 px = 0.05 m)
      const lengthMeters = length * 0.05;
      const lengthFeet = formatMetersToFeet(lengthMeters);
      const normAngle = ((Math.round(angle) % 360) + 360) % 360;
      const specs = get3DSpecs(currentMode, lengthMeters);

      // Get container-relative screen coordinates
      const containerRect = containerRef.current?.getBoundingClientRect();
      const screenX = containerRect ? opt.e.clientX - containerRect.left : opt.e.clientX;
      const screenY = containerRect ? opt.e.clientY - containerRect.top : opt.e.clientY;

      setDrawingHUD({
        screenX,
        screenY,
        lengthMeters,
        lengthFeet,
        angle: normAngle,
        isSnapped,
        tool: currentMode,
        specs
      });
    });

    // Panning & Drawing: Unified MOUSE:UP
    canvas.on('mouse:up', function(opt) {
      if (isPanning.current) {
        canvas.setViewportTransform(canvas.viewportTransform);
        isPanning.current = false;
        if (!drawingModeRef.current) canvas.selection = true;
      }

      if (!isDrawing.current) return;
      isDrawing.current = false;
      setDrawingHUD(null);

      if (!currentLine.current) return;

      // BUG FIX: Clean up and discard accidental micro-drags or single clicks.
      // Lines under 18px (less than ~0.9m) are discarded to completely eliminate stray dots and random tiny lines!
      if (currentLine.current.width < 18) {
        canvas.remove(currentLine.current);
        currentLine.current = null;
        canvas.requestRenderAll();
        return;
      }

      currentLine.current.setCoords();
      currentLine.current = null;
      syncElements();
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.dispose();
    };
  }, []);

  // Update Canvas Configuration when drawingMode toggles
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    if (!drawingMode) {
      // Normal Pointer Mode
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';

      // Cancel any active drawing line if drawing mode was shut off mid-drag
      if (isDrawing.current && currentLine.current) {
        canvas.remove(currentLine.current);
        currentLine.current = null;
      }
      isDrawing.current = false;
      setDrawingHUD(null);

      canvas.getObjects().forEach(o => {
        if (!o.isGrid) {
          o.set('selectable', true);
          o.set('evented', true);
        }
      });
      canvas.requestRenderAll();
    } else {
      // Active Tool Mode (Wall / Door / Window / Stairs)
      canvas.discardActiveObject();
      canvas.selection = false;
      canvas.defaultCursor = 'crosshair';
      canvas.hoverCursor = 'crosshair';
      setSelectedHUD(null);

      canvas.getObjects().forEach(o => {
        if (!o.isGrid) {
          o.set('selectable', false);
          o.set('evented', false);
        }
      });
      canvas.requestRenderAll();
    }
  }, [drawingMode]);

  // Synchronize incoming elements (e.g. from DB, AI, or storage) into Fabric canvas
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !elements) return;

    const existingObjs = canvas.getObjects().filter(o => !o.isGrid);

    // If canvas already has these elements, check for property updates without full redraw
    if (existingObjs.length > 0 && elements.length === existingObjs.length) {
      let needsRerender = false;
      elements.forEach(el => {
        const match = existingObjs.find(o => o.id === el.id);
        if (match) {
          if (el.material && match.material !== el.material) {
            match.material = el.material;
            if (el.isColor) match.set('fill', el.material);
            needsRerender = true;
          }
        }
      });
      if (needsRerender) {
        canvas.renderAll();
      }
      return;
    }

    if (elements.length > 0) {
      reloadingRef.current = true;
      existingObjs.forEach(o => canvas.remove(o));

      elements.forEach(el => {
        let strokeColor = '#ffffff';
        if (el.type === 'wall') strokeColor = '#e4e4e7';
        else if (el.type === 'door') strokeColor = '#facc15';
        else if (el.type === 'window') strokeColor = '#60a5fa';
        else if (el.type === 'stairs') strokeColor = '#c084fc';
        else if (el.type === 'furniture_bed') strokeColor = '#cbd5e1';
        else if (el.type === 'furniture_sofa') strokeColor = '#818cf8';
        else if (el.type === 'furniture_table') strokeColor = '#fbbf24';

        const isRoom = el.type === 'room';
        const rect = new fabric.Rect({
          id: el.id || Math.random().toString(36).substr(2, 9),
          left: el.left,
          top: el.top,
          width: el.width,
          height: el.height,
          angle: el.angle || 0,
          fill: (el.isColor && el.material) ? el.material : (el.fill || strokeColor),
          originX: 'left',
          originY: 'center',
          selectable: !isRoom && !drawingModeRef.current,
          evented: !isRoom && !drawingModeRef.current,
          type: el.type,
          swing: el.swing,
          hinge: el.hinge,
          kind: el.kind,
          name: el.name,
          area: el.area,
          material: el.material || null,
          isColor: el.isColor || false,
          cornerColor: '#ffffff',
          borderColor: '#ffffff',
          transparentCorners: false,
          cornerSize: 8,
        });
        installSymbol(rect);
        canvas.add(rect);
      });
      canvas.renderAll();
      reloadingRef.current = false;
      hasLoadedElements.current = true;
    } else if (elements.length === 0 && existingObjs.length > 0) {
      reloadingRef.current = true;
      existingObjs.forEach(o => canvas.remove(o));
      reloadingRef.current = false;
      canvas.renderAll();
    }
  }, [elements]);

  // Handle Dynamic Addition of Furniture
  useEffect(() => {
    const handleAddFurniture = (e) => {
      const type = e.detail;
      const canvas = fabricRef.current;
      if (!canvas) return;

      let width, height, fill;
      if (type === 'furniture_bed') { width = 120; height = 160; fill = '#cbd5e1'; }
      else if (type === 'furniture_sofa') { width = 160; height = 70; fill = '#818cf8'; }
      else if (type === 'furniture_table') { width = 140; height = 90; fill = '#fbbf24'; }

      const rect = new fabric.Rect({
        id: Math.random().toString(36).substr(2, 9),
        left: canvas.width / 2 - width / 2,
        top: canvas.height / 2 - height / 2,
        width, height, fill,
        type: type,
        originX: 'left',
        originY: 'center',
        selectable: true,
        evented: true,
        cornerColor: '#ffffff',
        borderColor: '#ffffff',
        transparentCorners: false,
        cornerSize: 8,
      });

      installSymbol(rect);
      canvas.add(rect);
      canvas.setActiveObject(rect);
      canvas.renderAll();
      syncElements();
    };

    window.addEventListener('add-furniture', handleAddFurniture);
    return () => window.removeEventListener('add-furniture', handleAddFurniture);
  }, []);

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 overflow-hidden bg-zinc-950 ${drawingMode ? 'cursor-crosshair' : 'cursor-default'}`}
    >
      <canvas ref={canvasRef} />

      {/* ========================================================================= */}
      {/* 1. REAL-TIME LIVE 2D-TO-3D MEASUREMENT HUD WHILE DRAWING                  */}
      {/* ========================================================================= */}
      {drawingHUD && (
        <div
          className="pointer-events-none fixed z-50 transition-transform duration-75 ease-out select-none"
          style={{
            left: `${Math.min(window.innerWidth - 340, Math.max(16, drawingHUD.screenX + 24))}px`,
            top: `${Math.min(window.innerHeight - 150, Math.max(20, drawingHUD.screenY - 80))}px`,
          }}
        >
          <div className="bg-zinc-950/95 backdrop-blur-md border border-zinc-700/80 rounded-xl p-3 shadow-2xl flex flex-col gap-1.5 min-w-[240px] text-zinc-100">
            {/* Header: Tool icon & Name */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-1.5">
              <span className="flex items-center gap-1.5 text-xs font-bold text-zinc-200 tracking-wide uppercase">
                <span>{drawingHUD.specs.icon}</span>
                <span>{drawingHUD.specs.label}</span>
              </span>
              {drawingHUD.isSnapped ? (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  ✓ {drawingHUD.angle}° SNAP
                </span>
              ) : (
                <span className="text-[10px] font-mono text-zinc-400">
                  {drawingHUD.angle}°
                </span>
              )}
            </div>

            {/* Main Length: Metric + Imperial */}
            <div className="flex items-baseline gap-2 pt-0.5">
              <span className="text-xl font-mono font-bold text-white tracking-tight">
                {drawingHUD.lengthMeters.toFixed(2)} m
              </span>
              <span className="text-xs font-mono text-zinc-400">
                ({drawingHUD.lengthFeet})
              </span>
            </div>

            {/* 3D Real-World Height & Depth Callout */}
            <div className="bg-zinc-900/90 rounded-lg px-2 py-1.5 border border-zinc-800/80 flex items-center justify-between text-[11px]">
              <span className="text-emerald-400 font-medium">
                {drawingHUD.specs.desc}
              </span>
            </div>
            
            <div className="text-[10px] text-zinc-500 flex items-center justify-between px-0.5">
              <span>Hold Shift to lock 45°</span>
              <span>1m = 20px</span>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. SELECTED ELEMENT ARCHITECTURAL DIMENSION CALLOUT                       */}
      {/* ========================================================================= */}
      {selectedHUD && !drawingMode && (
        <div
          className="pointer-events-none absolute z-40 select-none -translate-x-1/2 -translate-y-full mb-3"
          style={{
            left: `${selectedHUD.screenX}px`,
            top: `${selectedHUD.screenY}px`,
          }}
        >
          <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700/80 rounded-lg px-3 py-1.5 shadow-xl flex items-center gap-2.5 text-xs text-zinc-200 whitespace-nowrap">
            <span className="flex items-center gap-1 font-semibold text-zinc-100">
              <span>{selectedHUD.specs.icon}</span>
              <span className="capitalize">{selectedHUD.specs.label}</span>
            </span>
            <span className="text-zinc-600">|</span>
            <span className="font-mono font-bold text-white">
              {selectedHUD.lengthMeters.toFixed(2)} m
            </span>
            <span className="text-zinc-400 font-mono text-[11px]">
              ({selectedHUD.lengthFeet})
            </span>
            <span className="text-zinc-600">|</span>
            <span className="text-[11px] text-emerald-400 font-medium">
              3D H: {selectedHUD.specs.height3D || '3.0m'}
            </span>
            {selectedHUD.angle !== 0 && (
              <>
                <span className="text-zinc-600">|</span>
                <span className="text-[10px] font-mono text-zinc-400">{selectedHUD.angle}°</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. ARCHITECTURAL DRAFTING SCALE BAR & LEGEND                              */}
      {/* ========================================================================= */}
      <div className="absolute bottom-6 left-6 z-30 pointer-events-none flex flex-col gap-2">
        <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 shadow-xl flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-zinc-400" />
            <div className="flex flex-col">
              <span className="font-semibold text-zinc-200 text-[11px]">ARCHITECTURAL SCALE</span>
              <span className="text-[10px] text-zinc-400 font-mono">1m = 20px (1:50) • Grid 2m × 2m</span>
            </div>
          </div>
          {/* Visual scale ruler */}
          <div className="flex flex-col items-center gap-0.5">
            <div className="w-[40px] h-1.5 bg-zinc-700 border-x border-zinc-400 relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-full bg-zinc-400"></div>
            </div>
            <span className="text-[9px] font-mono text-zinc-400">2.0 m</span>
          </div>
        </div>
      </div>
    </div>
  );
}
