import { useEffect, useRef, useState } from 'react';
import { Minus, Plus, X } from 'lucide-react';

type PhotoCropDialogProps = {
  file: File;
  onCancel: () => void;
  onSave: (photoDataUrl: string) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function PhotoCropDialog({ file, onCancel, onSave }: PhotoCropDialogProps) {
  const [imageUrl, setImageUrl] = useState('');
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [viewportSize, setViewportSize] = useState(300);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [error, setError] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<{ pointerX: number; pointerY: number; offsetX: number; offsetY: number } | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);
    setImageSize({ width: 0, height: 0 });
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setError('');
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  useEffect(() => {
    const element = viewportRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setViewportSize(Math.max(1, entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const baseScale = imageSize.width && imageSize.height
    ? Math.max(viewportSize / imageSize.width, viewportSize / imageSize.height)
    : 1;
  const displayScale = baseScale * zoom;
  const displayWidth = imageSize.width * displayScale;
  const displayHeight = imageSize.height * displayScale;
  const imageLeft = (viewportSize - displayWidth) / 2 + offset.x;
  const imageTop = (viewportSize - displayHeight) / 2 + offset.y;

  useEffect(() => {
    if (!imageSize.width || !imageSize.height) return;
    const maxX = Math.max(0, (displayWidth - viewportSize) / 2);
    const maxY = Math.max(0, (displayHeight - viewportSize) / 2);
    setOffset((current) => ({ x: clamp(current.x, -maxX, maxX), y: clamp(current.y, -maxY, maxY) }));
  }, [displayWidth, displayHeight, viewportSize, imageSize.width, imageSize.height]);

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!imageSize.width) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, offsetX: offset.x, offsetY: offset.y };
  };

  const moveImage = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const drag = dragRef.current;
    const maxX = Math.max(0, (displayWidth - viewportSize) / 2);
    const maxY = Math.max(0, (displayHeight - viewportSize) / 2);
    setOffset({
      x: clamp(drag.offsetX + event.clientX - drag.pointerX, -maxX, maxX),
      y: clamp(drag.offsetY + event.clientY - drag.pointerY, -maxY, maxY),
    });
  };

  const cropAndSave = () => {
    const image = imageRef.current;
    if (!image || !imageSize.width || !viewportSize) return;
    const canvas = document.createElement('canvas');
    const outputSize = 512;
    const outputRatio = outputSize / viewportSize;
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d');
    if (!context) {
      setError('Your browser could not prepare this photo. Try another image.');
      return;
    }
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, outputSize, outputSize);
    context.drawImage(
      image,
      imageLeft * outputRatio,
      imageTop * outputRatio,
      displayWidth * outputRatio,
      displayHeight * outputRatio,
    );
    onSave(canvas.toDataURL('image/jpeg', 0.9));
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/75 p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="photo-crop-title" className="w-full max-w-md rounded-2xl border-[3px] border-[#0b1120] bg-white p-5 shadow-[8px_8px_0px_#0b1120] sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="photo-crop-title" className="text-xl font-black text-[#0b1120]">Adjust your photo</h2>
            <p className="mt-1 text-sm text-slate-500">Drag to position, then zoom to crop.</p>
          </div>
          <button type="button" onClick={onCancel} aria-label="Close photo crop tool" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-5 w-5" /></button>
        </div>

        <div
          ref={viewportRef}
          className="relative mx-auto mt-5 aspect-square w-[min(80vw,320px)] touch-none cursor-grab overflow-hidden rounded-2xl bg-slate-900 active:cursor-grabbing"
          onPointerDown={startDrag}
          onPointerMove={moveImage}
          onPointerUp={() => { dragRef.current = null; }}
          onPointerCancel={() => { dragRef.current = null; }}
        >
          {imageUrl && <img
            ref={imageRef}
            src={imageUrl}
            alt="Photo crop preview"
            draggable={false}
            onLoad={(event) => setImageSize({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => setError('This image could not be opened. Choose another photo.')}
            className="pointer-events-none absolute max-w-none select-none"
            style={{ left: imageLeft, top: imageTop, width: displayWidth, height: displayHeight }}
          />}
          <div className="pointer-events-none absolute inset-0 border border-white/70" />
          {!imageSize.width && !error && <div className="absolute inset-0 flex items-center justify-center text-sm font-semibold text-white">Loading photo…</div>}
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Minus className="h-4 w-4 shrink-0 text-slate-500" />
          <input
            aria-label="Zoom photo"
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="w-full accent-blue-600"
          />
          <Plus className="h-4 w-4 shrink-0 text-slate-500" />
        </div>
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{error}</p>}
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={cropAndSave} disabled={!imageSize.width || Boolean(error)} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50">Use photo</button>
        </div>
      </section>
    </div>
  );
}
