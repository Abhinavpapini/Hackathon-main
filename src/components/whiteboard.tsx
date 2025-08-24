'use client';
import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Pencil,
  Eraser,
  Undo,
  Redo,
  Trash2,
  Save,
  Brush as BrushIcon,
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { Slider } from './ui/slider';
import { Label } from './ui/label';

const colors = ['#000000', '#ef4444', '#f97316', '#84cc16', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6'];

type Draw = {
  ctx: CanvasRenderingContext2D;
  currentPoint: Point;
  prevPoint: Point | null;
};

type DrawLineOptions = {
    prevPoint: Point | null;
    currentPoint: Point;
    color: string;
    lineWidth: number;
    tool: 'pen' | 'brush' | 'eraser';
}

type Point = { x: number; y: number };

let prevPoint: Point | null = null;


export default function Whiteboard() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [tool, setTool] = useState<'pen' | 'brush' | 'eraser'>('pen');
  const [color, setColor] = useState('#000000');
  const [lineWidth, setLineWidth] = useState(4);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const drawLine = ({ ctx, prevPoint: pPoint, currentPoint, color: drawColor, lineWidth: drawLineWidth, tool: drawTool } : Draw & {color: string, lineWidth: number, tool: 'pen' | 'brush' | 'eraser'}) => {
    const context = ctx;
    const currentLineWidth = drawTool === 'brush' ? drawLineWidth * 2 : drawLineWidth;
    context.strokeStyle = drawTool === 'eraser' ? '#FFFFFF' : drawColor;
    context.lineWidth = currentLineWidth;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    const startPoint = pPoint ?? currentPoint;
    context.beginPath();
    context.moveTo(startPoint.x, startPoint.y);
    context.lineTo(currentPoint.x, currentPoint.y);
    context.stroke();
  };

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    if (history.length > 0 && historyIndex >= 0) {
      const image = new Image();
      image.src = history[historyIndex];
      image.onload = () => {
        context.clearRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0);
      }
    } else {
        context.clearRect(0, 0, canvas.width, canvas.height);
    }
  }, [historyIndex]);

  useEffect(() => {
    // Connect to the socket server on the same host as the web page
    const newSocket = io();
    setSocket(newSocket);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if(!ctx) return;

    newSocket.on('draw', (options: DrawLineOptions) => {
        const { prevPoint, currentPoint, color, lineWidth, tool } = options;
        drawLine({ctx, prevPoint, currentPoint, color, lineWidth, tool});
    });

    newSocket.on('clear', () => {
        setHistory([]);
        setHistoryIndex(-1);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [canvasRef.current]);

  const saveHistory = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const dataUrl = canvas.toDataURL('image/png');
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push(dataUrl);
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    }
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    } else if (historyIndex === 0) {
        setHistoryIndex(-1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  const computePointInCanvas = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x, y };
  };

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setDrawing(true);
    const point = computePointInCanvas(e);
    if(point) prevPoint = point;
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!drawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const currentPoint = computePointInCanvas(e);
    if (!currentPoint) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const drawOptions = {
      ctx,
      currentPoint,
      prevPoint,
      color,
      lineWidth,
      tool
    };

    drawLine(drawOptions);

    if (socket) {
      socket.emit('draw', {
        prevPoint,
        currentPoint,
        color,
        lineWidth,
        tool,
      });
    }

    prevPoint = currentPoint;
  };

  const endDraw = () => {
    setDrawing(false);
    prevPoint = null;
    saveHistory();
  };

  const clearCanvas = () => {
    setHistory([]);
    setHistoryIndex(-1);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
      if(socket) socket.emit('clear');
    }
  };

  const saveAsImage = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const link = document.createElement('a');
      link.download = 'whiteboard.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  };

  return (
    <div className="flex flex-col h-full w-full">
      <div className="p-2 border-b">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
            <Button variant={tool === 'pen' ? 'secondary' : 'ghost'} size="icon" onClick={() => setTool('pen')}><Pencil className="h-5 w-5" /></Button>
            <Button variant={tool === 'brush' ? 'secondary' : 'ghost'} size="icon" onClick={() => setTool('brush')}><BrushIcon className="h-5 w-5" /></Button>
            <Button variant={tool === 'eraser' ? 'secondary' : 'ghost'} size="icon" onClick={() => setTool('eraser')}><Eraser className="h-5 w-5" /></Button>
            <div className="flex gap-1 ml-2">
                {colors.map((c) => (
                <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-full border-2 ${color === c ? 'border-primary' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                />
                ))}
            </div>
            </div>
            <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={handleUndo} disabled={historyIndex < 0}><Undo className="h-5 w-5" /></Button>
            <Button variant="outline" size="icon" onClick={handleRedo} disabled={historyIndex >= history.length - 1}><Redo className="h-5 w-5" /></Button>
            <Button variant="outline" size="icon" onClick={clearCanvas}><Trash2 className="h-5 w-5" /></Button>
            <Button variant="outline" size="icon" onClick={saveAsImage}><Save className="h-5 w-5" /></Button>
            </div>
        </div>
        <div className='flex items-center gap-4 mt-2'>
            <Label htmlFor='tip-size' className='text-sm'>Tip Size</Label>
            <Slider
                id='tip-size'
                min={1}
                max={20}
                step={1}
                value={[lineWidth]}
                onValueChange={(val) => setLineWidth(val[0])}
                className="w-48"
            />
            <span>{lineWidth}px</span>
        </div>
      </div>
      <div className="flex-1 bg-white rounded-b-lg">
        <canvas
          ref={canvasRef}
          width={600}
          height={600}
          className="w-full h-full"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
        />
      </div>
    </div>
  );
}
