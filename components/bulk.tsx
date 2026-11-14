'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ImagePlus, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import { useStore } from '@/lib/store';
import { CATEGORIES, category, guessCategory } from '@/lib/categories';
import { Button, Select, Sheet, cx, useToast } from './ui';

type Stage = 'waiting' | 'uploading' | 'reading' | 'cleaning' | 'done' | 'failed';
type Row = { key: string; file: File; preview: string; stage: Stage; itemId?: string; error?: string; note?: string };
const LABEL: Record<Stage, string> = { waiting: 'Waiting', uploading: 'Uploading', reading: 'Reading details', cleaning: 'Making clean photo', done: 'Added', failed: 'Failed' };
const PARALLEL = 2;
const MAX = 60;

/** Add many pieces at once: each photo is uploaded, identified by AI and (optionally) given a clean photo, two at a time. */
export function BulkUploadSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { config, api, uploadItemImage, addItem, cleanItem, items, updateItem } = useStore();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [clean, setClean] = useState(true);
  const [phase, setPhase] = useState<'pick' | 'run' | 'review'>('pick');
  const stop = useRef(false);
  const ai = config.stylist;

  const previews = useRef<string[]>([]);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const pick = (list: FileList | null) => {
    const files = [...(list || [])].filter((f) => f.type.startsWith('image/')).slice(0, MAX);
    const next: Row[] = files.map((file, i) => ({ key: `${Date.now()}-${i}`, file, preview: URL.createObjectURL(file), stage: 'waiting' }));
    previews.current.push(...next.map((r) => r.preview));
    setRows(next);
  };
  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const one = async (r: Row) => {
    try {
      patch(r.key, { stage: 'uploading' });
      const path = await uploadItemImage(r.file);
      const fallback = r.file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/^(IMG|Screenshot|PXL|DSC)\b.*$/i, '');
      let fields: Record<string, string> = { name: fallback, category: guessCategory(fallback) };
      if (ai) {
        patch(r.key, { stage: 'reading' });
        const x = await api<Record<string, string> & { ok?: boolean }>('identify', { path }).catch(() => ({ ok: false } as Record<string, string> & { ok?: boolean }));
        if (x.ok) fields = { name: x.name || fallback, category: x.category || fields.category, colour: x.colour || '', brand: x.brand || '', size: x.size || '', price: x.price || '', source: x.retailer || '' };
      }
      const row = await addItem({ ...fields, path, status: 'owned' });
      patch(r.key, { itemId: row.id });
      if (ai && clean) {
        patch(r.key, { stage: 'cleaning' });
        try { await cleanItem(row.id); } catch (e) { patch(r.key, { note: (e as Error).message }); }
      }
      patch(r.key, { stage: 'done' });
    } catch (e) {
      patch(r.key, { stage: 'failed', error: (e as Error).message });
    }
  };

  const run = async (list: Row[]) => {
    setPhase('run'); stop.current = false;
    const queue = [...list];
    await Promise.all(Array.from({ length: PARALLEL }, async () => {
      while (queue.length && !stop.current) await one(queue.shift()!);
    }));
    setPhase('review');
    toast(stop.current ? 'Stopped' : 'Your pieces are in your wardrobe');
  };

  const done = rows.filter((r) => r.stage === 'done').length;
  const failed = rows.filter((r) => r.stage === 'failed');
  const n = rows.length;
  const estimate = useMemo(() => {
    if (!ai) return 'No AI is connected, so you will fill in details yourself. Nothing is charged.';
    const text = n * (clean ? 3 : 1);
    return clean
      ? `About ${n} Gemini image${n === 1 ? '' : 's'} (up to ${n * 2} if some need a second try) and ${text}–${text + n} small text calls. Images are the part that costs; check your Google AI Studio billing for the current price.`
      : `${n} small Gemini text call${n === 1 ? '' : 's'}, no images. This costs very little.`;
  }, [ai, clean, n]);

  const close = () => {
    if (phase === 'run' && !confirm('Stop adding the rest?')) return;
    stop.current = true;
    setRows([]); setPhase('pick'); onClose();
  };

  return (
    <Sheet open={open} onClose={close} label="Mass upload" title={phase === 'review' ? 'Check your pieces' : 'Add your whole wardrobe'} wide>
      {phase === 'pick' && (
        <div className="space-y-6">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line bg-canvas/60 px-6 py-12 text-center transition-colors hover:border-ink/30">
            <ImagePlus className="size-7" strokeWidth={1.25} />
            <span className="text-[15px]">{n ? `${n} photo${n === 1 ? '' : 's'} selected · choose again` : 'Choose photos of your clothes'}</span>
            <span className="text-[13px] text-muted">One piece per photo, up to {MAX} at a time. Laid flat or on a hanger works best.</span>
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
          </label>
          {n > 0 && (
            <>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {rows.map((r) => <img key={r.key} src={r.preview} alt="" className="size-16 shrink-0 rounded-xl object-cover" />)}
              </div>
              {ai && (
                <label className="flex items-start gap-3 text-[14px]">
                  <input type="checkbox" checked={clean} onChange={(e) => setClean(e.target.checked)} className="mt-1 accent-ink" />
                  <span>Make clean photos on white<span className="block text-[13px] text-muted">Your original photos are always kept.</span></span>
                </label>
              )}
              <div className="rounded-ctl bg-canvas p-4 text-[13px] leading-relaxed text-ink-2"><span className="label-xs mb-1 block">Estimated AI use</span>{estimate}</div>
              <Button size="lg" className="w-full" icon={<Sparkles className="size-4" strokeWidth={1.5} />} onClick={() => run(rows)}>
                Add {n} piece{n === 1 ? '' : 's'} as owned
              </Button>
            </>
          )}
        </div>
      )}

      {phase === 'run' && (
        <div className="space-y-6">
          <div>
            <div className="flex items-center justify-between text-[14px]"><span>{done + failed.length} of {n}</span><span className="text-muted">Keep this open</span></div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-line"><div className="h-full bg-ink transition-all duration-500" style={{ width: `${((done + failed.length) / Math.max(n, 1)) * 100}%` }} /></div>
          </div>
          <ul className="divide-y divide-line">
            {rows.map((r) => (
              <li key={r.key} className="flex items-center gap-3 py-2.5">
                <img src={r.preview} alt="" className="size-11 shrink-0 rounded-lg object-cover" />
                <span className={cx('flex-1 text-[13px]', r.stage === 'failed' ? 'text-danger' : r.stage === 'done' ? 'text-ink' : 'text-muted')}>{r.error || LABEL[r.stage]}</span>
                {r.stage === 'done' ? <Check className="size-4" strokeWidth={1.75} /> : r.stage === 'failed' ? <AlertCircle className="size-4 text-danger" strokeWidth={1.5} /> : r.stage !== 'waiting' && <RefreshCw className="size-4 animate-spin text-muted" strokeWidth={1.5} />}
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="w-full" onClick={() => { stop.current = true; }}>Stop after the current ones</Button>
        </div>
      )}

      {phase === 'review' && (
        <div className="space-y-6">
          <p className="text-[14px] text-muted">{done} added{failed.length ? `, ${failed.length} failed` : ''}. Fix anything the AI got wrong; changes save as you go.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {rows.filter((r) => r.itemId).map((r) => {
              const it = items.find((i) => i.id === r.itemId);
              if (!it) return null;
              return <ReviewCard key={r.key} id={it.id} note={r.note} update={updateItem} />;
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {failed.length > 0 && <Button variant="secondary" onClick={() => run(failed.map((r) => ({ ...r, stage: 'waiting', error: undefined })))}>Retry {failed.length} failed</Button>}
            <Button onClick={close}>Done</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function ReviewCard({ id, note, update }: { id: string; note?: string; update: (id: string, p: { name?: string; category?: string; colour?: string }) => Promise<void> }) {
  const { items, url } = useStore();
  const it = items.find((i) => i.id === id)!;
  const [name, setName] = useState(it.name);
  const [colour, setColour] = useState(it.colour);
  return (
    <div className="flex gap-3 rounded-card border border-line p-3">
      <img src={url(it.path)} alt="" className="aspect-[4/5] w-20 shrink-0 rounded-xl bg-canvas object-contain" />
      <div className="min-w-0 flex-1 space-y-2">
        <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== it.name && update(id, { name })} className="w-full border-b border-line bg-transparent pb-1 text-[14px] focus:border-ink focus:outline-none" />
        <div className="flex gap-2">
          <Select aria-label="Category" value={category(it.category).id} onChange={(e) => update(id, { category: e.target.value })} className="!h-9 flex-1 !text-[13px]">
            {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.one}</option>)}
          </Select>
          <input aria-label="Colour" value={colour} placeholder="Colour" onChange={(e) => setColour(e.target.value)} onBlur={() => colour !== it.colour && update(id, { colour })} className="w-24 border-b border-line bg-transparent text-[13px] focus:border-ink focus:outline-none" />
        </div>
        {note && <p className="text-[12px] leading-snug text-muted">{note}</p>}
      </div>
    </div>
  );
}
