import { requireUser, route, downloadImage, uploadImage, HttpError } from '@/lib/server/auth';
import { gemini, imageModel, imgPart } from '@/lib/server/gemini';
import { env } from '@/lib/server/env';
import { category } from '@/lib/categories';
import type { Item } from '@/lib/types';
import { BUCKET } from '@/lib/supabase';

export const maxDuration = 120;

/** Makes a clean product photo of an item on pure white with Gemini. The original photo is kept in original_path. */
export const POST = route<{ itemId?: string }>(async (req, body) => {
  const { sb, user } = await requireUser(req);
  if (!env('GEMINI_API_KEY')) throw new HttpError(400, 'Clean photos use Gemini. Add GEMINI_API_KEY in Vercel, then redeploy.');
  const { data } = await sb.from('items').select('*').eq('id', body.itemId || '').maybeSingle();
  const item = data as Item | null;
  if (!item) throw new HttpError(404, 'Item not found');

  const source = item.original_path || item.path;
  const photo = await downloadImage(sb, source);
  const what = [item.colour, item.brand, category(item.category).one.toLowerCase(), item.name && `(${item.name})`].filter(Boolean).join(' ');
  const out = await gemini(imageModel(), [
    { text: `This photo shows a ${what || 'piece of clothing'}.` },
    imgPart(photo),
    {
      text:
        'Create a clean, professional e-commerce product photo of exactly this item on a pure white (#FFFFFF) background. ' +
        'Show only the garment, flat and neatly laid out (or as a ghost-mannequin shot for tops and jackets), centred, front view, with the whole item in frame and even, soft studio lighting. ' +
        'Reproduce it faithfully: identical colours, gradients, pattern, print, crest, logos, sponsor and text, stitching, collar and sleeve shape. Do not add, remove or invent any detail. ' +
        'Remove the bed, floor, hanger, hands, people, shadows of the room and anything else that is not the item. Vertical 4:5 image. Output one image.',
    },
  ], { image: true });
  const img = out.find((p) => p.inlineData || p.inline_data);
  if (!img) throw new HttpError(400, "Gemini didn't return an image. Try again.");
  const mime = img.inlineData?.mimeType || img.inline_data?.mime_type || 'image/png';
  const b64 = img.inlineData?.data || img.inline_data?.data || '';
  const path = await uploadImage(sb, user, 'items', Buffer.from(b64, 'base64'), mime);

  // Replace an earlier clean photo, but never the original.
  if (item.original_path && item.path !== item.original_path) await sb.storage.from(BUCKET).remove([item.path]);
  const { data: row, error } = await sb.from('items').update({ path, original_path: source }).eq('id', item.id).select().single();
  if (error) throw new Error(error.message);
  return row;
});
