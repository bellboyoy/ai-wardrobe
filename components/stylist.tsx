'use client';
/* eslint-disable @next/next/no-img-element */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUp, Sparkles, Bookmark, Check } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Suggestion } from '@/lib/types';
import { Button, Chip, cx, useToast } from './ui';

export const PROMPTS = ['Build me a casual outfit', 'An outfit for a night out', 'Five outfits from what I own', 'Smart casual for dinner', 'An outfit under €100', 'What goes with my jacket?'];

export function SuggestionCard({ s }: { s: Suggestion }) {
  const { itemById, url, addOutfit } = useStore();
  const router = useRouter();
  const toast = useToast();
  const [saved, setSaved] = useState(false);
  const pieces = s.itemIds.map((id) => itemById[id]).filter(Boolean);
  return (
    <div className="rounded-card border border-line bg-white p-5 transition-shadow duration-500 hover:shadow-soft animate-fade-up">
      <div className="grid grid-cols-4 gap-2">
        {pieces.slice(0, 4).map((p) => (
          <div key={p.id} className="aspect-[4/5] overflow-hidden rounded-xl bg-canvas"><img src={url(p.path)} alt={p.name} className="size-full object-contain p-1.5" /></div>
        ))}
      </div>
      <h3 className="mt-5 text-[17px] font-[450] tracking-[-0.01em]">{s.name}</h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{s.why}</p>
      {s.missing && <p className="mt-2 text-[13px] text-ink-2">Would be perfect with: {s.missing}</p>}
      {!!s.tags?.length && <div className="mt-3 flex flex-wrap gap-1.5">{s.tags.map((t) => <span key={t} className="rounded-full bg-canvas px-2.5 py-1 text-[11px] text-ink-2">{t}</span>)}</div>}
      <div className="mt-5 flex gap-2">
        <Button size="sm" icon={<Sparkles className="size-4" strokeWidth={1.5} />} onClick={() => router.push(`/try-on?items=${s.itemIds.join(',')}`)}>Try on</Button>
        <Button size="sm" variant="secondary" disabled={saved} icon={saved ? <Check className="size-4" /> : <Bookmark className="size-4" strokeWidth={1.5} />} onClick={async () => {
          await addOutfit({ name: s.name, item_ids: s.itemIds, notes: s.why, tags: s.tags || [] });
          setSaved(true); toast('Outfit saved');
        }}>{saved ? 'Saved' : 'Save outfit'}</Button>
      </div>
    </div>
  );
}

export function StylistPanel({ focusItemId, compact }: { focusItemId?: string; compact?: boolean }) {
  const { api, config, items } = useStore();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ reply: string; outfits: Suggestion[]; weather?: string } | null>(null);
  const [error, setError] = useState('');

  const ask = async (text = q) => {
    setBusy(true); setError('');
    try { setRes(await api('stylist', { request: text, focusItemId })); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  if (!config.stylist) {
    return <div className="rounded-card bg-canvas p-6 text-sm text-muted">The AI stylist turns on once a Gemini key is added in Vercel.</div>;
  }
  if (items.length < 2) {
    return <div className="rounded-card bg-canvas p-6 text-sm text-muted">Add a few pieces to your wardrobe and the stylist will start putting outfits together.</div>;
  }
  return (
    <div>
      <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="relative">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Ask your stylist… e.g. a relaxed look for Sunday brunch"
          className="h-14 w-full rounded-full border border-line bg-white pl-6 pr-16 text-[15px] shadow-soft transition-colors placeholder:text-muted/70 focus:border-ink/30 focus:outline-none"
        />
        <button aria-label="Ask" disabled={busy} className="absolute right-2 top-2 grid size-10 place-items-center rounded-full bg-ink text-white transition-transform hover:scale-105 disabled:opacity-40">
          <ArrowUp className={cx('size-4', busy && 'animate-pulse')} strokeWidth={2} />
        </button>
      </form>
      <div className="no-scrollbar -mx-1 mt-4 flex gap-2 overflow-x-auto px-1">
        {PROMPTS.slice(0, compact ? 4 : 6).map((p) => <Chip key={p} onClick={() => { setQ(p); ask(p); }}>{p}</Chip>)}
      </div>
      {busy && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-72 rounded-card" />)}
        </div>
      )}
      {error && <p className="mt-6 text-sm text-danger">{error}</p>}
      {res && !busy && (
        <div className="mt-8">
          {res.reply && <p className="mb-2 max-w-2xl text-[15px] leading-relaxed text-ink-2">{res.reply}</p>}
          {res.weather && <p className="mb-6 text-[13px] text-muted">{res.weather}</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{res.outfits.map((s, i) => <SuggestionCard key={i} s={s} />)}</div>
        </div>
      )}
    </div>
  );
}
