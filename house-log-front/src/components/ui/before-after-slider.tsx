'use client';

import { useCallback, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  before: string;
  after: string;
  className?: string;
}

export function BeforeAfterSlider({ before, after, className }: Props) {
  const [position, setPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const move = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
    setPosition(pct);
  }, []);

  const onMouseDown = () => { dragging.current = true; };
  const onMouseMove = (e: React.MouseEvent) => { if (dragging.current) move(e.clientX); };
  const onMouseUp = () => { dragging.current = false; };
  const onTouchMove = (e: React.TouchEvent) => { move(e.touches[0].clientX); };

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full cursor-col-resize select-none overflow-hidden rounded-xl ring-1 ring-inset ring-(--hl-border-light)', className)}
      style={{ aspectRatio: '4/3' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchMove={onTouchMove}
    >
      {/* After image (full) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={after} alt="depois" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />

      {/* Before image (clipped) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ width: `${position}%` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={before} alt="antes" className="absolute inset-0 h-full object-cover" style={{ width: `${100 / (position / 100)}%`, maxWidth: 'none' }} />
      </div>

      {/* Divider line */}
      <div
        className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-white/90"
        style={{ left: `${position}%` }}
      >
        {/* Handle */}
        <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-neutral-100 bg-white">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 8L2 5l3-3M11 8l3 3-3 3" stroke="var(--hl-text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="2" y1="8" x2="14" y2="8" stroke="var(--hl-text-secondary)" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Labels */}
      <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-(--color-neutral-50) px-2 py-0.5 text-[11px] font-medium text-(--hl-text-secondary)">
        Antes
      </span>
      <span className="pointer-events-none absolute right-3 top-3 rounded-full bg-(--color-neutral-50) px-2 py-0.5 text-[11px] font-medium text-(--hl-text-secondary)">
        Depois
      </span>
    </div>
  );
}
