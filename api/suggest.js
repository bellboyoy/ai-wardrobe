// AI stylist: outfit ideas from your wardrobe.
import { handler, requireUser, downloadImage, HttpError } from './_lib/auth.js';
import { suggestOutfits } from './_lib/tryon.js';

export default handler(async ({ req, res, body }) => {
  const { sb } = await requireUser(req);
  const { data: items } = await sb.from('items').select('*').order('created_at', { ascending: false });
  if (!items || items.length < 2) throw new HttpError(400, 'Add a few items first');
  const withImages = await Promise.all(items.map(async (it, i) => ({ ...it, img: i < 16 ? await downloadImage(sb, it.path) : null })));
  res.json(await suggestOutfits(withImages, String(body.request || '').slice(0, 500)));
});
