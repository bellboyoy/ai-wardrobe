// Dress your photo in one or more items with the chosen AI, save the result.
import { handler, requireUser, downloadImage, uploadImage, HttpError } from './_lib/auth.js';
import { runTryOn, providerName } from './_lib/tryon.js';

export default handler(async ({ req, res, body }) => {
  const { sb, user } = await requireUser(req);
  const photo = body.photoId
    ? (await sb.from('photos').select('*').eq('id', body.photoId).single()).data
    : (await sb.from('photos').select('*').order('is_default', { ascending: false }).limit(1).maybeSingle()).data;
  if (!photo) throw new HttpError(400, 'Add a photo of yourself first (Me tab)');
  const ids = Array.isArray(body.itemIds) ? body.itemIds : [];
  const { data: items } = ids.length ? await sb.from('items').select('*').in('id', ids) : { data: [] };
  if (!items?.length) throw new HttpError(400, 'Pick at least one item');

  const { data: row, error } = await sb.from('tryons').insert({
    photo_id: photo.id, item_ids: items.map((i) => i.id), outfit_id: body.outfitId || null, provider: providerName(), status: 'running',
  }).select().single();
  if (error) throw new Error(error.message);

  try {
    const person = await downloadImage(sb, photo.path);
    const garments = await Promise.all(items.map(async (it) => ({ ...it, img: await downloadImage(sb, it.path) })));
    const out = await runTryOn(person, garments);
    const path = await uploadImage(sb, user, 'looks', out.buffer, out.mime);
    const { data: done } = await sb.from('tryons').update({ status: 'done', path }).eq('id', row.id).select().single();
    if (row.outfit_id) await sb.from('outfits').update({ tryon_id: row.id }).eq('id', row.outfit_id);
    res.json(done);
  } catch (e) {
    console.error(e);
    await sb.from('tryons').update({ status: 'error', error: e.message }).eq('id', row.id);
    throw new HttpError(400, e.message);
  }
});
