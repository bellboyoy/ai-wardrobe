'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles, Heart, Bookmark, Columns2, RotateCcw, Download, X, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { category } from '@/lib/categories';
import type { Look } from '@/lib/types';
import { Button, EmptyState, Input, Label, PageHeader, Photo, Sheet, cx, useToast } from '@/components/ui';
import { ItemPicker, AddItemSheet } from '@/components/wardrobe';
import { CompareSlider, GeneratingFrame } from '@/components/looks';

export default function TryOnPage() {
  return <Suspense><TryOn /></Suspense>;
}

function TryOn() {
  const { photos, avatar, items, url, itemById, tryOn, updateLook, addOutfit, config, looks } = useStore();
  const params = useSearchParams();
  const toast = useToast();
  const [photoId, setPhotoId] = useState(params.get('photo') || avatar?.id || '');
  const [selected, setSelected] = useState<string[]>(() => (params.get('items') || '').split(',').filter(Boolean));
  const [result, setResult] = useState<Look | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [compare, setCompare] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [name, setName] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => { if (!photoId && avatar) setPhotoId(avatar.id); }, [avatar, photoId]);
  const photo = photos.find((p) => p.id === photoId) || avatar;
  const live = result ? looks.find((l) => l.id === result.id) || result : null;
  const pieces = useMemo(() => selected.map((id) => itemById[id]).filter(Boolean), [selected, itemById]);

  const toggle = (id: string) => { setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id].slice(-6))); setResult(null); setCompare(false); };

  const generate = async () => {
    setBusy(true); setError(''); setResult(null); setCompare(false);
    try {
      const look = await tryOn({ photoId: photo?.id, itemIds: selected });
      setResult(look);
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(false); }
  };

  if (!photos.length) {
    return (
      <>
        <PageHeader label="Fitting room" title="Try On" />
        <EmptyState title="Add a photo of yourself first" text="A full-length photo becomes your digital avatar. Every try-on is built on it." action={<Link href="/profile#avatar"><Button>Add your photo</Button></Link>} />
      </>
    );
  }

  return (
    <>
      <PageHeader label="Fitting room" title="Try On" intro="Choose your photo and up to six pieces. The AI dresses you in them as a single, realistic photograph." />
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:gap-14">
        {/* stage */}
        <div className="lg:sticky lg:top-10 lg:self-start">
          {busy || live?.status === 'running' ? (
            <GeneratingFrame photo={url(photo?.path)} className="aspect-[3/4] w-full" />
          ) : live?.status === 'done' && compare ? (
            <CompareSlider before={url(photo?.path)} after={url(live.path)} className="aspect-[3/4] w-full" />
          ) : live?.status === 'done' ? (
            <Photo src={url(live.path)} className="aspect-[3/4] w-full rounded-card animate-fade-up" />
          ) : (
            <div className="relative">
              <Photo src={url(photo?.path)} className="aspect-[3/4] w-full rounded-card" />
              {pieces.length > 0 && (
                <div className="absolute bottom-4 left-4 right-4 flex gap-2 rounded-2xl bg-white/85 p-2 backdrop-blur-xl">
                  {pieces.map((p) => <img key={p.id} src={url(p.path)} alt="" className="size-14 rounded-xl bg-white object-contain p-1" />)}
                </div>
              )}
            </div>
          )}
          {live?.status === 'done' && !busy && (
            <div className="mt-5 flex flex-wrap gap-2 animate-fade-up">
              <Button variant="secondary" size="sm" icon={<Columns2 className="size-4" strokeWidth={1.5} />} onClick={() => setCompare((c) => !c)}>{compare ? 'Show result' : 'Before & after'}</Button>
              <Button variant="secondary" size="sm" icon={<Heart className={cx('size-4', live.favourite && 'fill-ink')} strokeWidth={1.5} />} onClick={() => updateLook(live.id, { favourite: !live.favourite })}>{live.favourite ? 'Favourited' : 'Favourite'}</Button>
              <Button variant="secondary" size="sm" icon={<Bookmark className="size-4" strokeWidth={1.5} />} onClick={() => { setName(pieces.map((p) => p.name).filter(Boolean).slice(0, 2).join(' & ') || 'New look'); setSaveOpen(true); }}>Save as outfit</Button>
              <a href={url(live.path)} download target="_blank" rel="noreferrer"><Button variant="ghost" size="sm" icon={<Download className="size-4" strokeWidth={1.5} />}>Download</Button></a>
              <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" strokeWidth={1.5} />} onClick={generate}>Regenerate</Button>
            </div>
          )}
          {(error || live?.status === 'error') && <p className="mt-4 rounded-ctl bg-canvas p-4 text-sm text-ink-2">{error || live?.error}</p>}
        </div>

        {/* controls */}
        <div className="space-y-10">
          <section>
            <Label className="mb-4">1 · Your avatar</Label>
            <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
              {photos.map((p) => (
                <button key={p.id} onClick={() => { setPhotoId(p.id); setResult(null); }} className={cx('w-20 shrink-0 overflow-hidden rounded-xl transition-all duration-300', p.id === photo?.id ? 'ring-2 ring-ink ring-offset-2' : 'opacity-70 hover:opacity-100')}>
                  <Photo src={url(p.path)} className="aspect-[3/4] w-full" />
                </button>
              ))}
              <Link href="/profile#avatar" className="grid w-20 shrink-0 place-items-center rounded-xl border border-dashed border-line text-muted hover:text-ink" aria-label="Manage photos"><Plus className="size-5" strokeWidth={1.5} /></Link>
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between">
              <Label>2 · Pieces {pieces.length > 0 && `(${pieces.length})`}</Label>
              <button onClick={() => setAddOpen(true)} className="text-[13px] text-muted hover:text-ink">+ Add new piece</button>
            </div>
            {pieces.length > 0 && (
              <div className="mb-5 flex flex-wrap gap-2">
                {pieces.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-2 text-[13px]">
                    <img src={url(p.path)} alt="" className="size-7 rounded-full bg-canvas object-cover" />
                    {p.name || category(p.category).one}
                    <button aria-label="Remove" onClick={() => toggle(p.id)} className="text-muted hover:text-ink"><X className="size-3.5" /></button>
                  </span>
                ))}
              </div>
            )}
            {items.length ? <ItemPicker selected={selected} onToggle={toggle} /> : <EmptyState title="Your wardrobe is empty" text="Add a piece from any shop to try it on." action={<Button onClick={() => setAddOpen(true)}>Add a piece</Button>} />}
          </section>

          <div className="sticky bottom-20 z-20 rounded-card border border-line bg-white/90 p-4 shadow-lift backdrop-blur-xl md:bottom-6">
            {config.aiReady ? (
              <Button size="lg" className="w-full" disabled={!selected.length || !photo} loading={busy} icon={<Sparkles className="size-4" strokeWidth={1.5} />} onClick={generate}>
                {busy ? 'Creating your look…' : selected.length > 1 ? `Generate outfit · ${selected.length} pieces` : 'Generate look'}
              </Button>
            ) : (
              <div className="text-center text-sm text-muted">
                <p className="text-ink">The try-on AI isn&apos;t connected yet.</p>
                <p className="mt-1">Add <code className="rounded bg-canvas px-1.5">GEMINI_API_KEY</code> in Vercel to start generating looks. Nothing is faked in the meantime.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AddItemSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <Sheet open={saveOpen} onClose={() => setSaveOpen(false)} label="Save" title="Save as outfit">
        <div className="space-y-5">
          <Input label="Outfit name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <Button className="w-full" onClick={async () => {
            await addOutfit({ name, item_ids: selected, tryon_id: live?.id });
            setSaveOpen(false); toast('Outfit saved to your studio');
          }}>Save outfit</Button>
        </div>
      </Sheet>
    </>
  );
}
