import { requireUser, route, downloadImage } from '@/lib/server/auth';
import { env } from '@/lib/server/env';
import { gemini, textModel, imgPart, parseJson } from '@/lib/server/gemini';
import { CATEGORIES } from '@/lib/categories';

export const maxDuration = 60;

// Look at an uploaded product photo or listing screenshot and fill in the details.
export const POST = route<{ path?: string }>(async (req, body) => {
  const { sb } = await requireUser(req);
  if (!env('GEMINI_API_KEY')) return { ok: false };
  const img = await downloadImage(sb, String(body.path || ''));
  const ids = CATEGORIES.map((c) => c.id).join(', ');
  const out = await gemini(textModel(), [
    imgPart(img),
    { text: `This is a clothing product photo or a screenshot of a shop listing. Reply only with JSON: {"name": short product name, "category": one of [${ids}], "colour": main colour in one or two words, "brand": brand if visible else "", "price": price with currency symbol if visible else "", "retailer": shop name if visible (e.g. Vinted, SHEIN, Zara, ASOS) else "", "size": size if visible else ""}.` },
  ], { json: true });
  const r = parseJson<Record<string, string>>(out);
  return { ok: true, ...r, category: CATEGORIES.some((c) => c.id === r.category) ? r.category : undefined };
});
