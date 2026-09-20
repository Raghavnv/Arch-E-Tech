import { useEffect, useRef } from 'react';
import { fabric } from 'fabric';

export default function Canvas2D() {
  const canvasRef = useRef(null);
  const fabricRef = useRef(null);

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
        evented: false
      }));
    }
    for (let i = 0; i < (window.innerHeight / gridSize); i++) {
      canvas.add(new fabric.Line([ 0, i * gridSize, window.innerWidth, i * gridSize], { 
        stroke: '#18181b', // zinc-900
        selectable: false,
        evented: false
      }));
    }

    // Draw a dark themed test wall
    const wall = new fabric.Rect({
      left: 200,
      top: 160,
      fill: '#27272a', // zinc-800
      stroke: '#52525b', // zinc-500
      strokeWidth: 2,
      width: 400,
      height: 20,
      selectable: true,
      hasControls: true,
      cornerColor: '#ffffff',
      cornerStrokeColor: '#ffffff',
      borderColor: '#ffffff',
      transparentCorners: false,
      cornerSize: 8,
    });

    canvas.add(wall);
    canvas.setActiveObject(wall);

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
  }, []);

  return (
    <div className="w-full h-full overflow-hidden bg-zinc-950 cursor-crosshair">
      <canvas ref={canvasRef} />
    </div>
  );
}
