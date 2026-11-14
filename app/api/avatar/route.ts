import { requireUser, route, downloadImage, uploadImage, HttpError } from '@/lib/server/auth';
import { gemini, imageModel, imgPart, type Part } from '@/lib/server/gemini';
import { env } from '@/lib/server/env';
import { BUCKET } from '@/lib/supabase';
import type { Photo } from '@/lib/types';

export const maxDuration = 300;
const MAX_REFS = 10;

/** Builds one clean, full-length studio photo from all of the user's own photos, using Gemini only. */
export const POST = route(async (req) => {
  const { sb, user } = await requireUser(req);
  if (!env('GEMINI_API_KEY')) throw new HttpError(400, 'The studio avatar uses Gemini. Add GEMINI_API_KEY in Vercel, then redeploy.');

  const { data } = await sb.from('photos').select('*').order('created_at', { ascending: false });
  const all = (data || []) as Photo[];
  const own = all.filter((p) => p.angle !== 'studio');
  if (!own.length) throw new HttpError(400, 'Add at least one photo of yourself first.');
  // Full-body shots first, then face close-ups, then the rest; newest first within each.
  const rank: Record<string, number> = { full: 0, front: 1, side: 2, other: 3 };
  const refs = [...own].sort((a, b) => (rank[a.angle] ?? 4) - (rank[b.angle] ?? 4)).slice(0, MAX_REFS);
  const imgs = await Promise.all(refs.map((p) => downloadImage(sb, p.path)));

  const parts: Part[] = [{ text: `The following ${imgs.length} photos all show the same real person.` }];
  imgs.forEach((img, i) => parts.push({ text: `Photo ${i + 1} (${refs[i].angle === 'full' ? 'full body' : refs[i].angle}):` }, imgPart(img)));
  parts.push({
    text:
      'Create one photorealistic, full-length studio photograph of exactly this person, to be used as a base image for virtual clothing try-on. ' +
      'Identity is the priority: combine every photo to reproduce their real face, features, skin tone, hair, build, height and proportions as faithfully as possible. Do not beautify, slim or change them. ' +
      'Pose: standing straight, facing the camera, arms relaxed by their sides and slightly away from the body, hands empty and visible, feet hip-width apart, neutral relaxed expression. ' +
      'Framing: the whole body from just above the head to below the feet, centred, vertical 3:4 portrait, camera at chest height about two metres away. ' +
      'Clothing: a plain fitted white crew-neck T-shirt, slim plain dark trousers and simple white trainers, with no logos or text. ' +
      'Background: seamless light grey studio backdrop with soft, even, diffused lighting and a gentle floor shadow. ' +
      'No phone, mirror, other people, props, jewellery, watermark or text. It must look like a real photograph.',
  });

  const out = await gemini(imageModel(), parts, { image: true });
  const img = out.find((p) => p.inlineData || p.inline_data);
  if (!img) {
    const text = out.map((p) => p.text).filter(Boolean).join(' ');
    throw new HttpError(400, `Gemini didn't return an image${text ? `: ${text.slice(0, 200)}` : ''}. Try again, or add clearer photos.`);
  }
  const mime = img.inlineData?.mimeType || img.inline_data?.mime_type || 'image/png';
  const b64 = img.inlineData?.data || img.inline_data?.data || '';
  const path = await uploadImage(sb, user, 'photos', Buffer.from(b64, 'base64'), mime);

  // Keep a single studio avatar: replace the old one, and make the new one the main photo.
  const old = all.filter((p) => p.angle === 'studio');
  if (old.length) {
    await sb.from('photos').delete().in('id', old.map((p) => p.id));
    await sb.storage.from(BUCKET).remove(old.map((p) => p.path));
  }
  await sb.from('photos').update({ is_default: false }).neq('id', '00000000-0000-0000-0000-000000000000');
  const { data: row, error } = await sb.from('photos').insert({ path, angle: 'studio', is_default: true }).select().single();
  if (error) throw new Error(error.message);
  return { photo: row, used: refs.length };
});
