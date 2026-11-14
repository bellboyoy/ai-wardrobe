'use client';
/* eslint-disable @next/next/no-img-element */
import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Columns2, Heart, RotateCcw, Trash2, Download, Bookmark, Images } from 'lucide-react';
import { useStore } from '@/lib/store';
import { category } from '@/lib/categories';
import type { Look } from '@/lib/types';
import { Button, Chip, Confirm, EmptyState, Label, PageHeader, Photo, Sheet, cx, useToast } from '@/components/ui';
import { CompareSlider, LookCard } from '@/components/looks';

export default function LooksPage() {
  return <Suspense><Looks /></Suspense>;
}

function Looks() {
  const { looks, url, itemById, photos, updateLook, deleteLooks, addOutfit } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [filter, setFilter] = useState<'all' | 'favourites'>('all');
  const [mode, setMode] = useState<null | 'compare' | 'delete'>(null);
  const [toDelete, setToDelete] = useState<Look[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [beforeAfter, setBeforeAfter] = useState(false);

  useEffect(() => { const o = params.get('open'); if (o) { setOpenId(o); router.replace('/looks', { scroll: false }); } }, [params, router]);

  const list = looks.filter((l) => l.status !== 'error' || Date.now() - new Date(l.created_at).getTime() < 864e5).filter((l) => filter === 'all' || l.favourite);
  const open = looks.find((l) => l.id === openId) || null;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : mode === 'compare' ? [...p, id].slice(-3) : [...p, id]));
  const stopPicking = () => { setMode(null); setPicked([]); };
  const askDelete = (ls: Look[]) => ls.length && setToDelete(ls);
  const pieces = (l: Look) => l.item_ids.map((id) => itemById[id]).filter(Boolean);

  return (
    <>
      <PageHeader
        label={`${looks.filter((l) => l.status === 'done').length} looks`}
        title="Saved Looks"
        intro="Every look you've generated. Favourite the keepers, compare side by side, and recreate any of them."
        action={looks.length > 0 && (mode ? (
          <>
            <Button variant="ghost" onClick={stopPicking}>Cancel</Button>
            {mode === 'compare'
              ? <Button disabled={picked.length < 2} icon={<Columns2 className="size-4" strokeWidth={1.5} />} onClick={() => setComparing(true)}>Compare {picked.length > 1 ? picked.length : ''}</Button>
              : <>
                  <Button variant="secondary" onClick={() => setPicked(picked.length === list.length ? [] : list.map((l) => l.id))}>{picked.length === list.length ? 'Select none' : 'Select all'}</Button>
                  <Button variant="danger" disabled={!picked.length} icon={<Trash2 className="size-4" strokeWidth={1.5} />} onClick={() => askDelete(looks.filter((l) => picked.includes(l.id)))}>Delete {picked.length || ''}</Button>
                </>}
          </>
        ) : (
          <>
            {looks.length > 1 && <Button variant="secondary" icon={<Columns2 className="size-4" strokeWidth={1.5} />} onClick={() => setMode('compare')}>Compare looks</Button>}
            <Button variant="secondary" icon={<Trash2 className="size-4" strokeWidth={1.5} />} onClick={() => setMode('delete')}>Delete looks</Button>
          </>
        ))}
      />

      {looks.length === 0 ? (
        <EmptyState icon={<Images className="size-5" strokeWidth={1.5} />} title="No looks yet" text="Head to the fitting room and generate your first look. It will be saved here automatically." action={<Button onClick={() => router.push('/try-on')}>Go to Try On</Button>} />
      ) : (
        <>
          <div className="mb-8 flex gap-2">
            <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All looks</Chip>
            <Chip active={filter === 'favourites'} onClick={() => setFilter('favourites')}>Favourites</Chip>
          </div>
          {mode === 'compare' && <p className="mb-6 text-[13px] text-muted">Choose two or three looks to compare.</p>}
          {mode === 'delete' && <p className="mb-6 text-[13px] text-muted">Tap the looks you want to delete.</p>}
          <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 md:gap-x-6 lg:grid-cols-4">
            {list.map((l) => (
              <LookCard key={l.id} look={l} selected={picked.includes(l.id)} onSelect={(mode === 'compare' && l.status === 'done') || (mode === 'delete' && l.status !== 'running') ? () => toggle(l.id) : undefined} onDelete={() => askDelete([l])} onOpen={() => { setOpenId(l.id); setBeforeAfter(false); }} />
            ))}
          </div>
        </>
      )}

      {/* detail */}
      <Sheet open={Boolean(open)} onClose={() => setOpenId(null)} label={open ? new Date(open.created_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' }) : ''} title="Look" wide>
        {open && (
          <div className="grid gap-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div>
              {open.status === 'done' && beforeAfter && photos.find((p) => p.id === open.photo_id)
                ? <CompareSlider before={url(photos.find((p) => p.id === open.photo_id)!.path)} after={url(open.path)} className="aspect-[3/4] w-full" />
                : open.status === 'done' ? <Photo src={url(open.path)} className="aspect-[3/4] w-full rounded-card" /> : <div className="grid aspect-[3/4] place-items-center rounded-card bg-canvas p-8 text-center text-sm text-muted">{open.status === 'running' ? 'Still creating this look…' : open.error}</div>}
            </div>
            <div>
              <Label className="mb-4">Wearing</Label>
              <div className="space-y-3">
                {pieces(open).map((p) => (
                  <button key={p.id} onClick={() => router.push(`/wardrobe?item=${p.id}`)} className="flex w-full items-center gap-4 rounded-2xl p-2 text-left transition-colors hover:bg-canvas">
                    <img src={url(p.path)} alt="" className="size-16 rounded-xl bg-canvas object-contain p-1" />
                    <div className="min-w-0"><div className="truncate text-[14px]">{p.name || category(p.category).one}</div><div className="text-[12px] text-muted">{[p.brand || p.source, p.price].filter(Boolean).join(' · ')}</div></div>
                  </button>
                ))}
              </div>
              <div className="mt-8 grid grid-cols-2 gap-2">
                {open.status === 'done' && <Button variant="secondary" size="sm" icon={<Heart className={cx('size-4', open.favourite && 'fill-ink')} strokeWidth={1.5} />} onClick={() => updateLook(open.id, { favourite: !open.favourite })}>{open.favourite ? 'Favourited' : 'Favourite'}</Button>}
                {open.status === 'done' && <Button variant="secondary" size="sm" icon={<Columns2 className="size-4" strokeWidth={1.5} />} onClick={() => setBeforeAfter((b) => !b)}>{beforeAfter ? 'Show look' : 'Before & after'}</Button>}
                <Button variant="secondary" size="sm" icon={<RotateCcw className="size-4" strokeWidth={1.5} />} onClick={() => router.push(`/try-on?items=${open.item_ids.join(',')}${open.photo_id ? `&photo=${open.photo_id}` : ''}`)}>Recreate</Button>
                <Button variant="secondary" size="sm" icon={<Bookmark className="size-4" strokeWidth={1.5} />} onClick={async () => { await addOutfit({ name: pieces(open).map((p) => p.name).filter(Boolean).slice(0, 2).join(' & ') || 'Saved look', item_ids: open.item_ids, tryon_id: open.id }); toast('Saved to your outfits'); }}>Save as outfit</Button>
                {open.status === 'done' && <a href={url(open.path)} download target="_blank" rel="noreferrer"><Button variant="secondary" size="sm" className="w-full" icon={<Download className="size-4" strokeWidth={1.5} />}>Download</Button></a>}
                <Button variant="danger" size="sm" icon={<Trash2 className="size-4" strokeWidth={1.5} />} onClick={() => askDelete([open])}>Delete</Button>
              </div>
            </div>
          </div>
        )}
      </Sheet>

      <Confirm
        open={toDelete.length > 0}
        onClose={() => setToDelete([])}
        title={toDelete.length > 1 ? `Delete ${toDelete.length} looks?` : 'Delete this look?'}
        text={`${toDelete.length > 1 ? 'These images are' : 'The image is'} removed for good. Your clothes, photos and saved outfits stay.`}
        confirmLabel={toDelete.length > 1 ? `Delete ${toDelete.length}` : 'Delete'}
        onConfirm={async () => {
          const n = toDelete.length;
          await deleteLooks(toDelete);
          if (toDelete.some((l) => l.id === openId)) setOpenId(null);
          stopPicking();
          toast(n > 1 ? `${n} looks deleted` : 'Look deleted');
        }}
      />

      {/* compare */}
      <Sheet open={comparing} onClose={() => setComparing(false)} label="Side by side" title="Compare looks" wide>
        <div className={cx('grid gap-4', picked.length === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
          {picked.map((id) => looks.find((l) => l.id === id)).filter(Boolean).map((l) => (
            <div key={l!.id}>
              <Photo src={url(l!.path)} className="aspect-[3/4] w-full rounded-card" />
              <div className="mt-3 space-y-1">{pieces(l!).map((p) => <div key={p.id} className="truncate text-[12px] text-muted">{p.name || category(p.category).one}{p.price ? ` · ${p.price}` : ''}</div>)}</div>
              <Button size="sm" variant="secondary" className="mt-3 w-full" icon={<Heart className={cx('size-4', l!.favourite && 'fill-ink')} strokeWidth={1.5} />} onClick={() => updateLook(l!.id, { favourite: !l!.favourite })}>{l!.favourite ? 'Favourited' : 'Favourite'}</Button>
            </div>
          ))}
        </div>
      </Sheet>
    </>
  );
}
