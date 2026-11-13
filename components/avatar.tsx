'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { Plus, Star, RefreshCw, Trash2 } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Photo as PhotoT } from '@/lib/types';
import { Button, Photo, Select, cx, useToast } from './ui';

const ANGLES: { id: PhotoT['angle']; label: string; hint: string }[] = [
  { id: 'full', label: 'Full body', hint: 'Head to toe, standing straight' },
  { id: 'front', label: 'Front', hint: 'Face and shoulders, facing the camera' },
  { id: 'side', label: 'Side profile', hint: 'Turned 90°, natural posture' },
  { id: 'other', label: 'Other angle', hint: 'Any other clear photo' },
];
export const angleLabel = (a: string) => ANGLES.find((x) => x.id === a)?.label || 'Photo';

export function AvatarManager() {
  const { photos, url, addPhoto, replacePhoto, updatePhoto, deletePhoto } = useStore();
  const toast = useToast();
  const [angle, setAngle] = useState<PhotoT['angle']>('full');
  const [busy, setBusy] = useState('');

  const run = async (key: string, fn: () => Promise<void>, done?: string) => {
    setBusy(key);
    try { await fn(); if (done) toast(done); } catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(''); }
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {photos.map((p) => (
          <div key={p.id} className="group animate-fade-up">
            <div className="relative overflow-hidden rounded-card">
              <Photo src={url(p.path)} className="aspect-[3/4] w-full" />
              {p.is_default && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] backdrop-blur">Main</span>}
              {busy === p.id && <div className="absolute inset-0 grid place-items-center bg-white/60"><RefreshCw className="size-5 animate-spin" strokeWidth={1.5} /></div>}
            </div>
            <div className="mt-3 flex items-center justify-between">
              <select
                aria-label="Angle"
                value={p.angle}
                onChange={(e) => run(p.id, () => updatePhoto(p.id, { angle: e.target.value as PhotoT['angle'] }))}
                className="bg-transparent text-[13px] text-ink focus:outline-none"
              >
                {ANGLES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              <div className="flex">
                {!p.is_default && (
                  <button title="Use as main photo" aria-label="Use as main photo" onClick={() => run(p.id, () => updatePhoto(p.id, { is_default: true }), 'Main photo updated')} className="grid size-8 place-items-center rounded-full text-muted hover:bg-soft hover:text-ink"><Star className="size-4" strokeWidth={1.5} /></button>
                )}
                <label title="Replace" aria-label="Replace photo" className="grid size-8 cursor-pointer place-items-center rounded-full text-muted hover:bg-soft hover:text-ink">
                  <RefreshCw className="size-4" strokeWidth={1.5} />
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) run(p.id, () => replacePhoto(p, f), 'Photo replaced'); }} />
                </label>
                <button title="Delete" aria-label="Delete photo" onClick={() => confirm('Delete this photo?') && run(p.id, () => deletePhoto(p), 'Photo deleted')} className="grid size-8 place-items-center rounded-full text-muted hover:bg-soft hover:text-danger"><Trash2 className="size-4" strokeWidth={1.5} /></button>
              </div>
            </div>
          </div>
        ))}
        <label className={cx('flex aspect-[3/4] cursor-pointer flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line bg-canvas/50 p-4 text-center transition-colors hover:border-ink/30', busy === 'new' && 'pointer-events-none opacity-60')}>
          <span className="grid size-11 place-items-center rounded-full bg-white shadow-soft"><Plus className="size-5" strokeWidth={1.5} /></span>
          <span className="text-[14px]">{busy === 'new' ? 'Uploading…' : `Add ${angleLabel(angle).toLowerCase()} photo`}</span>
          <span className="text-[12px] text-muted">{ANGLES.find((a) => a.id === angle)?.hint}</span>
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => {
            const files = [...(e.target.files || [])];
            e.target.value = '';
            run('new', async () => { for (const f of files) await addPhoto(f, angle); }, files.length > 1 ? 'Photos added' : 'Photo added');
          }} />
        </label>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-muted">Next photo is a</span>
        <Select aria-label="Photo angle" value={angle} onChange={(e) => setAngle(e.target.value as PhotoT['angle'])} className="!h-10 w-auto !text-[14px]">
          {ANGLES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
        </Select>
      </div>
    </div>
  );
}

export function AvatarTips() {
  return (
    <ul className="grid gap-4 text-[13px] leading-relaxed text-muted sm:grid-cols-3">
      <li><span className="block text-ink">Full body is the canvas</span>Your main photo is what the clothes are placed on. Stand straight, arms slightly away from your body.</li>
      <li><span className="block text-ink">Front and side keep it you</span>Close-ups help the AI keep your face and proportions consistent across looks.</li>
      <li><span className="block text-ink">Light and background</span>Soft daylight, a plain wall and fitted clothes give the most realistic results.</li>
    </ul>
  );
}

export { Button };
