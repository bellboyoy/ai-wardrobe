import { requireUser, route, downloadImage, uploadImage, HttpError, type Img } from '@/lib/server/auth';
import { gemini, imageModel, textModel, imgPart, parseJson } from '@/lib/server/gemini';
import { env } from '@/lib/server/env';
import { category } from '@/lib/categories';
import type { Item } from '@/lib/types';
import { BUCKET } from '@/lib/supabase';

export const maxDuration = 180;

type Detail = { what: string; where: string };
type Inventory = { garment: string; colours: string; mirrored: boolean; details: Detail[]; hidden: string };
type Check = { faithful: boolean; added: string[]; missing: string[]; changed: string[] };

const list = (ds: Detail[]) => ds.map((d) => `- ${d.what} (${d.where})`).join('\n') || '- none: the garment is plain';

/** Step 1: write down exactly what is on the garment, so the image step can't invent or drop details. */
async function inventory(photo: Img, hint: string): Promise<Inventory> {
  const out = await gemini(textModel(), [
    imgPart(photo),
    {
      text:
        `This photo shows a ${hint || 'piece of clothing'}, possibly worn by someone, on a bed or in a mirror selfie. Describe ONLY the garment, as it really is. ` +
        'If this is a mirror selfie (a phone held up towards a mirror, or reversed text), set mirrored to true and describe every position and text as it is on the real garment, un-mirrored ' +
        '(text reads correctly; a logo that appears on the left of the image is really on the wearer\'s left chest). ' +
        'Reply only with JSON: {"garment": type, fit and fabric in a few words, "colours": exact main and trim colours, "mirrored": boolean, ' +
        '"details": [{"what": each visible logo, embroidery, print, text (spelled correctly), badge, zip, button, pocket, trim, stripe or contrast panel, "where": position on the garment from the wearer\'s point of view}], ' +
        '"hidden": parts of the garment that are not visible in the photo (for example the inside of the collar or the back), or ""}. ' +
        'List only what you can actually see. Do not guess labels, tags, linings or trims you cannot see.',
    },
  ], { json: true, temperature: 0 });
  const r = parseJson<Partial<Inventory>>(out);
  return { garment: r.garment || hint, colours: r.colours || '', mirrored: Boolean(r.mirrored), details: Array.isArray(r.details) ? r.details : [], hidden: r.hidden || '' };
}

/** Step 2: draw the clean photo from the photo plus the inventory. */
async function draw(photo: Img, inv: Inventory, fix: string): Promise<Img | null> {
  const out = await gemini(imageModel(), [
    imgPart(photo),
    {
      text:
        `Create a clean e-commerce product photo of exactly the garment in this photo: ${inv.garment}, colours ${inv.colours}. ` +
        'Pure white (#FFFFFF) background, the garment alone, front view, laid flat or as a ghost mannequin, centred and fully in frame, soft even studio light, vertical 4:5. ' +
        `The garment has exactly these visible details, and every one of them must appear, in the same place, size, colour and style:\n${list(inv.details)}\n` +
        'It must NOT have anything else. Do not add any neck label, brand tag, size tag, collar or cuff stripes, contrast trim, piping, inner lining, pockets, buttons, logos or text that are not in that list. ' +
        'Where a part was not visible (' + (inv.hidden || 'nothing') + '), keep it plain in the garment\'s own colour. ' +
        (inv.mirrored ? 'The source photo is a mirror selfie, so it is reversed: show the garment un-mirrored, with all text reading correctly and each logo on the side listed above. ' : '') +
        'Keep the exact colours and fabric texture. Remove the person, hands, phone, bed, hanger and room. Do not redesign, stylise or "improve" the garment. Output one image.' +
        (fix ? ` A previous attempt was wrong: ${fix}. Fix exactly that.` : ''),
    },
  ], { image: true, temperature: 0.2 });
  const img = out.find((p) => p.inlineData || p.inline_data);
  if (!img) return null;
  return { mime: img.inlineData?.mimeType || img.inline_data?.mime_type || 'image/png', base64: img.inlineData?.data || img.inline_data?.data || '' };
}

/** Step 3: compare the result with the original and the inventory. */
async function verify(photo: Img, clean: Img, inv: Inventory): Promise<Check> {
  const out = await gemini(textModel(), [
    { text: 'Image A is the original photo of a garment' + (inv.mirrored ? ' (a mirror selfie, so it is reversed)' : '') + '.' },
    imgPart(photo),
    { text: 'Image B is an AI-made product photo that must show exactly the same garment.' },
    imgPart(clean),
    {
      text:
        `The garment's real details are:\n${list(inv.details)}\n` +
        'Compare carefully. Reply only with JSON: {"faithful": boolean, "added": [details in B that are not on the real garment, such as new labels, tags, stripes, trims, linings or text], ' +
        '"missing": [real details missing from B], "changed": [details in B with the wrong colour, text, shape or side]}. Ignore the background, lighting, folds and the person. faithful is true only if all three lists are empty.',
    },
  ], { json: true, temperature: 0 });
  const r = parseJson<Partial<Check>>(out);
  const arr = (x: unknown) => (Array.isArray(x) ? x.map(String).filter(Boolean) : []);
  const c = { added: arr(r.added), missing: arr(r.missing), changed: arr(r.changed) };
  return { ...c, faithful: Boolean(r.faithful) && !c.added.length && !c.missing.length && !c.changed.length };
}

const describe = (c: Check) => [c.added.length && `added ${c.added.join(', ')}`, c.missing.length && `missing ${c.missing.join(', ')}`, c.changed.length && `changed ${c.changed.join(', ')}`].filter(Boolean).join('; ');

/** Makes a clean product photo of an item on pure white with Gemini, keeping the original. If it can't be made faithfully, the original stays. */
export const POST = route<{ itemId?: string }>(async (req, body) => {
  const { sb, user } = await requireUser(req);
  if (!env('GEMINI_API_KEY')) throw new HttpError(400, 'Clean photos use Gemini. Add GEMINI_API_KEY in Vercel, then redeploy.');
  const { data } = await sb.from('items').select('*').eq('id', body.itemId || '').maybeSingle();
  const item = data as Item | null;
  if (!item) throw new HttpError(404, 'Item not found');

  const source = item.original_path || item.path;
  const photo = await downloadImage(sb, source);
  const hint = [item.colour, item.brand, category(item.category).one.toLowerCase()].filter(Boolean).join(' ');
  const inv = await inventory(photo, hint);

  let clean: Img | null = null;
  let check: Check | null = null;
  let fix = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    clean = await draw(photo, inv, fix);
    if (!clean) continue;
    check = await verify(photo, clean, inv);
    if (check.faithful) break;
    fix = describe(check);
  }

  if (!clean || !check?.faithful) {
    // Keep (or go back to) the original rather than show an inaccurate garment.
    if (item.original_path && item.path !== item.original_path) {
      await sb.storage.from(BUCKET).remove([item.path]);
      await sb.from('items').update({ path: item.original_path, original_path: null }).eq('id', item.id);
    }
    throw new HttpError(422, `Kept your original photo: the AI version wasn't accurate${check ? ` (${describe(check)})` : ''}.`);
  }

  const path = await uploadImage(sb, user, 'items', Buffer.from(clean.base64, 'base64'), clean.mime);
  if (item.original_path && item.path !== item.original_path) await sb.storage.from(BUCKET).remove([item.path]);
  const { data: row, error } = await sb.from('items').update({ path, original_path: source }).eq('id', item.id).select().single();
  if (error) throw new Error(error.message);
  return row;
});
