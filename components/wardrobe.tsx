'use client';
/* eslint-disable @next/next/no-img-element */
import { useEffect, useMemo, useState } from 'react';
import { Heart, Link2, ImagePlus, ExternalLink, Trash2, Sparkles, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { CATEGORIES, GROUPS, category, groupOf, guessCategory, type Group } from '@/lib/categories';
import type { Item } from '@/lib/types';
import { Button, Chip, Input, Label, Photo, Select, Sheet, Textarea, cx, useToast } from './ui';

export function ItemCard({ item, onOpen, selected, onSelect, compact }: { item: Item; onOpen?: () => void; selected?: boolean; onSelect?: () => void; compact?: boolean }) {
  const { url, updateItem, cleaning } = useStore();
  return (
    <div className="group animate-fade-up">
      <div className={cx('relative overflow-hidden rounded-card transition-all duration-500 ease-[var(--ease-out-soft)]', selected ? 'ring-2 ring-ink ring-offset-2' : 'hover:shadow-lift')}>
        <button onClick={onSelect || onOpen} className="block w-full" aria-label={item.name || category(item.category).one}>
          <Photo src={url(item.path)} fit="contain" className="aspect-[4/5] w-full transition-transform duration-700 ease-[var(--ease-out-soft)] group-hover:scale-[1.02]" />
        </button>
        {!onSelect && (
          <button
            aria-label={item.favourite ? 'Remove from favourites' : 'Add to favourites'}
            onClick={() => updateItem(item.id, { favourite: !item.favourite })}
            className="absolute right-3 top-3 grid size-9 place-items-center rounded-full bg-white/90 opacity-100 shadow-soft backdrop-blur transition-all duration-300 hover:scale-105 md:opacity-0 md:group-hover:opacity-100 data-[on=true]:opacity-100"
            data-on={item.favourite}
          >
            <Heart className={cx('size-4', item.favourite && 'fill-ink')} strokeWidth={1.5} />
          </button>
        )}
        {onSelect && selected && <span className="absolute right-3 top-3 grid size-7 place-items-center rounded-full bg-ink text-white"><Check className="size-4" strokeWidth={2} /></span>}
        {cleaning.includes(item.id) && <span className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-full bg-white/90 px-3 py-1.5 text-[11px] text-ink shadow-soft backdrop-blur"><Sparkles className="size-3.5 animate-pulse" strokeWidth={1.5} /> Cleaning photo…</span>}
        {item.status === 'wishlist' && <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-2 backdrop-blur">Wishlist</span>}
      </div>
      {!compact && (
        <button onClick={onOpen || onSelect} className="mt-3 block w-full text-left">
          <div className="label-xs !text-[10px]">{item.brand || item.source || category(item.category).one}</div>
          <div className="mt-1 truncate text-[14px] text-ink">{item.name || category(item.category).one}</div>
          {item.price && <div className="mt-0.5 text-[13px] text-muted">{item.price}</div>}
        </button>
      )}
    </div>
  );
}

type Draft = { name: string; category: string; colour: string; brand: string; size: string; price: string; source: string; url: string; status: 'owned' | 'wishlist'; notes: string };
const blank: Draft = { name: '', category: 'tshirt', colour: '', brand: '', size: '', price: '', source: '', url: '', status: 'wishlist', notes: '' };

export function AddItemSheet({ open, onClose, initialLink }: { open: boolean; onClose: () => void; initialLink?: string }) {
  const { api, config, url, uploadItemImage, importItemImage, addItem, removeFile, cleanItem } = useStore();
  const toast = useToast();
  const [mode, setMode] = useState<'link' | 'photo'>('link');
  const [link, setLink] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [image, setImage] = useState<{ remote?: string; path?: string } | null>(null);
  const [busy, setBusy] = useState<'' | 'fetch' | 'upload' | 'identify' | 'save'>('');
  const [error, setError] = useState('');

  const reset = () => { setMode('link'); setLink(''); setDraft(null); setImage(null); setBusy(''); setError(''); };
  const close = () => { if (image?.path) removeFile(image.path); reset(); onClose(); };

  const fetchLink = async (value = link) => {
    const v = value.trim();
    if (!v) return;
    setBusy('fetch'); setError('');
    try {
      const p = await api<{ name: string; imageUrl: string; price: string; brand: string; colour: string; retailer: string }>('preview', { url: v });
      setImage({ remote: p.imageUrl });
      setDraft({ ...blank, name: p.name, price: p.price, brand: p.brand, colour: p.colour, source: p.retailer, url: v, category: guessCategory(p.name) });
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(''); }
  };

  useEffect(() => {
    if (open && initialLink) { setLink(initialLink); fetchLink(initialLink); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialLink]);

  const onFile = async (f?: File) => {
    if (!f) return;
    setBusy('upload'); setError('');
    try {
      if (image?.path) removeFile(image.path);
      const path = await uploadItemImage(f);
      setImage({ path });
      const base = { ...blank, url: link.trim(), name: f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/^(IMG|Screenshot|PXL|DSC)\b.*$/i, '') };
      base.category = guessCategory(base.name);
      setDraft(base);
      if (config.stylist) {
        setBusy('identify');
        const r = await api<{ ok: boolean; name?: string; category?: string; colour?: string; brand?: string; price?: string; retailer?: string; size?: string }>('identify', { path }).catch(() => ({ ok: false } as { ok: boolean }));
        if (r.ok) {
          const x = r as unknown as Record<string, string>;
          setDraft((d) => d && ({ ...d, name: x.name || d.name, category: x.category || d.category, colour: x.colour || d.colour, brand: x.brand || d.brand, price: x.price || d.price, source: x.retailer || d.source, size: x.size || d.size }));
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally { setBusy(''); }
  };

  const save = async () => {
    if (!draft || !image) return;
    setBusy('save'); setError('');
    try {
      const path = image.path || (await importItemImage(image.remote!));
      const row = await addItem({ ...draft, path });
      if (config.stylist) cleanItem(row.id).then(() => toast('Clean photo ready')).catch((e) => toast((e as Error).message, 'error'));
      toast('Added to your wardrobe');
      reset(); onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy('');
    }
  };

  const set = (k: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setDraft((d) => d && { ...d, [k]: e.target.value });
  const preview = image?.path ? url(image.path) : image?.remote;

  return (
    <Sheet open={open} onClose={close} label="New piece" title="Add to wardrobe" wide={Boolean(draft)}>
      {!draft && (
        <>
          <div className="mb-6 grid grid-cols-2 rounded-full bg-canvas p-1 text-sm">
            {(['link', 'photo'] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)} className={cx('h-10 rounded-full transition-all duration-300', mode === m ? 'bg-white text-ink shadow-soft' : 'text-muted')}>
                {m === 'link' ? 'Paste a link' : 'Photo or screenshot'}
              </button>
            ))}
          </div>
          {mode === 'link' ? (
            <div className="space-y-4">
              <Input autoFocus type="url" inputMode="url" placeholder="https://www.vinted.ie/items/…" value={link} onChange={(e) => setLink(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && fetchLink()} onPaste={(e) => { const t = e.clipboardData.getData('text'); setTimeout(() => fetchLink(t), 30); }} />
              <Button className="w-full" size="lg" icon={<Link2 className="size-4" strokeWidth={1.5} />} loading={busy === 'fetch'} onClick={() => fetchLink()}>Import from link</Button>
              <p className="text-center text-[13px] text-muted">Works with Vinted, SHEIN, Zara, ASOS and most shops.</p>
              {error && (
                <div className="rounded-ctl bg-canvas p-4 text-sm">
                  <p className="text-ink">{error}</p>
                  <Button variant="quiet" className="mt-2 !text-ink" onClick={() => { setMode('photo'); setError(''); }}>Upload a screenshot instead</Button>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-card border border-dashed border-line bg-canvas/60 px-6 py-14 text-center transition-colors hover:border-ink/30">
                <ImagePlus className="size-7" strokeWidth={1.25} />
                <span className="text-[15px]">{busy === 'upload' ? 'Uploading…' : busy === 'identify' ? 'Reading the details…' : 'Choose a product photo or screenshot'}</span>
                <span className="text-[13px] text-muted">{config.stylist ? 'AI fills in the name, type, colour and price for you' : 'You can fill in the details next'}</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
              </label>
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          )}
        </>
      )}

      {draft && (
        <div className="grid gap-8 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <Photo src={preview} fit="contain" className="aspect-[4/5] w-full rounded-card" />
            {busy === 'identify' && <p className="mt-3 flex items-center gap-2 text-[13px] text-muted"><Sparkles className="size-4" strokeWidth={1.5} /> Reading the details…</p>}
            <label className="mt-3 block text-center text-[13px] text-muted underline-offset-4 hover:text-ink hover:underline cursor-pointer">
              Use a different photo<input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </div>
          <div className="space-y-4">
            <Input label="Name" value={draft.name} onChange={set('name')} placeholder="Relaxed linen shirt" />
            <div className="grid grid-cols-2 gap-3">
              <Select label="Category" value={draft.category} onChange={set('category')}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.one}</option>)}
              </Select>
              <Input label="Colour" value={draft.colour} onChange={set('colour')} placeholder="Ecru" />
              <Input label="Brand" value={draft.brand} onChange={set('brand')} />
              <Input label="Size" value={draft.size} onChange={set('size')} placeholder="M" />
              <Input label="Price" value={draft.price} onChange={set('price')} placeholder="€25" />
              <Input label="Retailer" value={draft.source} onChange={set('source')} placeholder="Vinted" />
            </div>
            <Input label="Product link" type="url" value={draft.url} onChange={set('url')} placeholder="https://" />
            <div>
              <Label className="mb-2">Status</Label>
              <div className="flex gap-2">
                <Chip active={draft.status === 'wishlist'} onClick={() => setDraft({ ...draft, status: 'wishlist' })}>Wishlist</Chip>
                <Chip active={draft.status === 'owned'} onClick={() => setDraft({ ...draft, status: 'owned' })}>I own this</Chip>
              </div>
            </div>
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-3 pt-2">
              <Button variant="secondary" className="flex-1" onClick={() => { if (image?.path) removeFile(image.path); setDraft(null); setImage(null); }}>Back</Button>
              <Button className="flex-[2]" loading={busy === 'save'} disabled={busy === 'upload'} onClick={save}>Save to wardrobe</Button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

export function ItemDetailSheet({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const { url, updateItem, deleteItem, looks, config, cleanItem, restoreOriginal, cleaning } = useStore();
  const [showOriginal, setShowOriginal] = useState(false);
  const toast = useToast();
  const router = useRouter();
  const [d, setD] = useState<Item | null>(item);
  useEffect(() => setD((prev) => (prev && item && prev.id === item.id ? { ...prev, path: item.path, original_path: item.original_path } : item)), [item]);
  if (!item || !d) return null;
  const set = (k: keyof Item) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setD({ ...d, [k]: e.target.value });
  const dirty = JSON.stringify(d) !== JSON.stringify(item);
  const wornIn = looks.filter((l) => l.status === 'done' && l.item_ids.includes(item.id)).length;

  return (
    <Sheet open onClose={onClose} label={category(item.category).one} title={item.name || 'Untitled piece'} wide>
      <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="relative">
            <Photo src={url(showOriginal && item.original_path ? item.original_path : item.path)} fit="contain" className="aspect-[4/5] w-full rounded-card" />
            {cleaning.includes(item.id) && <div className="absolute inset-0 grid place-items-center rounded-card bg-white/70 text-[13px]"><span className="flex items-center gap-2"><Sparkles className="size-4 animate-pulse" strokeWidth={1.5} /> Making a clean photo…</span></div>}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {item.original_path ? (
              <div className="grid grid-cols-2 rounded-full bg-canvas p-1 text-[13px]">
                {[false, true].map((o) => (
                  <button key={String(o)} onClick={() => setShowOriginal(o)} className={cx('h-8 rounded-full px-4 transition-all duration-300', showOriginal === o ? 'bg-white text-ink shadow-soft' : 'text-muted hover:text-ink')}>{o ? 'Original' : 'Clean'}</button>
                ))}
              </div>
            ) : <span className="text-[13px] text-muted">Original photo</span>}
            {config.stylist && (
              <div className="flex gap-1">
                <Button size="sm" variant="quiet" disabled={cleaning.includes(item.id)} onClick={() => { setShowOriginal(false); cleanItem(item.id).then(() => toast('Clean photo ready')).catch((e) => toast((e as Error).message, 'error')); }}>{item.original_path ? 'Redo clean photo' : 'Make clean photo'}</Button>
                {item.original_path && <Button size="sm" variant="quiet" onClick={() => restoreOriginal(item).then(() => { setShowOriginal(false); toast('Using the original photo'); })}>Use original</Button>}
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" icon={<Sparkles className="size-4" strokeWidth={1.5} />} onClick={() => router.push(`/try-on?items=${item.id}`)}>Try it on</Button>
            <Button size="sm" variant="secondary" icon={<Heart className={cx('size-4', d.favourite && 'fill-ink')} strokeWidth={1.5} />} onClick={() => { updateItem(item.id, { favourite: !d.favourite }); setD({ ...d, favourite: !d.favourite }); }}>
              {d.favourite ? 'Favourite' : 'Favourite'}
            </Button>
            {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="secondary" icon={<ExternalLink className="size-4" strokeWidth={1.5} />}>{item.source || 'Shop'}</Button></a>}
          </div>
          {wornIn > 0 && <p className="mt-4 text-[13px] text-muted">Appears in {wornIn} saved look{wornIn > 1 ? 's' : ''}.</p>}
        </div>
        <div className="space-y-4">
          <Input label="Name" value={d.name} onChange={set('name')} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Category" value={category(d.category).id} onChange={set('category')}>
              {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.one}</option>)}
            </Select>
            <Input label="Colour" value={d.colour} onChange={set('colour')} />
            <Input label="Brand" value={d.brand} onChange={set('brand')} />
            <Input label="Size" value={d.size} onChange={set('size')} />
            <Input label="Price" value={d.price} onChange={set('price')} />
            <Input label="Retailer" value={d.source} onChange={set('source')} />
          </div>
          <Input label="Product link" value={d.url} onChange={set('url')} />
          <div>
            <Label className="mb-2">Status</Label>
            <div className="flex gap-2">
              <Chip active={d.status === 'wishlist'} onClick={() => setD({ ...d, status: 'wishlist' })}>Wishlist</Chip>
              <Chip active={d.status === 'owned'} onClick={() => setD({ ...d, status: 'owned' })}>I own this</Chip>
            </div>
          </div>
          <Textarea label="Notes" value={d.notes} onChange={set('notes')} placeholder="Fit, condition, what to wear it with…" />
          <div className="flex gap-3 pt-2">
            <Button variant="danger" icon={<Trash2 className="size-4" strokeWidth={1.5} />} onClick={async () => { if (confirm('Delete this piece?')) { await deleteItem(item); toast('Removed from wardrobe'); onClose(); } }}>Delete</Button>
            <Button className="flex-1" disabled={!dirty} onClick={async () => {
              const { id, path: _p, created_at: _c, ...patch } = d;
              await updateItem(id, patch); toast('Saved'); onClose();
            }}>Save changes</Button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}

/** Selectable grid of wardrobe pieces, grouped by tops / bottoms / shoes etc. */
export function ItemPicker({ selected, onToggle, groups, single }: { selected: string[]; onToggle: (id: string) => void; groups?: Group[]; single?: boolean }) {
  const { items } = useStore();
  const available = useMemo(() => GROUPS.filter((g) => (!groups || groups.includes(g.id)) && items.some((i) => groupOf(i.category) === g.id)), [items, groups]);
  const [tab, setTab] = useState<Group | 'all'>('all');
  const list = items.filter((i) => (tab === 'all' ? !groups || groups.includes(groupOf(i.category)) : groupOf(i.category) === tab));
  return (
    <div>
      <div className="no-scrollbar -mx-1 mb-4 flex gap-2 overflow-x-auto px-1">
        <Chip active={tab === 'all'} onClick={() => setTab('all')}>All</Chip>
        {available.map((g) => <Chip key={g.id} active={tab === g.id} onClick={() => setTab(g.id)}>{g.label}</Chip>)}
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {list.map((i) => (
          <ItemCard key={i.id} item={i} compact selected={selected.includes(i.id)} onSelect={() => onToggle(i.id)} />
        ))}
      </div>
      {single && <span className="sr-only">Choose one</span>}
    </div>
  );
}
