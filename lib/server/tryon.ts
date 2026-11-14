// Virtual try-on providers. Choose with TRYON_PROVIDER: gemini | fashn | replicate.
import type { Img } from './auth';
import { apiKey, env, providerName, setupHint, type Engine } from './env';
import { gemini, imageModel, imgPart, type Part } from './gemini';
import { downloadRemoteImage } from './linkImport';
import { groupOf, category } from '@/lib/categories';

export type Garment = { name: string; category: string; colour?: string; img: Img };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const dataUri = (i: Img) => `data:${i.mime};base64,${i.base64}`;
const ORDER: Record<string, number> = { 'one-piece': 0, bottom: 1, top: 2, outerwear: 3, shoes: 4, accessory: 5 };

/** person: the main avatar photo. references: extra photos of the same person (face, side) for identity. */
export async function runTryOn(person: Img, references: Img[], garments: Garment[], engine?: Engine): Promise<{ mime: string; buffer: Buffer }> {
  const provider = engine || providerName();
  if (provider === 'none') throw new Error(`No try-on AI is connected yet. ${setupHint()}`);
  const sorted = [...garments].sort((a, b) => (ORDER[groupOf(a.category)] ?? 9) - (ORDER[groupOf(b.category)] ?? 9));
  if (provider === 'gemini') return geminiTryOn(person, references, sorted);
  // FASHN Try-On Max handles shoes and accessories; FASHN v1.6 and IDM-VTON only dress clothes.
  const all = provider === 'fashn' && fashnModel() === 'tryon-max';
  const wearable = all ? sorted : sorted.filter((g) => !['shoes', 'accessory'].includes(groupOf(g.category)));
  if (!wearable.length) throw new Error('This try-on service can only do clothes, not shoes or accessories. Add a top, bottom, jacket or dress.');
  let current = person;
  for (const g of wearable) current = provider === 'fashn' ? await fashnOne(current, g) : await replicateOne(current, g);
  return { mime: current.mime, buffer: Buffer.from(current.base64, 'base64') };
}

async function geminiTryOn(person: Img, refs: Img[], items: Garment[]) {
  const parts: Part[] = [{ text: 'Image 1 is the main photo of me. Keep this exact person, pose, framing and background.' }, imgPart(person)];
  refs.slice(0, 2).forEach((r, i) => parts.push({ text: `Image ${i + 2} is another photo of the same person, for reference of their face and body only.` }, imgPart(r)));
  const offset = 2 + Math.min(refs.length, 2);
  items.forEach((it, i) => {
    const desc = [category(it.category).one, it.colour, it.name].filter(Boolean).join(', ');
    parts.push({ text: `Image ${offset + i} is a garment to wear: ${desc}.` }, imgPart(it.img));
  });
  parts.push({
    text:
      `Create a photorealistic, editorial-quality fashion photograph of the person from image 1 wearing ${items.length > 1 ? 'all of the garments together as one complete outfit' : 'the garment'}. ` +
      'Preserve their facial identity exactly (face shape, features, skin tone, hair), their real body proportions and height, and the pose and background of image 1. ' +
      'Reproduce every garment faithfully: same colour, pattern, print, logo, fabric texture, length and fit, with natural drape, folds and lighting that matches the scene. ' +
      'Replace only the clothing the new garments would cover and keep everything else. Ignore any other model, mannequin, hanger, watermark or text in the product photos. ' +
      'It must look like a real photograph, not a composite. Output one image.',
  });
  const out = await gemini(imageModel(), parts, { image: true });
  const img = out.find((p) => p.inlineData || p.inline_data);
  if (!img) {
    const text = out.map((p) => p.text).filter(Boolean).join(' ');
    throw new Error(`The AI didn't return an image${text ? `: ${text.slice(0, 200)}` : ''}. Try a different photo or item.`);
  }
  const d = img.inlineData ? { mime: img.inlineData.mimeType, data: img.inlineData.data } : { mime: img.inline_data!.mime_type, data: img.inline_data!.data };
  return { mime: d.mime || 'image/png', buffer: Buffer.from(d.data, 'base64') };
}

