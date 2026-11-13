// Talks to Supabase (login, database, private photo storage) and to our /api functions.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';

export const cfg = await (await fetch('/api/config')).json();
export const sb = cfg.supabaseUrl ? createClient(cfg.supabaseUrl, cfg.supabaseAnonKey) : null;
const BUCKET = 'wardrobe';

export async function currentUser() {
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user || null;
}
export async function signIn(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(error.message);
}
export const signOut = () => sb.auth.signOut();

const check = ({ data, error }) => { if (error) throw new Error(error.message); return data; };

// ---- calls to our serverless functions ----
export async function api(name, body) {
  const { data } = await sb.auth.getSession();
  const res = await fetch(`/api/${name}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
    body: JSON.stringify(body || {}),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}

// ---- private image links (signed, valid for an hour) ----
const urls = new Map();
export const urlOf = (path) => urls.get(path)?.url || '';
export async function signAll(paths) {
  const now = Date.now();
  const need = [...new Set(paths.filter(Boolean))].filter((p) => !(urls.get(p)?.exp > now));
  for (let i = 0; i < need.length; i += 100) {
    const list = check(await sb.storage.from(BUCKET).createSignedUrls(need.slice(i, i + 100), 3600));
    list.forEach((x) => x.signedUrl && urls.set(x.path, { url: x.signedUrl, exp: now + 50 * 60 * 1000 }));
  }
}

// ---- shrink big phone photos before upload ----
async function shrink(file, max = 1600) {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  if (scale === 1 && file.size < 2.5e6) return file;
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
  const ctx = c.getContext('2d');
  if (file.type !== 'image/jpeg') { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
}
async function uploadFile(file, folder) {
  const user = await currentUser();
  const blob = await shrink(file);
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${user.id}/${folder}/${crypto.randomUUID()}.${ext}`;
  check(await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg' }));
  return path;
}
const removeFile = (path) => path && sb.storage.from(BUCKET).remove([path]);

// ---- rows: database shape -> the shape the page uses ----
const photo = (r) => ({ id: r.id, file: r.path, isDefault: r.is_default, createdAt: r.created_at });
const item = (r) => ({ id: r.id, file: r.path, name: r.name, category: r.category, brand: r.brand, price: r.price, url: r.url, source: r.source, notes: r.notes, status: r.status, createdAt: r.created_at });
const tryon = (r) => {
  const stale = r.status === 'running' && Date.now() - new Date(r.created_at) > 6 * 60 * 1000;
  return { id: r.id, photoId: r.photo_id, itemIds: r.item_ids, outfitId: r.outfit_id, provider: r.provider, status: stale ? 'error' : r.status, error: stale ? 'Timed out, try again' : r.error, file: r.path, createdAt: r.created_at };
};
const outfit = (r) => ({ id: r.id, name: r.name, itemIds: r.item_ids, tryonId: r.tryon_id, notes: r.notes, createdAt: r.created_at });
const all = async (table, map) => check(await sb.from(table).select('*').order('created_at', { ascending: false })).map(map);

export const listPhotos = () => all('photos', photo);
export const listItems = () => all('items', item);
export const listTryons = () => all('tryons', tryon);
export const listOutfits = () => all('outfits', outfit);

export async function addPhoto(file) {
  const first = (await listPhotos()).length === 0;
  const path = await uploadFile(file, 'photos');
  check(await sb.from('photos').insert({ path, is_default: first }));
}
export async function setDefaultPhoto(id) {
  check(await sb.from('photos').update({ is_default: false }).neq('id', id));
  check(await sb.from('photos').update({ is_default: true }).eq('id', id));
}
export async function deletePhoto(p) { check(await sb.from('photos').delete().eq('id', p.id)); await removeFile(p.file); }

export async function addItem({ file, imageUrl, ...fields }) {
  const path = file ? await uploadFile(file, 'items') : (await api('import-image', { imageUrl })).path;
  check(await sb.from('items').insert({ path, ...fields }));
}
export async function updateItem(id, patch) { check(await sb.from('items').update(patch).eq('id', id)); }
export async function deleteItem(it, outfits) {
  check(await sb.from('items').delete().eq('id', it.id));
  await removeFile(it.file);
  for (const o of outfits.filter((o) => o.itemIds.includes(it.id))) {
    check(await sb.from('outfits').update({ item_ids: o.itemIds.filter((x) => x !== it.id) }).eq('id', o.id));
  }
}

export async function deleteTryon(t) { check(await sb.from('tryons').delete().eq('id', t.id)); await removeFile(t.file); }

export async function addOutfit({ name, itemIds, tryonId, notes }) {
  check(await sb.from('outfits').insert({ name: name || 'New outfit', item_ids: itemIds, tryon_id: tryonId || null, notes: notes || '' }));
}
export async function deleteOutfit(id) { check(await sb.from('outfits').delete().eq('id', id)); }
