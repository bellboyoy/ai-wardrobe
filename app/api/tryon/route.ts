import { requireUser, route, downloadImage, uploadImage, HttpError } from '@/lib/server/auth';
import { runTryOn } from '@/lib/server/tryon';
import { providerName, setupHint } from '@/lib/server/env';
import type { Item, Photo } from '@/lib/types';

export const maxDuration = 300;

export const POST = route<{ photoId?: string; itemIds?: string[]; outfitId?: string }>(async (req, body) => {
  const { sb, user } = await requireUser(req);
  if (providerName() === 'none') throw new HttpError(400, `No try-on AI is connected yet. ${setupHint()}`);
  const { data: photos } = await sb.from('photos').select('*').order('created_at', { ascending: false });
  const all = (photos || []) as Photo[];
  const photo = all.find((p) => p.id === body.photoId) || all.find((p) => p.is_default) || all[0];
  if (!photo) throw new HttpError(400, 'Add a photo of yourself first');
  const ids = Array.isArray(body.itemIds) ? body.itemIds.slice(0, 6) : [];
  const { data: items } = ids.length ? await sb.from('items').select('*').in('id', ids) : { data: [] };
  if (!items?.length) throw new HttpError(400, 'Choose at least one piece of clothing');

  const { data: row, error } = await sb.from('tryons').insert({
    photo_id: photo.id, item_ids: (items as Item[]).map((i) => i.id), outfit_id: body.outfitId || null, provider: providerName(), status: 'running',
  }).select().single();
  if (error) throw new Error(error.message);

  try {
    const refs = all.filter((p) => p.id !== photo.id && (p.angle === 'front' || p.angle === 'side')).slice(0, 2);
    const [person, references, garments] = await Promise.all([
      downloadImage(sb, photo.path),
      Promise.all(refs.map((p) => downloadImage(sb, p.path))),
      Promise.all((items as Item[]).map(async (it) => ({ name: it.name, category: it.category, colour: it.colour, img: await downloadImage(sb, it.path) }))),
    ]);
    const out = await runTryOn(person, references, garments);
    const path = await uploadImage(sb, user, 'looks', out.buffer, out.mime);
    const { data: done } = await sb.from('tryons').update({ status: 'done', path }).eq('id', row.id).select().single();
    if (row.outfit_id) await sb.from('outfits').update({ tryon_id: row.id }).eq('id', row.outfit_id);
    return done;
  } catch (e) {
    await sb.from('tryons').update({ status: 'error', error: (e as Error).message }).eq('id', row.id);
    throw new HttpError(400, (e as Error).message);
  }
});
