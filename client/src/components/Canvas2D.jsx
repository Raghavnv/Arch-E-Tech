import { useEffect, useRef } from 'react';
import { fabric } from 'fabric';

export default function Canvas2D({ drawingMode }) {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);
  const isDrawing = useRef(false);
  const currentLine = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // Initialize Fabric canvas with dark theme
    fabricRef.current = new fabric.Canvas(canvasRef.current, {
      width: window.innerWidth - 320, // Subtract sidebar width
      height: window.innerHeight,
      backgroundColor: '#09090b', // zinc-950
      selectionColor: 'rgba(255,255,255,0.1)',
      selectionBorderColor: 'rgba(255,255,255,0.3)',
      selectionLineWidth: 1,
    });

    const canvas = fabricRef.current;

    // Grid background pattern
    const gridSize = 40;
    for (let i = 0; i < (window.innerWidth / gridSize); i++) {
      canvas.add(new fabric.Line([ i * gridSize, 0, i * gridSize, window.innerHeight], { 
        stroke: '#18181b', // zinc-900
        selectable: false,
        evented: false,
        isGrid: true
      }));
    }
    for (let i = 0; i < (window.innerHeight / gridSize); i++) {
      canvas.add(new fabric.Line([ 0, i * gridSize, window.innerWidth, i * gridSize], { 
        stroke: '#18181b', // zinc-900
        selectable: false,
        evented: false,
        isGrid: true
      }));
    }

    // Handle window resize
    const handleResize = () => {
      canvas.setWidth(window.innerWidth - 320);
      canvas.setHeight(window.innerHeight);
      canvas.renderAll();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      canvas.dispose();
    };
  }, []); // Run once on mount

  // Handle Drawing Mode Changes
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    // Remove old event listeners
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

    // Setup for drawing
    canvas.selection = false;
    canvas.defaultCursor = 'crosshair';
    canvas.getObjects().forEach(o => {
      o.set('selectable', false);
      o.set('evented', false);
    });

    canvas.on('mouse:down', function(o) {
      isDrawing.current = true;
      const pointer = canvas.getPointer(o.e);
      const points = [pointer.x, pointer.y, pointer.x, pointer.y];
      
      let strokeColor = '#ffffff';
      let strokeWidth = 4;
      
      if (drawingMode === 'wall') {
        strokeColor = '#e4e4e7'; // zinc-200
        strokeWidth = 6;
      } else if (drawingMode === 'door') {
        strokeColor = '#facc15'; // yellow-400
        strokeWidth = 4;
      } else if (drawingMode === 'window') {
        strokeColor = '#60a5fa'; // blue-400
        strokeWidth = 4;
      } else if (drawingMode === 'stairs') {
        strokeColor = '#c084fc'; // purple-400
        strokeWidth = 4;
      }

      currentLine.current = new fabric.Line(points, {
        strokeWidth: strokeWidth,
        fill: strokeColor,
        stroke: strokeColor,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        type: drawingMode
      });
      canvas.add(currentLine.current);
    });

    canvas.on('mouse:move', function(o) {
      if (!isDrawing.current || !currentLine.current) return;
      const pointer = canvas.getPointer(o.e);
      currentLine.current.set({ x2: pointer.x, y2: pointer.y });
      canvas.renderAll();
    });

    canvas.on('mouse:up', function(o) {
      isDrawing.current = false;
      currentLine.current.setCoords();
      currentLine.current = null;
    });

  }, [drawingMode]);

  return (
    <div className={`w-full h-full overflow-hidden bg-zinc-950 ${drawingMode ? 'cursor-crosshair' : 'cursor-default'}`}>
      <canvas ref={canvasRef} />
    </div>
  );
}
