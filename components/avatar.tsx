'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { Plus, Star, RefreshCw, Trash2, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Photo as PhotoT } from '@/lib/types';
import { Button, Photo, Select, cx, useToast } from './ui';

const ANGLES: { id: PhotoT['angle']; label: string; hint: string }[] = [
  { id: 'full', label: 'Full body', hint: 'Head to toe, standing straight' },
  { id: 'front', label: 'Front', hint: 'Face and shoulders, facing the camera' },
  { id: 'side', label: 'Side profile', hint: 'Turned 90°, natural posture' },
  { id: 'other', label: 'Other angle', hint: 'Any other clear photo' },
];
export const angleLabel = (a: string) => (a === 'studio' ? 'Studio avatar' : ANGLES.find((x) => x.id === a)?.label || 'Photo');

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
        {photos.filter((p) => p.angle !== 'studio').map((p) => (
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

export function StudioAvatar() {
  const { photos, url, config, buildStudio, updatePhoto } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const studio = photos.find((p) => p.angle === 'studio');
  const own = photos.filter((p) => p.angle !== 'studio');
  const fresh = studio ? own.filter((p) => p.created_at > studio.created_at).length : own.length;
  const geminiReady = config.stylist;

  const build = async () => {
    setBusy(true); setError('');
    try { const r = await buildStudio(); toast(`Studio avatar built from ${r.used} photo${r.used === 1 ? '' : 's'}`); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid gap-8 rounded-card border border-line bg-white p-5 md:grid-cols-[minmax(0,240px)_minmax(0,1fr)] md:p-8">
      <div className="relative overflow-hidden rounded-card bg-canvas">
        {studio ? <Photo src={url(studio.path)} className="aspect-[3/4] w-full" /> : (
          <div className="grid aspect-[3/4] w-full place-items-center p-6 text-center text-[13px] text-muted">Your studio avatar appears here</div>
        )}
        {busy && <div className="absolute inset-0 grid place-items-center bg-white/70 text-[13px]"><span className="flex items-center gap-2"><RefreshCw className="size-4 animate-spin" strokeWidth={1.5} /> Building…</span></div>}
        {studio?.is_default && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] backdrop-blur">Main</span>}
      </div>
      <div className="flex flex-col justify-center">
        <span className="label-xs">Studio avatar · Gemini</span>
        <h3 className="mt-2 text-2xl tracking-tight">One clean photo of you, built from all of them</h3>
        <p className="mt-3 max-w-lg text-[14px] leading-relaxed text-muted">
          Gemini studies every photo you add and creates a full-length studio shot: arms by your sides, fitted plain clothes, plain backdrop. It becomes your main photo for try-on. Add more photos over time and rebuild it to make it more like you.
        </p>
        <p className="mt-4 text-[13px] text-muted">
          {own.length ? `${own.length} photo${own.length === 1 ? '' : 's'} of you` : 'No photos yet'}
          {studio && fresh > 0 ? ` · ${fresh} new since the last build` : ''}
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button onClick={build} loading={busy} disabled={!own.length || !geminiReady} icon={<Sparkles className="size-4" strokeWidth={1.5} />}>
            {studio ? 'Rebuild studio avatar' : 'Build studio avatar'}
          </Button>
          {studio && !studio.is_default && <Button variant="secondary" onClick={() => updatePhoto(studio.id, { is_default: true }).then(() => toast('Main photo updated'))}>Use as main photo</Button>}
        </div>
        {!geminiReady && <p className="mt-4 text-[13px] text-muted">Needs GEMINI_API_KEY in Vercel.</p>}
        {geminiReady && <p className="mt-4 text-[13px] text-muted">Uses Gemini image generation, which needs billing turned on for your Google key. Each build is one image.</p>}
        {error && <p className="mt-4 rounded-ctl bg-canvas p-4 text-[13px] text-ink">{error}</p>}
      </div>
    </div>
  );
}

export function AvatarTips() {
  return (
    <ul className="grid gap-4 text-[13px] leading-relaxed text-muted sm:grid-cols-2 lg:grid-cols-4">
      <li><span className="block text-ink">Ask someone to take it</span>A full-length photo from about two metres away, phone at chest height. Mirror selfies hide your body behind the phone.</li>
      <li><span className="block text-ink">Hands by your sides</span>Stand straight and face the camera, with nothing in your hands or in front of your body.</li>
      <li><span className="block text-ink">Fitted, plain clothes</span>A plain T-shirt and slim trousers work best. Hoodies, coats and bold logos confuse the AI.</li>
      <li><span className="block text-ink">Light and background</span>Soft daylight and a plain wall. Add a front and side close-up to keep your face consistent.</li>
    </ul>
  );
}

export { Button };
