// AI try-on providers. Pick one with TRYON_PROVIDER in .env: gemini | fashn | replicate | demo
// Images are passed around as { mime, base64 }. Results come back as { mime, buffer }.
import { downloadImage } from './linkImport.js';

const cleanEnv = (k) => (process.env[k] || '').replace(/[^\x21-\x7E]/g, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dataUri = ({ mime, base64 }) => `data:${mime};base64,${base64}`;

export function providerName() {
  const p = cleanEnv('TRYON_PROVIDER').toLowerCase();
  if (p) return p;
  if (cleanEnv('GEMINI_API_KEY')) return 'gemini';
  if (cleanEnv('FASHN_API_KEY')) return 'fashn';
  if (cleanEnv('REPLICATE_API_TOKEN')) return 'replicate';
  return 'demo';
}

// Layer order when dressing in several pieces one at a time
const ORDER = { 'one-piece': 0, bottom: 1, top: 2, outerwear: 3, shoes: 4, accessory: 5 };

const toResult = ({ mime, base64 }) => ({ mime, buffer: Buffer.from(base64, 'base64') });

/**
 * Dress `person` ({ mime, base64 }) in every item in `items` ({ category, name, img }).
 */
export async function runTryOn(person, items) {
  const provider = providerName();
  const sorted = [...items].sort((a, b) => (ORDER[a.category] ?? 9) - (ORDER[b.category] ?? 9));
  if (provider === 'demo') return demoTryOn(person, sorted);
  if (provider === 'gemini') return geminiTryOn(person, sorted);

  // FASHN and Replicate do one garment per call, so chain them.
  let current = person;
  for (const item of sorted) {
    const garment = item.img;
    const out = provider === 'fashn'
      ? await fashnOne(current, garment, item)
      : await replicateOne(current, garment, item);
    current = out;
  }
  return toResult(current);
}

// ---------- Gemini (Nano Banana) ----------
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

async function geminiCall(model, parts, wantImage) {
  const key = cleanEnv('GEMINI_API_KEY');
  if (!key) throw new Error('GEMINI_API_KEY is missing in .env');
  const body = { contents: [{ role: 'user', parts }] };
  if (wantImage) body.generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Gemini: ${json.error?.message || res.status}`);
  return json.candidates?.[0]?.content?.parts || [];
}

async function geminiTryOn(p, items) {
  const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-3.1-flash-image';
  const parts = [];
  parts.push({ text: 'Image 1 is a photo of me.' });
  parts.push({ inline_data: { mime_type: p.mime, data: p.base64 } });
  items.forEach((it, i) => {
    const g = it.img;
    parts.push({ text: `Image ${i + 2} is a clothing item (${it.category}${it.name ? `: ${it.name}` : ''}).` });
    parts.push({ inline_data: { mime_type: g.mime, data: g.base64 } });
  });
  parts.push({
    text:
      `Create a realistic photo of the person from image 1 wearing ${items.length > 1 ? 'all of these clothing items together as one outfit' : 'this clothing item'}. ` +
      'Keep their face, hair, skin tone, body shape, pose and the background exactly the same. ' +
      'Copy the garments faithfully: same colour, pattern, print, fabric, length and fit. ' +
      'Replace only the clothes they are wearing that the new items would cover. Ignore any other model, mannequin or text in the product photos. ' +
      'Output a single photorealistic image.',
  });
  const out = await geminiCall(model, parts, true);
  const img = out.find((x) => x.inlineData || x.inline_data);
  if (!img) {
    const text = out.map((x) => x.text).filter(Boolean).join(' ');
    throw new Error(`Gemini didn't return an image${text ? `: ${text}` : ''}`);
  }
  const d = img.inlineData || img.inline_data;
  return { mime: d.mimeType || d.mime_type || 'image/png', buffer: Buffer.from(d.data, 'base64') };
}

export async function suggestOutfits(items, request) {
  if (!cleanEnv('GEMINI_API_KEY')) throw new Error('Outfit ideas need GEMINI_API_KEY in .env');
  const model = process.env.GEMINI_TEXT_MODEL || 'gemini-flash-latest';
  const catalog = items.map((it) => `- id=${it.id} | ${it.category} | ${it.name || 'unnamed'}${it.brand ? ` | ${it.brand}` : ''}${it.notes ? ` | ${it.notes}` : ''}`).join('\n');
  const parts = [{
    text:
      `You are a friendly personal stylist. Here is my wardrobe:\n${catalog}\n\n` +
      `Request: ${request || 'Suggest 3 good outfits from my wardrobe.'}\n\n` +
      'Reply ONLY with JSON: {"outfits":[{"name":"short name","itemIds":["id",...],"why":"one sentence"}]}. ' +
      'Use only ids from the list. Each outfit needs at most one top, one bottom (or one one-piece instead of both), and optionally outerwear, shoes, accessories.',
  }];
  // Let the stylist see the clothes too (first 16 items to keep it quick)
  for (const it of items.filter((x) => x.img).slice(0, 16)) {
    const g = it.img;
    parts.push({ text: `Photo of id=${it.id}` }, { inline_data: { mime_type: g.mime, data: g.base64 } });
  }
  const out = await geminiCall(model, parts, false);
  const text = out.map((x) => x.text).filter(Boolean).join('');
  const json = text.match(/\{[\s\S]*\}/)?.[0];
  if (!json) throw new Error('The stylist gave an unexpected answer, try again');
  const ids = new Set(items.map((i) => i.id));
  return JSON.parse(json).outfits.map((o) => ({ ...o, itemIds: o.itemIds.filter((id) => ids.has(id)) })).filter((o) => o.itemIds.length);
}

