import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

type ImageZoomPreviewProps = {
  open: boolean;
  src: string;
  alt?: string;
  onClose: () => void;
  minScale?: number;
  maxScale?: number;
};

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const ImageZoomPreview: React.FC<ImageZoomPreviewProps> = ({
  open,
  src,
  alt,
  onClose,
  minScale = 0.5,
  maxScale = 6,
}) => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const scaleRef = useRef(scale);
  const translateRef = useRef(translate);
  const dragRef = useRef<{
    pointerId: number;
    startClientX: number;
    startClientY: number;
    startTranslateX: number;
    startTranslateY: number;
  } | null>(null);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  useEffect(() => {
    translateRef.current = translate;
  }, [translate]);

  useEffect(() => {
    if (!open) return;
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [open, src]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const handleWheel: React.WheelEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    const viewport = viewportRef.current;
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const currentScale = scaleRef.current;
    const zoomFactor = Math.exp(-e.deltaY / 300);
    const nextScale = clamp(currentScale * zoomFactor, minScale, maxScale);
    if (nextScale === currentScale) return;

    const k = nextScale / currentScale;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    const { x: tx, y: ty } = translateRef.current;

    const nextTranslateX = (1 - k) * dx + k * tx;
    const nextTranslateY = (1 - k) * dy + k * ty;

    setScale(nextScale);
    setTranslate({ x: nextTranslateX, y: nextTranslateY });
  };

  const handlePointerDown: React.PointerEventHandler<HTMLDivElement> = (e) => {
    if (e.button !== 0) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startTranslateX: translateRef.current.x,
      startTranslateY: translateRef.current.y,
    };
  };

  const handlePointerMove: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const nextTranslateX = drag.startTranslateX + (e.clientX - drag.startClientX);
    const nextTranslateY = drag.startTranslateY + (e.clientY - drag.startClientY);
    setTranslate({ x: nextTranslateX, y: nextTranslateY });
  };

  const handlePointerEnd: React.PointerEventHandler<HTMLDivElement> = (e) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
  };

  const transform = `translate3d(${translate.x}px, ${translate.y}px, 0) scale(${scale})`;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-6xl h-full max-h-[calc(100vh-2rem)] bg-[var(--bg-card)] rounded-2xl border border-[var(--border-color)] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="关闭"
          className="absolute top-4 right-4 z-10 w-11 h-11 rounded-full bg-black/60 text-white hover:bg-white/20 transition-colors flex items-center justify-center"
        >
          <X size={22} />
        </button>

        <div className="absolute inset-0 p-5">
          <div
            ref={viewportRef}
            className="w-full h-full rounded-xl bg-[var(--bg-image-surface)] shadow-2xl overflow-hidden flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing"
            onWheel={handleWheel}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onPointerLeave={handlePointerEnd}
          >
            <img
              src={src}
              alt={alt ?? ''}
              draggable={false}
              className="max-w-full max-h-full object-contain pointer-events-none select-none"
              style={{ transform, transformOrigin: 'center', willChange: 'transform' }}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default ImageZoomPreview;
