'use client';
/* eslint-disable @next/next/no-img-element */
import { useRef, useState } from 'react';
import { Heart } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Look } from '@/lib/types';
import { Photo, cx } from './ui';

/** Drag to compare the original photo with the AI result. */
export function CompareSlider({ before, after, className }: { before: string; after: string; className?: string }) {
  const [pos, setPos] = useState(50);
  const ref = useRef<HTMLDivElement>(null);
  const move = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    setPos(Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <div
      ref={ref}
      className={cx('relative select-none overflow-hidden rounded-card bg-canvas touch-none', className)}
      onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e.clientX); }}
      onPointerMove={(e) => e.buttons && move(e.clientX)}
    >
      <img src={after} alt="After" className="absolute inset-0 size-full object-cover" draggable={false} />
      <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={before} alt="Before" className="absolute inset-0 size-full object-cover" draggable={false} />
      </div>
      <div className="absolute inset-y-0" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/90 shadow-[0_0_12px_rgba(0,0,0,0.2)]" />
        <div className="absolute top-1/2 -ml-5 -mt-5 grid size-10 place-items-center rounded-full bg-white text-[11px] font-medium shadow-lift">⇆</div>
      </div>
      <span className="label-xs absolute left-4 top-4 rounded-full bg-white/85 px-3 py-1.5 !text-ink backdrop-blur">Before</span>
      <span className="label-xs absolute right-4 top-4 rounded-full bg-white/85 px-3 py-1.5 !text-ink backdrop-blur">After</span>
    </div>
  );
}

export function GeneratingFrame({ photo, className }: { photo?: string; className?: string }) {
  return (
    <div className={cx('relative overflow-hidden rounded-card bg-canvas', className)}>
      {photo && <img src={photo} alt="" className="absolute inset-0 size-full scale-105 object-cover opacity-60 blur-md" />}
      <div className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-white/50" />
      <div className="absolute inset-x-0 top-0 h-1/3 animate-[scan_2.4s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-white/50 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6 text-center">
        <div className="label-xs !text-ink">Tailoring your look</div>
        <p className="mt-2 text-[13px] text-ink-2">This usually takes 15 to 60 seconds</p>
      </div>
      <style>{'@keyframes scan{0%{transform:translateY(-100%)}100%{transform:translateY(300%)}}'}</style>
    </div>
  );
}

export function LookCard({ look, onOpen, selected, onSelect }: { look: Look; onOpen?: () => void; selected?: boolean; onSelect?: () => void }) {
  const { url, itemById, updateLook, photos } = useStore();
  const pieces = look.item_ids.map((id) => itemById[id]).filter(Boolean);
  const photo = photos.find((p) => p.id === look.photo_id);
  return (
    <div className="group animate-fade-up">
      <div className={cx('relative overflow-hidden rounded-card transition-all duration-500', selected ? 'ring-2 ring-ink ring-offset-2' : 'hover:shadow-lift')}>
        <button className="block w-full" onClick={onSelect || onOpen} aria-label="Open look">
          {look.status === 'done' ? (
            <Photo src={url(look.path)} className="aspect-[3/4] w-full transition-transform duration-700 group-hover:scale-[1.02]" />
          ) : look.status === 'running' ? (
            <GeneratingFrame photo={url(photo?.path)} className="aspect-[3/4] w-full" />
          ) : (
            <div className="grid aspect-[3/4] w-full place-items-center bg-canvas p-6 text-center">
              <div><div className="label-xs mb-2">Couldn&apos;t create this look</div><p className="text-[13px] text-muted line-clamp-4">{look.error}</p></div>
            </div>
          )}
        </button>
        {look.status === 'done' && !onSelect && (
          <button aria-label="Favourite" onClick={() => updateLook(look.id, { favourite: !look.favourite })} className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 shadow-soft backdrop-blur transition-transform hover:scale-105">
            <Heart className={cx('size-4', look.favourite && 'fill-ink')} strokeWidth={1.5} />
          </button>
        )}
      </div>
      <div className="mt-3 flex -space-x-2">
        {pieces.slice(0, 5).map((p) => (
          <span key={p.id} className="size-9 overflow-hidden rounded-full border-2 border-white bg-canvas">
            <img src={url(p.path)} alt="" className="size-full object-cover" />
          </span>
        ))}
      </div>
    </div>
  );
}