// ---------- FASHN ----------
const FASHN_CAT = { top: 'tops', outerwear: 'tops', bottom: 'bottoms', 'one-piece': 'one-pieces' };

async function fashnOne(person, garment, item) {
  const key = cleanEnv('FASHN_API_KEY');
  if (!key) throw new Error('FASHN_API_KEY is missing in .env');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  const res = await fetch('https://api.fashn.ai/v1/run', {
    method: 'POST', headers,
    body: JSON.stringify({
      model_name: process.env.FASHN_MODEL || 'tryon-v1.6',
      inputs: { model_image: dataUri(person), garment_image: dataUri(garment), category: FASHN_CAT[item.category] || 'auto', mode: 'balanced', return_base64: true },
    }),
  });
  const start = await res.json().catch(() => ({}));
  if (!res.ok || start.error) throw new Error(`FASHN: ${start.error?.message || start.error || start.message || res.status}`);
  for (let i = 0; i < 90; i++) {
    await sleep(2000);
    const s = await (await fetch(`https://api.fashn.ai/v1/status/${start.id}`, { headers })).json();
    if (s.status === 'completed') return fromOutput(s.output[0]);
    if (s.status === 'failed') throw new Error(`FASHN: ${s.error?.message || s.error?.name || 'try-on failed'}`);
  }
  throw new Error('FASHN took too long');
}

// ---------- Replicate (IDM-VTON) ----------
const REP_CAT = { top: 'upper_body', outerwear: 'upper_body', bottom: 'lower_body', 'one-piece': 'dresses' };

async function replicateOne(person, garment, item) {
  const token = cleanEnv('REPLICATE_API_TOKEN');
  if (!token) throw new Error('REPLICATE_API_TOKEN is missing in .env');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const model = process.env.REPLICATE_MODEL || 'cuuupid/idm-vton';
  const m = await (await fetch(`https://api.replicate.com/v1/models/${model}`, { headers })).json();
  const version = m.latest_version?.id;
  if (!version) throw new Error(`Replicate: couldn't find model ${model}`);
  const res = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST', headers: { ...headers, Prefer: 'wait=60' },
    body: JSON.stringify({
      version,
      input: { human_img: dataUri(person), garm_img: dataUri(garment), garment_des: item.name || item.category, category: REP_CAT[item.category] || 'upper_body', crop: true },
    }),
  });
  let p = await res.json();
  if (!res.ok) throw new Error(`Replicate: ${p.detail || res.status}`);
  for (let i = 0; i < 90 && !['succeeded', 'failed', 'canceled'].includes(p.status); i++) {
    await sleep(2000);
    p = await (await fetch(p.urls.get, { headers })).json();
  }
  if (p.status !== 'succeeded') throw new Error(`Replicate: ${p.error || p.status}`);
  return fromOutput(Array.isArray(p.output) ? p.output[0] : p.output);
}

async function fromOutput(out) {
  if (out.startsWith('data:')) {
    const [, mime, base64] = out.match(/^data:([^;]+);base64,(.*)$/s);
    return { mime, base64 };
  }
  const { buffer, mime } = await downloadImage(out);
  return { mime, base64: buffer.toString('base64') };
}

// ---------- Demo (no AI, no cost) ----------
function demoTryOn(p, items) {
  const thumbs = items.slice(0, 4).map((it, i) => {
    const g = it.img;
    return `<image href="${dataUri(g)}" x="${540}" y="${20 + i * 235}" width="220" height="220" preserveAspectRatio="xMidYMid meet"/>`;
  }).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="780" height="980" viewBox="0 0 780 980">
<rect width="780" height="980" fill="#f4efe9"/>
<image href="${dataUri(p)}" x="20" y="20" width="500" height="940" preserveAspectRatio="xMidYMid slice"/>
${thumbs}
<rect x="20" y="900" width="500" height="60" fill="rgba(0,0,0,.55)"/>
<text x="270" y="938" font-family="sans-serif" font-size="22" fill="#fff" text-anchor="middle">Demo preview: add an AI key for real try-ons</text>
</svg>`;
  return { mime: 'image/svg+xml', buffer: Buffer.from(svg) };
}
