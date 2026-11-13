'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, Search, Shirt } from 'lucide-react';
import { useStore } from '@/lib/store';
import { CATEGORIES, category, groupOf } from '@/lib/categories';
import type { Item } from '@/lib/types';
import { Button, Chip, EmptyState, PageHeader, Select } from '@/components/ui';
import { AddItemSheet, ItemCard, ItemDetailSheet } from '@/components/wardrobe';

const price = (p: string) => parseFloat((p || '').replace(/[^\d.,]/g, '').replace(',', '.')) || Infinity;
const SORTS: Record<string, (a: Item, b: Item) => number> = {
  newest: (a, b) => b.created_at.localeCompare(a.created_at),
  oldest: (a, b) => a.created_at.localeCompare(b.created_at),
  'price-asc': (a, b) => price(a.price) - price(b.price),
  'price-desc': (a, b) => (price(b.price) === Infinity ? -1 : price(b.price)) - (price(a.price) === Infinity ? -1 : price(a.price)),
  name: (a, b) => (a.name || '').localeCompare(b.name || ''),
  brand: (a, b) => (a.brand || '~').localeCompare(b.brand || '~'),
};

export default function WardrobePage() {
  return <Suspense><Wardrobe /></Suspense>;
}

function Wardrobe() {
  const { items } = useStore();
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [status, setStatus] = useState<'all' | 'owned' | 'wishlist' | 'favourites'>('all');
  const [sort, setSort] = useState('newest');
  const [open, setOpen] = useState<Item | null>(null);
  const [adding, setAdding] = useState(false);
  const [initialLink, setInitialLink] = useState<string>();

  useEffect(() => {
    const add = params.get('add');
    if (add) { setInitialLink(add.startsWith('http') ? add : undefined); setAdding(true); }
    const it = params.get('item');
    if (it) setOpen(items.find((i) => i.id === it) || null);
    const g = params.get('group');
    if (g) setCat(`group:${g}`);
    if (add || it || g) router.replace('/wardrobe', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const cats = CATEGORIES.filter((c) => items.some((i) => category(i.category).id === c.id));
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items
      .filter((i) => cat === 'all' || (cat.startsWith('group:') ? groupOf(i.category) === cat.slice(6) : category(i.category).id === cat))
      .filter((i) => status === 'all' || (status === 'favourites' ? i.favourite : i.status === status))
      .filter((i) => !needle || [i.name, i.brand, i.colour, i.source, category(i.category).label].join(' ').toLowerCase().includes(needle))
      .sort(SORTS[sort]);
  }, [items, q, cat, status, sort]);

  return (
    <>
      <PageHeader
        label={`${items.length} piece${items.length === 1 ? '' : 's'}`}
        title="My Wardrobe"
        intro="Everything you own and everything you're considering, in one place."
        action={<Button size="lg" icon={<Plus className="size-4" strokeWidth={1.5} />} onClick={() => { setInitialLink(undefined); setAdding(true); }}>Add a piece</Button>}
      />

      {items.length === 0 ? (
        <EmptyState icon={<Shirt className="size-5" strokeWidth={1.5} />} title="Start your wardrobe" text="Paste a link from Vinted, SHEIN, Zara or ASOS, or upload a photo or screenshot. You can share links straight into the app too." action={<Button onClick={() => setAdding(true)}>Add your first piece</Button>} />
      ) : (
        <>
          <div className="sticky top-14 z-20 -mx-5 mb-8 space-y-4 border-b border-line/60 bg-white/90 px-5 pb-4 pt-2 backdrop-blur-xl md:top-0 md:mx-0 md:px-0 md:pt-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <label className="relative flex-1">
                <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted" strokeWidth={1.5} />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, brand, colour or shop" className="h-12 w-full rounded-full border border-line bg-white pl-11 pr-4 text-[15px] placeholder:text-muted/70 focus:border-ink/30 focus:outline-none" />
              </label>
              <div className="flex gap-3">
                <Select aria-label="Show" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="!rounded-full md:w-40">
                  <option value="all">Everything</option><option value="owned">I own</option><option value="wishlist">Wishlist</option><option value="favourites">Favourites</option>
                </Select>
                <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="!rounded-full md:w-44">
                  <option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="name">Name</option><option value="brand">Brand</option>
                </Select>
              </div>
            </div>
            <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              <Chip active={cat === 'all'} onClick={() => setCat('all')}>All</Chip>
              {cats.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.label}</Chip>)}
            </div>
          </div>

          {list.length ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 sm:grid-cols-3 lg:grid-cols-4 md:gap-x-6">
              {list.map((i) => <ItemCard key={i.id} item={i} onOpen={() => setOpen(i)} />)}
            </div>
          ) : (
            <EmptyState title="Nothing matches" text="Try another search or filter." action={<Button variant="secondary" onClick={() => { setQ(''); setCat('all'); setStatus('all'); }}>Clear filters</Button>} />
          )}
        </>
      )}

      <AddItemSheet open={adding} onClose={() => setAdding(false)} initialLink={initialLink} />
      <ItemDetailSheet item={open} onClose={() => setOpen(null)} />
    </>
  );
}
