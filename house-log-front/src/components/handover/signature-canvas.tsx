'use client';

import { useRef, useCallback, useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignatureCanvasProps {
  onSignatureChange: (dataUrl: string | null) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * Canvas de assinatura com suporte a mouse e toque.
 * Emite o data URL (PNG base64) via onSignatureChange após cada traço.
 * Emite null quando limpo.
 */
export function SignatureCanvas({ onSignatureChange, className, disabled = false }: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasStrokes, setHasStrokes] = useState(false);

  // Inicializa o canvas com DPI correto ao montar e ao redimensionar.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    function init() {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = 1.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }

    init();

    const ro = new ResizeObserver(init);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  function getPoint(
    e: { clientX: number; clientY: number },
    canvas: HTMLCanvasElement
  ): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  const startDrawing = useCallback((x: number, y: number) => {
    if (disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    isDrawingRef.current = true;
    lastPointRef.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  }, [disabled]);

  const draw = useCallback((x: number, y: number) => {
    if (!isDrawingRef.current || disabled) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !lastPointRef.current) return;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    lastPointRef.current = { x, y };
  }, [disabled]);

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    const canvas = canvasRef.current;
    if (!canvas) return;
    setHasStrokes(true);
    onSignatureChange(canvas.toDataURL('image/png'));
  }, [onSignatureChange]);

  // Mouse handlers
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getPoint(e, canvas);
    startDrawing(x, y);
  }, [startDrawing]);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getPoint(e, canvas);
    draw(x, y);
  }, [draw]);

  const onMouseUp = useCallback(() => stopDrawing(), [stopDrawing]);
  const onMouseLeave = useCallback(() => stopDrawing(), [stopDrawing]);

  // Touch handlers — extract clientX/clientY to avoid DOM Touch type conflicts
  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const touch = e.touches[0];
    if (!canvas || !touch) return;
    const { x, y } = getPoint({ clientX: touch.clientX, clientY: touch.clientY }, canvas);
    startDrawing(x, y);
  }, [startDrawing]);

  const onTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    const touch = e.touches[0];
    if (!canvas || !touch) return;
    const { x, y } = getPoint({ clientX: touch.clientX, clientY: touch.clientY }, canvas);
    draw(x, y);
  }, [draw]);

  const onTouchEnd = useCallback(() => stopDrawing(), [stopDrawing]);

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setHasStrokes(false);
    onSignatureChange(null);
  }

  return (
    <div className={cn('relative', className)}>
      <canvas
        ref={canvasRef}
        style={{ height: 120, touchAction: 'none' }}
        className={cn(
          'w-full rounded-[var(--radius-lg)] border border-border-input bg-bg-input',
          disabled && 'cursor-not-allowed opacity-50',
          !disabled && 'cursor-crosshair',
        )}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        aria-label="Área de assinatura digital"
        role="img"
      />
      {hasStrokes && !disabled && (
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-[var(--radius-md)] bg-bg-subtle text-text-tertiary hover:bg-bg-muted hover:text-text-secondary"
          aria-label="Limpar assinatura"
        >
          <X className="h-3 w-3" aria-hidden="true" />
        </button>
      )}
      {!hasStrokes && !disabled && (
        <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-text-tertiary">
          Assine aqui
        </p>
      )}
    </div>
  );
}
