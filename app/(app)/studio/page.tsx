'use client';
/* eslint-disable @next/next/no-img-element */
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shuffle, Plus, Sparkles, Heart, Trash2, Pencil, X, ChevronDown } from 'lucide-react';
import { useStore } from '@/lib/store';
import { groupOf, type Group } from '@/lib/categories';
import type { Outfit } from '@/lib/types';
import { Button, Confirm, EmptyState, Input, Label, PageHeader, Photo, SectionHeader, Sheet, Textarea, cx, useToast } from '@/components/ui';
import { ItemPicker } from '@/components/wardrobe';
import { StylistPanel } from '@/components/stylist';

const SLOTS: { id: Group; label: string; multi?: boolean }[] = [
  { id: 'top', label: 'Top' },
  { id: 'bottom', label: 'Bottom' },
  { id: 'outerwear', label: 'Jacket' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'accessory', label: 'Accessories', multi: true },
];

export default function StudioPage() {
  return <Suspense><Studio /></Suspense>;
}

function Studio() {
  const { items, itemById, url, outfits, looks, addOutfit, updateOutfit, deleteOutfit } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [sel, setSel] = useState<string[]>([]);
  const [slot, setSlot] = useState<(typeof SLOTS)[number] | null>(null);
  const [editing, setEditing] = useState<Outfit | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState('');
  const [saving, setSaving] = useState(false);
  const [more, setMore] = useState(false);
  const [removing, setRemoving] = useState<Outfit | null>(null);

  const load = (o: Outfit) => { setEditing(o); setSel(o.item_ids); setName(o.name); setNotes(o.notes); setTags((o.tags || []).join(', ')); setMore(Boolean(o.notes || o.tags?.length)); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  useEffect(() => {
    const id = params.get('outfit');
    const o = id && outfits.find((x) => x.id === id);
    if (o) { load(o); router.replace('/studio', { scroll: false }); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, outfits]);

  const pieces = sel.map((id) => itemById[id]).filter(Boolean);
  const inSlot = (g: Group) => pieces.filter((p) => {
    const pg = groupOf(p.category);
    return g === 'top' ? pg === 'top' || pg === 'one-piece' : pg === g;
  });
  const pool = useMemo(() => Object.fromEntries(SLOTS.map((s) => [s.id, items.filter((i) => groupOf(i.category) === s.id)])), [items]);

  const pick = (id: string) => {
    if (!slot) return;
    const g = groupOf(itemById[id].category);
    setSel((s) => {
      if (s.includes(id)) return s.filter((x) => x !== id);
      if (slot.multi) return [...s, id];
      const same = (x: string) => { const xg = groupOf(itemById[x].category); return xg === g || (slot.id === 'top' && (xg === 'one-piece' || xg === 'top')) || (g === 'one-piece' && (xg === 'top' || xg === 'bottom')); };
      return [...s.filter((x) => !same(x)), id];
    });
    if (!slot.multi) setSlot(null);
  };

  const shuffle = () => {
    const r = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const next: string[] = [];
    for (const s of SLOTS) {
      const list = pool[s.id];
      if (!list?.length) continue;
      if (s.id === 'outerwear' && Math.random() < 0.4) continue;
      if (s.id === 'accessory' && Math.random() < 0.5) continue;
      next.push(r(list).id);
    }
    setSel(next);
  };

  const reset = () => { setEditing(null); setSel([]); setName(''); setNotes(''); setTags(''); setMore(false); };
  const save = async (andTry = false) => {
    setSaving(true);
    try {
      const data = { name: name.trim() || 'Untitled outfit', item_ids: sel, notes, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) };
      const o = editing ? (await updateOutfit(editing.id, data), { ...editing, ...data }) : await addOutfit(data);
      toast(editing ? 'Outfit updated' : 'Outfit saved');
      if (andTry) router.push(`/try-on?items=${sel.join(',')}`);
      else { setEditing(o); }
    } finally { setSaving(false); }
  };

  const actions = (viewLabel: string) => (
    <>
      <Button variant="secondary" disabled={!sel.length} loading={saving} onClick={() => save(false)}>{editing ? 'Save changes' : 'Save outfit'}</Button>
      <Button disabled={!sel.length} icon={<Sparkles className="size-4" strokeWidth={1.5} />} onClick={() => save(true)}>{viewLabel}</Button>
    </>
  );

  if (!items.length) {
    return (
      <>
        <PageHeader label="Outfit studio" title="Compose" />
        <EmptyState title="Your studio needs pieces" text="Add a few things to your wardrobe and start combining them here." action={<Button onClick={() => router.push('/wardrobe?add=1')}>Add a piece</Button>} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        label="Outfit studio"
        title={editing ? editing.name : 'Compose an outfit'}
        intro={<span className="max-md:hidden">Choose a piece for each slot, or shuffle for a fresh combination. Save it, then see it on you.</span>}
        action={<>
          <Button variant="secondary" className="max-md:hidden" icon={<Shuffle className="size-4" strokeWidth={1.5} />} onClick={shuffle}>Shuffle</Button>
          {(sel.length > 0 || editing) && <Button variant="ghost" onClick={reset}>New outfit</Button>}
        </>}
      />

      <div>
      <div className="grid gap-6 md:gap-10 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        {/* flat-lay board: three across on phones, with Shuffle as the sixth tile */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          {SLOTS.map((s) => {
            const ps = inSlot(s.id);
            return (
              <button key={s.id} onClick={() => setSlot(s)} className={cx('group relative overflow-hidden rounded-2xl text-left sm:rounded-card transition-all duration-500', ps.length ? 'bg-canvas hover:shadow-soft' : 'border border-dashed border-line hover:border-ink/30')}>
                {ps.length ? (
                  <div className={cx('grid aspect-[3/4] w-full sm:aspect-[4/5]', ps.length > 1 && 'grid-cols-2 gap-1 p-1')}>
                    {ps.map((p) => <img key={p.id} src={url(p.path)} alt={p.name} className="size-full min-h-0 object-contain p-2 pt-7 sm:p-3 transition-transform duration-700 group-hover:scale-[1.03]" />)}
                  </div>
                ) : (
                  <div className="grid aspect-[3/4] w-full place-items-center sm:aspect-[4/5]"><span className="grid size-9 sm:size-10 place-items-center rounded-full bg-canvas text-muted transition-colors group-hover:text-ink"><Plus className="size-4" strokeWidth={1.5} /></span></div>
                )}
                <div className="absolute left-2.5 top-2.5 label-xs !text-[9px] sm:left-3 sm:top-3 sm:!text-[10px]">{s.label}</div>
                {ps[0] && <div className="absolute inset-x-3 bottom-3 hidden truncate text-[12px] text-ink-2 sm:block">{ps.map((p) => p.name).join(', ')}</div>}
              </button>
            );
          })}
          <button onClick={shuffle} className="group grid aspect-[3/4] place-items-center rounded-2xl bg-ink text-white transition-transform active:scale-[0.98] sm:aspect-[4/5] sm:rounded-card md:hidden">
            <span className="flex flex-col items-center gap-2"><Shuffle className="size-5" strokeWidth={1.5} /><span className="text-[12px] font-medium">Shuffle</span></span>
          </button>
        </div>

        {/* details */}
        <div className="space-y-5">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sunday in the city" />
          <button type="button" onClick={() => setMore((m) => !m)} className="flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink md:hidden" aria-expanded={more}>
            {more ? 'Hide tags & notes' : 'Add tags & notes'}<ChevronDown className={cx('size-4 transition-transform', more && 'rotate-180')} strokeWidth={1.5} />
          </button>
          <div className={cx('space-y-5', !more && 'hidden md:block')}>
            <Input label="Tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="casual, weekend, autumn" />
            <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Roll the sleeves, tuck the front…" />
          </div>
          <div className="hidden grid-cols-2 gap-3 pt-2 md:grid">{actions('Save & view on me')}</div>
        </div>
      </div>

      {/* on phones the save bar sticks above the tab bar while you build the outfit */}
      <div className="sticky bottom-20 z-20 mt-6 rounded-card border border-line bg-white/90 p-2 shadow-lift backdrop-blur-xl md:hidden">
        {sel.length > 0 && <div className="px-2 pb-2 text-[12px] text-muted">{pieces.length} piece{pieces.length === 1 ? '' : 's'} chosen</div>}
        <div className="grid grid-cols-2 gap-2">{actions('View on me')}</div>
      </div>
      </div>

      {/* saved outfits */}
      <section className="mt-16 md:mt-24">
        <SectionHeader label={`${outfits.length} saved`} title="Your outfits" />
        {outfits.length ? (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3">
            {outfits.map((o) => {
              const look = looks.find((l) => l.id === o.tryon_id && l.status === 'done');
              const ps = o.item_ids.map((id) => itemById[id]).filter(Boolean);
              return (
                <div key={o.id} className="group animate-fade-up">
                  <div className="relative overflow-hidden rounded-card bg-canvas">
                    {look ? <Photo src={url(look.path)} className="aspect-[4/5] w-full" /> : (
                      <div className="grid aspect-[4/5] grid-cols-2 gap-1 p-2 sm:p-3">{ps.slice(0, 4).map((p) => <img key={p.id} src={url(p.path)} alt="" className="size-full object-contain" />)}</div>
                    )}
                    <button aria-label="Favourite" onClick={() => updateOutfit(o.id, { favourite: !o.favourite })} className="absolute right-2 top-2 grid size-9 place-items-center rounded-full bg-white/90 shadow-soft backdrop-blur sm:right-3 sm:top-3"><Heart className={cx('size-4', o.favourite && 'fill-ink')} strokeWidth={1.5} /></button>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] tracking-[-0.01em] sm:text-[16px]">{o.name}</div>
                      <div className="mt-1 truncate text-[12px] text-muted sm:text-[13px]">{ps.length} piece{ps.length === 1 ? '' : 's'}{o.notes ? ` · ${o.notes}` : ''}</div>
                      {!!o.tags?.length && <div className="mt-2 flex flex-wrap gap-1">{o.tags.map((t) => <span key={t} className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-ink-2">{t}</span>)}</div>}
                    </div>
                    <div className="-ml-2 flex shrink-0 sm:ml-0">
                      <button aria-label="View on me" title="View on me" onClick={() => router.push(`/try-on?items=${o.item_ids.join(',')}`)} className="grid size-9 place-items-center rounded-full hover:bg-soft"><Sparkles className="size-4" strokeWidth={1.5} /></button>
                      <button aria-label="Edit" title="Edit" onClick={() => load(o)} className="grid size-9 place-items-center rounded-full hover:bg-soft"><Pencil className="size-4" strokeWidth={1.5} /></button>
                      <button aria-label="Delete" title="Delete" onClick={() => setRemoving(o)} className="grid size-9 place-items-center rounded-full text-muted hover:bg-soft hover:text-danger"><Trash2 className="size-4" strokeWidth={1.5} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p className="text-sm text-muted">Saved outfits appear here.</p>}
      </section>

      {/* stylist */}
      <section className="-mx-5 mt-16 bg-canvas px-5 py-10 md:mx-0 md:mt-24 md:rounded-[28px] md:px-12 md:py-14">
        <SectionHeader label="AI personal stylist" title="Need a second opinion?" />
        <StylistPanel />
      </section>

      <Confirm
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title="Delete this outfit?"
        text="The outfit is removed. Its pieces stay in your wardrobe and any looks stay in Saved Looks."
        onConfirm={async () => { if (!removing) return; await deleteOutfit(removing.id); if (editing?.id === removing.id) reset(); toast('Outfit deleted'); }}
      />

      <Sheet open={Boolean(slot)} onClose={() => setSlot(null)} label="Choose" title={slot?.label} wide>
        {slot && (pool[slot.id]?.length || (slot.id === 'top' && items.some((i) => groupOf(i.category) === 'one-piece'))) ? (
          <>
            <ItemPicker selected={sel} onToggle={pick} groups={slot.id === 'top' ? ['top', 'one-piece'] : [slot.id]} />
            {slot.multi && <Button className="mt-6 w-full" onClick={() => setSlot(null)}>Done</Button>}
            {inSlot(slot.id).length > 0 && <Button variant="ghost" className="mt-3 w-full" icon={<X className="size-4" />} onClick={() => { setSel((s) => s.filter((x) => !inSlot(slot.id).some((p) => p.id === x))); setSlot(null); }}>Clear {slot.label.toLowerCase()}</Button>}
          </>
        ) : (
          <div className="py-6 text-center"><Label className="mb-3">Nothing here yet</Label><Button onClick={() => router.push('/wardrobe?add=1')}>Add a piece</Button></div>
        )}
      </Sheet>
    </>
  );
}
