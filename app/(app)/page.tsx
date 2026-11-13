'use client';
/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, Sparkles, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { GROUPS, groupOf } from '@/lib/categories';
import { Button, Label, Photo, SectionHeader } from '@/components/ui';
import { ItemCard } from '@/components/wardrobe';
import { LookCard } from '@/components/looks';
import { StylistPanel } from '@/components/stylist';

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Home() {
  const { user, profile, avatar, url, items, looks, outfits, itemById } = useStore();
  const name = profile.display_name || (user?.email || '').split('@')[0].replace(/[._\d]+/g, ' ').trim().split(' ')[0];
  const done = looks.filter((l) => l.status === 'done' || l.status === 'running');
  const hero = done.find((l) => l.status === 'done');
  const groups = useMemo(() => GROUPS.map((g) => ({ ...g, items: items.filter((i) => groupOf(i.category) === g.id) })).filter((g) => g.items.length), [items]);
  const today = new Date().toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="space-y-20 md:space-y-28">
      {/* greeting + featured avatar */}
      <section className="grid items-center gap-10 md:grid-cols-[1fr_minmax(0,0.85fr)] md:gap-16">
        <div className="animate-fade-up">
          <Label className="mb-5">{today}</Label>
          <h1 className="display text-[44px] md:text-[72px]">
            {greeting()}{name ? <>,<br /><span className="capitalize">{name}</span></> : ''}.
          </h1>
          <p className="mt-6 max-w-md text-[16px] leading-relaxed text-muted">
            {avatar ? 'Your atelier is ready. Bring in something new, or see how a piece from your wishlist looks on you.' : 'Start by adding a full-length photo of yourself. It becomes the canvas for every look.'}
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Link href={avatar ? '/try-on' : '/profile#avatar'}><Button size="lg" icon={<Sparkles className="size-4" strokeWidth={1.5} />}>{avatar ? 'Try something on' : 'Add your photo'}</Button></Link>
            <Link href="/wardrobe?add=1"><Button size="lg" variant="secondary" icon={<Plus className="size-4" strokeWidth={1.5} />}>Add a piece</Button></Link>
          </div>
        </div>
        <div className="relative animate-fade-up [animation-delay:120ms]">
          <Link href={avatar ? '/try-on' : '/profile#avatar'} className="group block">
            {avatar || hero ? (
              <Photo src={url(hero?.path || avatar?.path)} className="aspect-[4/5] w-full rounded-[28px] transition-transform duration-1000 ease-[var(--ease-out-soft)] group-hover:scale-[1.01]" />
            ) : (
              <div className="flex aspect-[4/5] w-full flex-col items-center justify-center rounded-[28px] bg-[radial-gradient(100%_80%_at_30%_10%,#fff_0%,#f4efe6_55%,#ece6db_100%)] text-center">
                <div className="h-40 w-24 rounded-[48px] border border-champagne/50" />
                <p className="label-xs mt-6">Your digital self</p>
              </div>
            )}
          </Link>
          {(avatar || hero) && (
            <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-2xl bg-white/85 px-5 py-4 backdrop-blur-xl">
              <div>
                <div className="label-xs !text-[10px]">{hero ? 'Latest look' : 'Your avatar'}</div>
                <div className="mt-0.5 text-[14px]">{hero ? hero.item_ids.map((id) => itemById[id]?.name).filter(Boolean).slice(0, 2).join(' · ') || 'New look' : 'Ready for fittings'}</div>
              </div>
              <ArrowRight className="size-4" strokeWidth={1.5} />
            </div>
          )}
        </div>
      </section>

      {/* Your style, reimagined */}
      <section>
        <SectionHeader label="Saved looks" title="Your Style, Reimagined" action={done.length > 0 && <Link href="/looks" className="text-[13px] text-muted hover:text-ink">View all</Link>} />
        {done.length ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-6">{done.slice(0, 4).map((l) => <Link key={l.id} href={`/looks?open=${l.id}`}><LookCard look={l} /></Link>)}</div>
        ) : (
          <div className="grid gap-6 rounded-[28px] bg-canvas p-8 md:grid-cols-3 md:p-12">
            {[['01', 'Add your photos', 'A full-length photo, plus a front and side if you like.'], ['02', 'Bring in pieces', 'Paste a link from Vinted, SHEIN, Zara or ASOS, or upload a screenshot.'], ['03', 'See it on you', 'Choose a piece or a full outfit and the AI dresses your photo.']].map(([n, t, d]) => (
              <div key={n}><div className="label-xs mb-4">{n}</div><div className="text-[17px] tracking-[-0.01em]">{t}</div><p className="mt-2 text-[14px] leading-relaxed text-muted">{d}</p></div>
            ))}
          </div>
        )}
      </section>

      {/* recently added */}
      {items.length > 0 && (
        <section>
          <SectionHeader label="Wardrobe" title="Recently added" action={<Link href="/wardrobe" className="text-[13px] text-muted hover:text-ink">Open wardrobe</Link>} />
          <div className="no-scrollbar -mx-5 flex gap-4 overflow-x-auto px-5 md:mx-0 md:grid md:grid-cols-5 md:gap-6 md:px-0">
            {items.slice(0, 5).map((i) => <div key={i.id} className="w-40 shrink-0 md:w-auto"><Link href={`/wardrobe?item=${i.id}`}><ItemCard item={i} /></Link></div>)}
          </div>
        </section>
      )}

      {/* AI recommendations */}
      <section>
        <SectionHeader label="Personal stylist" title="Outfit ideas for you" />
        <StylistPanel compact />
      </section>

      {/* recent outfits */}
      {outfits.length > 0 && (
        <section>
          <SectionHeader label="Outfit studio" title="Recent outfits" action={<Link href="/studio" className="text-[13px] text-muted hover:text-ink">Open studio</Link>} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {outfits.slice(0, 3).map((o) => {
              const look = looks.find((l) => l.id === o.tryon_id && l.status === 'done');
              const pieces = o.item_ids.map((id) => itemById[id]).filter(Boolean);
              return (
                <Link key={o.id} href={`/studio?outfit=${o.id}`} className="group flex gap-4 rounded-card border border-line p-4 transition-shadow duration-500 hover:shadow-soft">
                  <div className="w-24 shrink-0 overflow-hidden rounded-xl bg-canvas">
                    {look ? <img src={url(look.path)} alt="" className="aspect-[3/4] w-full object-cover" /> : <div className="grid aspect-[3/4] grid-cols-2 gap-0.5 p-1">{pieces.slice(0, 4).map((p) => <img key={p.id} src={url(p.path)} alt="" className="size-full object-contain" />)}</div>}
                  </div>
                  <div className="min-w-0 py-1">
                    <div className="text-[15px] tracking-[-0.01em]">{o.name}</div>
                    <div className="mt-1 text-[13px] text-muted">{pieces.length} piece{pieces.length === 1 ? '' : 's'}</div>
                    {!!o.tags?.length && <div className="mt-3 flex flex-wrap gap-1">{o.tags.slice(0, 3).map((t) => <span key={t} className="rounded-full bg-canvas px-2 py-0.5 text-[11px] text-ink-2">{t}</span>)}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* quick access */}
      {groups.length > 0 && (
        <section>
          <SectionHeader label="Quick access" title="Your wardrobe" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {groups.map((g) => (
              <Link key={g.id} href={`/wardrobe?group=${g.id}`} className="group">
                <div className="overflow-hidden rounded-card"><Photo src={url(g.items[0].path)} fit="contain" className="aspect-square w-full transition-transform duration-700 group-hover:scale-[1.03]" /></div>
                <div className="mt-3 flex items-baseline justify-between"><span className="text-[14px]">{g.label}</span><span className="text-[12px] text-muted">{g.items.length}</span></div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
