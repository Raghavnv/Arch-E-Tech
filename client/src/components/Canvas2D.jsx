import { useEffect, useRef } from 'react';
import { fabric } from 'fabric';

export default function Canvas2D({ drawingMode }) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawing = useRef(false);
  const currentLine = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });

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
    });

    const canvas = fabricRef.current;

    // Grid background
    const gridSize = 40;
    for (let i = 0; i < (window.innerWidth / gridSize); i++) {
      canvas.add(new fabric.Line([ i * gridSize, 0, i * gridSize, window.innerHeight], { 
        stroke: '#18181b', selectable: false, evented: false, isGrid: true 
      }));
    }
    for (let i = 0; i < (window.innerHeight / gridSize); i++) {
      canvas.add(new fabric.Line([ 0, i * gridSize, window.innerWidth, i * gridSize], { 
        stroke: '#18181b', selectable: false, evented: false, isGrid: true 
      }));
    }

    const handleResize = () => {
      canvas.setWidth(window.innerWidth - 320);
      canvas.setHeight(window.innerHeight);
      canvas.renderAll();
    };

    const handleKeyDown = (e) => {
      // Handle deletion of selected elements
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const activeObjects = canvas.getActiveObjects();
        if (activeObjects.length > 0) {
          // Don't delete if user is typing in an input field somewhere else
          if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
          
          activeObjects.forEach(obj => {
            if (!obj.isGrid) canvas.remove(obj);
          });
          canvas.discardActiveObject();
          canvas.renderAll();
        }
      }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
      canvas.dispose();
    };
  }, []);

  // Handle Drawing Mode Changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    canvas.off('mouse:down');
    canvas.off('mouse:move');
    canvas.off('mouse:up');

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

    canvas.on('mouse:down', function(o) {
      isDrawing.current = true;
      const pointer = canvas.getPointer(o.e);
      startPos.current = { x: pointer.x, y: pointer.y };
      
      let strokeColor = '#ffffff';
      let strokeWidth = 6;
      
      if (drawingMode === 'wall') { strokeColor = '#e4e4e7'; strokeWidth = 8; } 
      else if (drawingMode === 'door') { strokeColor = '#facc15'; strokeWidth = 4; } 
      else if (drawingMode === 'window') { strokeColor = '#60a5fa'; strokeWidth = 4; } 
      else if (drawingMode === 'stairs') { strokeColor = '#c084fc'; strokeWidth = 4; }

      // We use Rect instead of Line to ensure the bounding box tightly hugs the shape even when rotated diagonally
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
    });

    canvas.on('mouse:move', function(o) {
      if (!isDrawing.current || !currentLine.current) return;
      const pointer = canvas.getPointer(o.e);
      
      const dx = pointer.x - startPos.current.x;
      const dy = pointer.y - startPos.current.y;
      
      const length = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx) * 180 / Math.PI;

      currentLine.current.set({
        width: length,
        angle: angle
      });
      
      canvas.renderAll();
    });

    canvas.on('mouse:up', function(o) {
      if (!currentLine.current) return;
      
      // If the line is too short (just a click), remove it to avoid 0-width artifacts
      if (currentLine.current.width < 5) {
        canvas.remove(currentLine.current);
      } else {
        currentLine.current.setCoords();
      }
      
      isDrawing.current = false;
      currentLine.current = null;
    });

  }, [drawingMode]);

  return (
    <div className={`w-full h-full overflow-hidden bg-zinc-950 ${drawingMode ? 'cursor-crosshair' : 'cursor-default'}`}>
      <canvas ref={canvasRef} />
    </div>
  );
}
