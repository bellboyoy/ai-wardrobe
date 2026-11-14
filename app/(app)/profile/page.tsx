'use client';
import { useEffect, useState } from 'react';
import { LogOut, Lock } from 'lucide-react';
import { useStore } from '@/lib/store';
import type { Profile } from '@/lib/types';
import { Button, Chip, Input, Label, PageHeader, SectionHeader, Select, useToast } from '@/components/ui';
import { AvatarManager, AvatarTips } from '@/components/avatar';

const STYLES = ['Minimal', 'Classic', 'Smart casual', 'Streetwear', 'Relaxed', 'Tailored', 'Vintage', 'Sporty', 'Scandi', 'Preppy', 'Workwear', 'Elevated basics'];
const SIZE_FIELDS = [['tops', 'Tops'], ['bottoms', 'Bottoms'], ['waist', 'Waist / leg'], ['shoes', 'Shoes']];
const MEASURE_FIELDS = [['height', 'Height'], ['chest', 'Chest'], ['waist', 'Waist'], ['hips', 'Hips'], ['inseam', 'Inside leg']];

export default function ProfilePage() {
  const { user, profile, saveProfile, signOut, config } = useStore();
  const toast = useToast();
  const [p, setP] = useState<Profile>(profile);
  const [brand, setBrand] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => setP(profile), [profile]);
  useEffect(() => { if (location.hash === '#avatar') document.getElementById('avatar')?.scrollIntoView({ behavior: 'smooth' }); }, []);

  const dirty = JSON.stringify(p) !== JSON.stringify(profile);
  const setNested = (key: 'sizes' | 'measurements', k: string, v: string) => setP({ ...p, [key]: { ...p[key], [k]: v } });
  const save = async () => { setSaving(true); try { await saveProfile(p); toast('Preferences saved'); } catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); } };
  const addBrand = () => { const b = brand.trim(); if (b && !p.brands.includes(b)) setP({ ...p, brands: [...p.brands, b] }); setBrand(''); };

  return (
    <>
      <PageHeader label="Profile" title="You" intro="Your photos, sizes and taste. The stylist uses these to suggest outfits that suit you." action={dirty && <Button onClick={save} loading={saving}>Save changes</Button>} />

      <div className="space-y-24">
        <section id="avatar" className="scroll-mt-24">
          <SectionHeader label="Digital avatar" title="Your photos" />
          <p className="-mt-2 mb-8 max-w-2xl text-[14px] leading-relaxed text-muted">Your main photo is the canvas for every try-on. Front and side photos help the AI keep your face and proportions consistent.</p>
          <AvatarManager />
          <div className="mt-10 rounded-card bg-canvas p-6 md:p-8"><AvatarTips /></div>
        </section>

        <section>
          <SectionHeader label="Personal details" title="About you" />
          <div className="grid max-w-2xl gap-5 sm:grid-cols-2">
            <Input label="First name" value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} />
            <Input label="City (for weather-aware outfits)" value={p.city} onChange={(e) => setP({ ...p, city: e.target.value })} placeholder="Dublin" />
          </div>
        </section>

        <section>
          <SectionHeader label="Fit" title="Clothing sizes" />
          <div className="grid max-w-2xl grid-cols-2 gap-5 sm:grid-cols-4">
            {SIZE_FIELDS.map(([k, label]) => <Input key={k} label={label} value={p.sizes[k] || ''} onChange={(e) => setNested('sizes', k, e.target.value)} placeholder={k === 'tops' ? 'M' : k === 'shoes' ? '42' : k === 'waist' ? '32/32' : 'M'} />)}
          </div>
          <div className="mt-10 max-w-2xl">
            <div className="mb-5 flex items-center gap-2"><Lock className="size-3.5 text-muted" strokeWidth={1.5} /><Label>Body measurements · optional and private</Label></div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-5">
              {MEASURE_FIELDS.map(([k, label]) => <Input key={k} label={label} value={p.measurements[k] || ''} onChange={(e) => setNested('measurements', k, e.target.value)} placeholder={k === 'height' ? '180 cm' : 'cm'} />)}
            </div>
          </div>
        </section>

        <section>
          <SectionHeader label="Taste" title="Style preferences" />
          <div className="flex max-w-3xl flex-wrap gap-2">
            {STYLES.map((s) => <Chip key={s} active={p.styles.includes(s)} onClick={() => setP({ ...p, styles: p.styles.includes(s) ? p.styles.filter((x) => x !== s) : [...p.styles, s] })}>{s}</Chip>)}
          </div>
          <div className="mt-10 grid max-w-2xl gap-5 sm:grid-cols-2">
            <div>
              <Label className="mb-2">Favourite brands</Label>
              <div className="flex gap-2"><Input value={brand} onChange={(e) => setBrand(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBrand(); } }} placeholder="COS, Arket, Uniqlo…" /><Button variant="secondary" onClick={addBrand}>Add</Button></div>
              {p.brands.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{p.brands.map((b) => <Chip key={b} active onClick={() => setP({ ...p, brands: p.brands.filter((x) => x !== b) })}>{b} ✕</Chip>)}</div>}
            </div>
            <Select label="Typical budget per piece" value={p.budget} onChange={(e) => setP({ ...p, budget: e.target.value })}>
              <option value="">No preference</option><option value="under €25 per piece">Under €25</option><option value="€25 to €60 per piece">€25 to €60</option><option value="€60 to €150 per piece">€60 to €150</option><option value="€150+ per piece">€150+</option>
            </Select>
          </div>
        </section>

        <section>
          <SectionHeader label="Account" title="Settings" />
          <div className="max-w-2xl divide-y divide-line rounded-card border border-line">
            <div className="flex items-center justify-between p-5"><div><div className="text-[14px]">Signed in as</div><div className="text-[13px] text-muted">{user?.email}</div></div><Button variant="secondary" size="sm" icon={<LogOut className="size-4" strokeWidth={1.5} />} onClick={signOut}>Sign out</Button></div>
            <div className="flex items-center justify-between p-5"><div><div className="text-[14px]">Try-on AI</div><div className="text-[13px] text-muted">{config.aiReady ? `Connected · ${config.provider === 'gemini' ? 'Google Gemini' : config.provider === 'fashn' ? 'FASHN' : 'Replicate'}` : `Not connected. ${config.hint || ''}`}</div></div><span className={`size-2 rounded-full ${config.aiReady ? 'bg-emerald-500' : 'bg-line'}`} /></div>
            <div className="p-5"><div className="text-[14px]">Privacy</div><div className="mt-1 text-[13px] leading-relaxed text-muted">Photos are stored in a private bucket that only your login can open. They are sent to the AI service only when you generate a look or ask the stylist.</div></div>
          </div>
        </section>
      </div>

      {dirty && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-5 md:bottom-8 md:pl-64">
          <div className="flex items-center gap-4 rounded-full border border-line bg-white/95 py-2 pl-6 pr-2 shadow-lift backdrop-blur animate-fade-up">
            <span className="text-[13px] text-muted">Unsaved changes</span>
            <Button size="sm" onClick={save} loading={saving}>Save</Button>
          </div>
        </div>
      )}
    </>
  );
}
