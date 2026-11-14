import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY, BUCKET } from '@/lib/supabase';
import { env } from './env';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export type Img = { mime: string; base64: string };

/** A Supabase client acting as the logged-in user, so the database rules apply. */
export async function requireUser(req: Request): Promise<{ sb: SupabaseClient; user: User }> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'Please log in');
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data?.user) throw new HttpError(401, 'Please log in again');
  const allowed = env('ALLOWED_EMAILS', true).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(String(data.user.email).toLowerCase())) {
    throw new HttpError(403, 'This account is not allowed to use this wardrobe');
  }
  return { sb, user: data.user };
}

export function route<T>(fn: (req: Request, body: T) => Promise<unknown>) {
  return async (req: Request) => {
    try {
      const body = (await req.json().catch(() => ({}))) as T;
      return Response.json(await fn(req, body));
    } catch (e) {
      const err = e as HttpError;
      if (!(e instanceof HttpError)) console.error(e);
      return Response.json({ error: err.message || String(e) }, { status: err.status || 400 });
    }
  };
}

export async function downloadImage(sb: SupabaseClient, path: string): Promise<Img> {
  const { data, error } = await sb.storage.from(BUCKET).download(path);
  if (error || !data) throw new Error(`Couldn't read image: ${error?.message || 'missing'}`);
  return { mime: data.type || 'image/jpeg', base64: Buffer.from(await data.arrayBuffer()).toString('base64') };
}

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' };

export async function uploadImage(sb: SupabaseClient, user: User, folder: string, buffer: Buffer, mime: string) {
  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${EXT[mime] || 'jpg'}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, buffer, { contentType: mime, upsert: false });
  if (error) throw new Error(`Couldn't save image: ${error.message}`);
  return path;
}