const FASHN = env('FASHN_BASE_URL') || 'https://api.fashn.ai/v1';
const FASHN_CAT: Record<string, string> = { top: 'tops', outerwear: 'tops', bottom: 'bottoms', 'one-piece': 'one-pieces' };
const fashnModel = () => env('FASHN_MODEL') || 'tryon-max';
function fashnPrompt(g: Garment) {
  const what = [g.colour, category(g.category).one.toLowerCase()].filter(Boolean).join(' ');
  const covers: Record<string, string> = {
    top: 'Completely replace whatever the person wears on their upper body, including any hoodie, hood, jacket or sleeves underneath, so only the new top is visible.',
    outerwear: 'Wear it as the outer layer over the current top.',
    bottom: 'Completely replace the trousers, jeans or shorts.',
    'one-piece': 'Completely replace the current outfit.',
  };
  return `The person wears the ${what}${g.name ? ` (${g.name})` : ''}. ${covers[groupOf(g.category)] || ''} Keep the exact colours, crest, sponsor logos and print of the product, with a natural fit. Keep the face, hair, hands, pose and background unchanged.`;
}
async function fashnOne(person: Img, g: Garment): Promise<Img> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey('FASHN_API_KEY')}` };
  const model = fashnModel();
  const inputs =
    model === 'tryon-max'
      ? { model_image: dataUri(person), product_image: dataUri(g.img), prompt: fashnPrompt(g), generation_mode: env('FASHN_QUALITY') || 'quality', resolution: env('FASHN_RESOLUTION') || '1k', return_base64: true }
      : { model_image: dataUri(person), garment_image: dataUri(g.img), category: FASHN_CAT[groupOf(g.category)] || 'auto', mode: 'quality', garment_photo_type: 'auto', return_base64: true };
  const res = await fetch(`${FASHN}/run`, { method: 'POST', headers, body: JSON.stringify({ model_name: model, inputs }) });
  const start = await res.json().catch(() => ({}));
  if (!res.ok || start.error) {
    const msg = String(start.error?.message || start.message || start.error || res.status);
    if (res.status === 401 || /api key|unauthori/i.test(msg)) throw new Error('FASHN rejected the API key. Copy it again from app.fashn.ai into FASHN_API_KEY in Vercel, then redeploy.');
    if (res.status === 402 || /credit/i.test(msg)) throw new Error('Your FASHN account is out of credits. Top up at app.fashn.ai and try again.');
    throw new Error(`FASHN: ${msg}`);
  }
  for (let i = 0; i < 120; i++) {
    await sleep(2000);
    const s = await (await fetch(`${FASHN}/status/${start.id}`, { headers })).json();
    if (s.status === 'completed') return fromOutput(s.output[0]);
    if (s.status === 'failed') throw new Error(`FASHN: ${s.error?.message || 'try-on failed'}`);
  }
  throw new Error('FASHN took too long');
}

const REP_CAT: Record<string, string> = { top: 'upper_body', outerwear: 'upper_body', bottom: 'lower_body', 'one-piece': 'dresses' };
async function replicateOne(person: Img, g: Garment): Promise<Img> {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${env('REPLICATE_API_TOKEN')}` };
  const model = env('REPLICATE_MODEL') || 'cuuupid/idm-vton';
  const m = await (await fetch(`https://api.replicate.com/v1/models/${model}`, { headers })).json();
  if (!m.latest_version?.id) throw new Error(`Replicate: couldn't find ${model}`);
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST', headers: { ...headers, Prefer: 'wait=60' },
    body: JSON.stringify({ version: m.latest_version.id, input: { human_img: dataUri(person), garm_img: dataUri(g.img), garment_des: g.name || category(g.category).one, category: REP_CAT[groupOf(g.category)] || 'upper_body', crop: true } }),
  });
  let p = await res.json();
  if (!res.ok) throw new Error(`Replicate: ${p.detail || res.status}`);
  for (let i = 0; i < 120 && !['succeeded', 'failed', 'canceled'].includes(p.status); i++) {
    await sleep(2000);
    p = await (await fetch(p.urls.get, { headers })).json();
  }
  if (p.status !== 'succeeded') throw new Error(`Replicate: ${p.error || p.status}`);
  return fromOutput(Array.isArray(p.output) ? p.output[0] : p.output);
}

async function fromOutput(out: string): Promise<Img> {
  const m = out.match(/^data:([^;]+);base64,(.*)$/s);
  if (m) return { mime: m[1], base64: m[2] };
  if (!/^https?:/.test(out)) return { mime: 'image/png', base64: out };
  const { buffer, mime } = await downloadRemoteImage(out);
  return { mime, base64: buffer.toString('base64') };
}
