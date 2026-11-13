// Shared helpers for the serverless functions: check the login, talk to Supabase as that user.
import crypto from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export const BUCKET = 'wardrobe';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

export function env(name) {
  // Strip spaces, line breaks and invisible characters picked up when pasting into the hosting settings.
  const raw = process.env[name] || '';
  const v = name === 'ALLOWED_EMAILS' ? raw.replace(/[^\x20-\x7E]/g, '') : raw.replace(/[^\x21-\x7E]/g, '');
  if (!v) throw new HttpError(500, `${name} is not set in the hosting settings`);
  return v;
}

/** Returns a Supabase client that acts as the logged-in user (so database rules apply). */
export async function requireUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Please log in');
  const sb = createClient(env('SUPABASE_URL').replace(/\/+$/, ''), env('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Please log in again');
  const allowed = env('ALLOWED_EMAILS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!allowed.includes(String(data.user.email).toLowerCase())) throw new HttpError(403, 'This account is not allowed to use this wardrobe');
  return { sb, user: data.user };
}

/** Wrap a handler: POST only, JSON errors. */
export function handler(fn) {
  return async (req, res) => {
    try {
      if (req.method !== 'POST') throw new HttpError(405, 'Use POST');
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      await fn({ req, res, body });
    } catch (e) {
      if (!(e instanceof HttpError)) console.error(e);
      res.status(e.status || 400).json({ error: e.message || String(e) });
    }
  };
}

export async function downloadImage(sb, path) {
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error) throw new Error(`Couldn't read image: ${error.message}`);
  return { mime: data.type || 'image/jpeg', base64: Buffer.from(await data.arrayBuffer()).toString('base64') };
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif' };

export async function uploadImage(sb, user, folder, buffer, mime) {
  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${EXT[mime] || 'jpg'}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw new Error(`Couldn't save image: ${error.message}`);
  return path;
}
