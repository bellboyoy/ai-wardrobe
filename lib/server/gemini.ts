import { apiKey, env } from './env';
import type { Img } from './auth';

const BASE = env('GEMINI_BASE_URL') || 'https://generativelanguage.googleapis.com/v1beta/models';
export type Part = { text: string } | { inline_data: { mime_type: string; data: string } };
export const imgPart = (i: Img): Part => ({ inline_data: { mime_type: i.mime, data: i.base64 } });

export async function gemini(model: string, parts: Part[], opts: { image?: boolean; json?: boolean } = {}) {
  const key = apiKey('GEMINI_API_KEY');
  if (!key) throw new Error('The AI isn\'t connected yet: add GEMINI_API_KEY in Vercel');
  const body: Record<string, unknown> = { contents: [{ role: 'user', parts }] };
  if (opts.image) body.generationConfig = { responseModalities: ['TEXT', 'IMAGE'] };
  if (opts.json) body.generationConfig = { responseMimeType: 'application/json' };
  const res = await fetch(`${BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = json.error?.message || String(res.status);
    if (/API key/i.test(msg)) throw new Error(`Gemini rejected the API key (it starts "${key.slice(0, 4)}…", ${key.length} characters). Copy a fresh key from aistudio.google.com/apikey into GEMINI_API_KEY in Vercel, then redeploy.`);
    throw new Error(`Gemini: ${msg}`);
  }
  return (json.candidates?.[0]?.content?.parts || []) as { text?: string; inlineData?: { mimeType: string; data: string }; inline_data?: { mime_type: string; data: string } }[];
}

export const textModel = () => env('GEMINI_TEXT_MODEL') || 'gemini-flash-latest';
export const imageModel = () => env('GEMINI_IMAGE_MODEL') || 'gemini-3.1-flash-image';

export function parseJson<T>(parts: { text?: string }[]): T {
  const text = parts.map((p) => p.text || '').join('');
  const m = text.match(/[[{][\s\S]*[\]}]/);
  if (!m) throw new Error('The AI gave an unexpected answer, please try again');
  return JSON.parse(m[0]) as T;
}
