import { requireUser, route, downloadImage, HttpError } from '@/lib/server/auth';
import { gemini, textModel, imgPart, parseJson, type Part } from '@/lib/server/gemini';
import { weatherFor } from '@/lib/server/weather';
import { category } from '@/lib/categories';
import type { Item, Profile, Suggestion } from '@/lib/types';

export const maxDuration = 120;

export const POST = route<{ request?: string; focusItemId?: string }>(async (req, body) => {
  const { sb } = await requireUser(req);
  const { data } = await sb.from('items').select('*').order('created_at', { ascending: false });
  const items = (data || []) as Item[];
  if (items.length < 2) throw new HttpError(400, 'Add a few pieces to your wardrobe first');
  const { data: prof } = await sb.from('profiles').select('*').maybeSingle();
  const p = (prof || {}) as Partial<Profile>;
  const weather = await weatherFor(p.city || '');

  const catalog = items.map((it) =>
    `- id=${it.id} | ${category(it.category).one} | ${it.name || 'unnamed'} | colour: ${it.colour || '?'} | ${it.brand || ''} | ${it.price || 'no price'} | ${it.status === 'owned' ? 'owned' : 'wishlist (not bought yet)'}`).join('\n');
  const prefs = [
    p.styles?.length ? `Preferred styles: ${p.styles.join(', ')}` : '',
    p.brands?.length ? `Favourite brands: ${p.brands.join(', ')}` : '',
    p.budget ? `Budget: ${p.budget}` : '',
    weather ? `Weather today: ${weather}` : '',
  ].filter(Boolean).join('\n');
  const focus = items.find((i) => i.id === body.focusItemId);

  const parts: Part[] = [{
    text:
      `You are a refined personal stylist for a luxury fashion app. My wardrobe:\n${catalog}\n\n${prefs ? `About me:\n${prefs}\n\n` : ''}` +
      `${focus ? `Build around this piece: id=${focus.id}.\n` : ''}Request: ${body.request || 'Suggest three great outfits from my wardrobe.'}\n\n` +
      'Consider colour harmony, occasion, budget (sum the prices of wishlist items that would need buying) and the weather if given. ' +
      'Each outfit uses only ids from the list: at most one top layer under one jacket, one bottom (or one dress instead of top and bottom), optionally shoes and up to two accessories. ' +
      'Reply ONLY with JSON: {"reply": one or two friendly sentences, "outfits": [{"name": short evocative name, "itemIds": [ids], "why": one sentence, "tags": [1 to 3 short tags], "missing": optional short note on a piece that would complete it, else ""}]}. Give 1 to 5 outfits as asked (default 3).',
  }];
  const photos = await Promise.all(items.slice(0, 20).map(async (it) => ({ id: it.id, img: await downloadImage(sb, it.path).catch(() => null) })));
  for (const ph of photos) if (ph.img) parts.push({ text: `Photo of id=${ph.id}` }, imgPart(ph.img));
  const res = parseJson<{ reply?: string; outfits?: Suggestion[] }>(await gemini(textModel(), parts, { json: true }));
  const ids = new Set(items.map((i) => i.id));
  const outfits = (res.outfits || []).map((o) => ({ ...o, itemIds: (o.itemIds || []).filter((id) => ids.has(id)) })).filter((o) => o.itemIds.length);
  return { reply: res.reply || '', outfits, weather };
});
