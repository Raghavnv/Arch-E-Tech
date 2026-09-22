import { useEffect, useRef } from 'react';
import { fabric } from 'fabric';

export default function Canvas2D({ elements, drawingMode, setCanvasElements }) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawing = useRef(false);
  const isPanning = useRef(false);
  const lastPosX = useRef(0);
  const lastPosY = useRef(0);
  const currentLine = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const hasLoadedElements = useRef(false);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric canvas
    fabricRef.current = new fabric.Canvas(canvasRef.current, {
      width: window.innerWidth - 320,
      height: window.innerHeight,
      backgroundColor: '#09090b',
      selectionColor: 'rgba(255,255,255,0.1)',
      selectionBorderColor: 'rgba(255,255,255,0.3)',
      selectionLineWidth: 1,
      fireRightClick: true,
      stopContextMenu: true,
    });

    const canvas = fabricRef.current;

    // Grid background
    const gridSize = 40;
    // We create a large grid to allow for panning
    for (let i = -50; i < 100; i++) {
      canvas.add(new fabric.Line([ i * gridSize, -2000, i * gridSize, 4000], { 
        stroke: '#18181b', selectable: false, evented: false, isGrid: true 
      }));
    }
    for (let i = -50; i < 100; i++) {
      canvas.add(new fabric.Line([ -2000, i * gridSize, 4000, i * gridSize], { 
        stroke: '#18181b', selectable: false, evented: false, isGrid: true 
      }));
    }

    const handleResize = () => {
      canvas.setWidth(window.innerWidth - 320);
      canvas.setHeight(window.innerHeight);
      canvas.renderAll();
    };

    const syncElements = () => {
      const currentElements = canvas.getObjects().filter(obj => !obj.isGrid).map(obj => ({
        id: obj.id || Math.random().toString(36).substr(2, 9), // Keep ID for material mapping
        type: obj.type,
        left: obj.left,
        top: obj.top,
        width: obj.width * (obj.scaleX || 1),
        height: obj.height * (obj.scaleY || 1),
        angle: obj.angle,
        material: obj.material || null
      }));
      setCanvasElements(currentElements);
    };

    canvas.on('object:modified', syncElements);

    const handleKeyDown = (e) => {
      // Handle deletion of selected elements
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
    });

    // Global pan state logic (Alt + Drag or Middle Mouse)
    canvas.on('mouse:down', function(opt) {
      if (opt.e.altKey || opt.button === 2 || opt.button === 3) {
        isPanning.current = true;
        canvas.selection = false;
        lastPosX.current = opt.e.clientX;
        lastPosY.current = opt.e.clientY;
      }
    });

    canvas.on('mouse:move', function(opt) {
      if (isPanning.current) {
        const e = opt.e;
        const vpt = canvas.viewportTransform;
        vpt[4] += e.clientX - lastPosX.current;
        vpt[5] += e.clientY - lastPosY.current;
        canvas.requestRenderAll();
        lastPosX.current = e.clientX;
        lastPosY.current = e.clientY;
      }
    });

    canvas.on('mouse:up', function(opt) {
      if (isPanning.current) {
        canvas.setViewportTransform(canvas.viewportTransform);
        isPanning.current = false;
        if (!drawingMode) canvas.selection = true;
      }
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.dispose();
    };
  }, [setCanvasElements]);

  // Synchronize incoming elements (e.g. from DB or AI) into Fabric once
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas || !elements || elements.length === 0 || hasLoadedElements.current) return;

    elements.forEach(el => {
      let strokeColor = '#ffffff';
      if (el.type === 'wall') strokeColor = '#e4e4e7';
      else if (el.type === 'door') strokeColor = '#facc15';
      else if (el.type === 'window') strokeColor = '#60a5fa';
      else if (el.type === 'stairs') strokeColor = '#c084fc';

      const rect = new fabric.Rect({
        id: el.id || Math.random().toString(36).substr(2, 9),
        left: el.left,
        top: el.top,
        width: el.width,
        height: el.height,
        angle: el.angle,
        fill: strokeColor,
        originX: 'left',
        originY: 'center',
        selectable: true,
        evented: true,
        type: el.type,
        material: el.material || null,
        cornerColor: '#ffffff',
        borderColor: '#ffffff',
        transparentCorners: false,
        cornerSize: 8,
      });
      canvas.add(rect);
    });
    canvas.renderAll();
    hasLoadedElements.current = true;
  }, [elements]);

  // Handle Drawing Mode Changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // We keep wheel, but override down/move/up for drawing
    const handleMouseDown = function(o) {
      if (o.e.altKey || o.button === 2 || o.button === 3) return; // Ignore if panning
      if (!drawingMode) return;

      isDrawing.current = true;
      const pointer = canvas.getPointer(o.e);
      startPos.current = { x: pointer.x, y: pointer.y };
      
      let strokeColor = '#ffffff';
      let strokeWidth = 6;
      
      if (drawingMode === 'wall') { strokeColor = '#e4e4e7'; strokeWidth = 8; } 
      else if (drawingMode === 'door') { strokeColor = '#facc15'; strokeWidth = 4; } 
      else if (drawingMode === 'window') { strokeColor = '#60a5fa'; strokeWidth = 4; } 
      else if (drawingMode === 'stairs') { strokeColor = '#c084fc'; strokeWidth = 4; }

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
        type: drawingMode,
        cornerColor: '#ffffff',
        borderColor: '#ffffff',
        transparentCorners: false,
        cornerSize: 8,
      });
      canvas.add(currentLine.current);
    };

    const handleMouseMove = function(o) {
      if (!isDrawing.current || !currentLine.current) return;
      const pointer = canvas.getPointer(o.e);
      
      let dx = pointer.x - startPos.current.x;
      let dy = pointer.y - startPos.current.y;
      
      let length = Math.sqrt(dx * dx + dy * dy);
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;

      // Smart Snapping (Shift key or proximity to 45 degree angles)
      // If close to 0, 45, 90, 135, 180, etc...
      const snapThreshold = 5; // degrees
      const snappedAngle = Math.round(angle / 45) * 45;
      
      if (Math.abs(angle - snappedAngle) < snapThreshold || o.e.shiftKey) {
        angle = snappedAngle;
        
        // When snapping, recalculate length based on projection to keep cursor aligned
        const rad = angle * Math.PI / 180;
        // Project the mouse position onto the snapped vector line
        const dot = (dx * Math.cos(rad) + dy * Math.sin(rad));
        length = Math.abs(dot);
      }

      currentLine.current.set({
        width: length,
        angle: angle
      });
      
      canvas.renderAll();
    };

    const handleMouseUp = function(o) {
      if (!currentLine.current) return;
      if (currentLine.current.width < 5) {
        canvas.remove(currentLine.current);
      } else {
        currentLine.current.setCoords();
      }
      isDrawing.current = false;
      currentLine.current = null;
      
      // Sync state to parent
      const elements = canvas.getObjects().filter(obj => !obj.isGrid).map(obj => ({
        type: obj.type,
        left: obj.left,
        top: obj.top,
        width: obj.width * (obj.scaleX || 1),
        height: obj.height * (obj.scaleY || 1),
        angle: obj.angle
      }));
      setCanvasElements(elements);
    };

    // First remove old listeners that might conflict
    canvas.off('mouse:down', handleMouseDown);
    canvas.off('mouse:move', handleMouseMove);
    canvas.off('mouse:up', handleMouseUp);
    
    // Clear out any anonymous ones from previous renders (hacky but works for react hot reloads)
    canvas.__eventListeners['mouse:down'] = canvas.__eventListeners['mouse:down']?.filter(fn => !fn.toString().includes('isDrawing'));
    canvas.__eventListeners['mouse:move'] = canvas.__eventListeners['mouse:move']?.filter(fn => !fn.toString().includes('isDrawing'));
    canvas.__eventListeners['mouse:up'] = canvas.__eventListeners['mouse:up']?.filter(fn => !fn.toString().includes('isDrawing'));


    if (!drawingMode) {
      canvas.isDrawingMode = false;
      canvas.selection = true;
      canvas.defaultCursor = 'default';
      canvas.getObjects().forEach(o => {
        if (!o.isGrid) {
          o.set('selectable', true);
          o.set('evented', true);
        }
      });
      return;
    }

    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvas.getObjects().forEach(o => {
      o.set('selectable', false);
      o.set('evented', false);
    });

    canvas.on('mouse:down', handleMouseDown);
    canvas.on('mouse:move', handleMouseMove);
    canvas.on('mouse:up', handleMouseUp);

  }, [drawingMode]);

  return (
    <div className={`absolute inset-0 overflow-hidden bg-zinc-950 ${drawingMode ? 'cursor-crosshair' : 'cursor-default'}`}>
      <canvas ref={canvasRef} />
    </div>
  );
}
