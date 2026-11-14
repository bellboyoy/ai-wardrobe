'use client';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, BUCKET } from './supabase';
import { shrink } from './image';
import type { AppConfig, Item, Look, Outfit, Photo, Profile } from './types';

const EMPTY_PROFILE: Profile = { display_name: '', city: '', budget: '', sizes: {}, measurements: {}, styles: [], brands: [] };

type Store = ReturnType<typeof useStoreState>;
const Ctx = createContext<Store | null>(null);

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore outside provider');
  return s;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const value = useStoreState();
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data;
}

function useStoreState() {
  const sb = supabase();
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [config, setConfig] = useState<AppConfig>({ provider: 'none', aiReady: false, stylist: false });
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [looks, setLooks] = useState<Look[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [loaded, setLoaded] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const urlExp = useRef<Record<string, number>>({});

  // ---------- auth ----------
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = sb.auth.onAuthStateChange((_e, session) => setUser(session?.user ?? null));
    fetch('/api/config').then((r) => r.json()).then(setConfig).catch(() => {});
    return () => data.subscription.unsubscribe();
  }, [sb]);

  const signIn = async (email: string, password: string) => {
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Wrong email or password' : error.message);
  };
  const signOut = async () => { await sb.auth.signOut(); setLoaded(false); };

  // ---------- images ----------
  const sign = useCallback(async (paths: (string | null | undefined)[]) => {
    const now = Date.now();
    const need = [...new Set(paths.filter(Boolean) as string[])].filter((p) => !(urlExp.current[p] > now));
    if (!need.length) return;
    const fresh: Record<string, string> = {};
    for (let i = 0; i < need.length; i += 100) {
      const list = check(await sb.storage.from(BUCKET).createSignedUrls(need.slice(i, i + 100), 3600)) || [];
      for (const x of list) if (x.signedUrl && x.path) { fresh[x.path] = x.signedUrl; urlExp.current[x.path] = now + 50 * 60_000; }
    }
    setUrls((u) => ({ ...u, ...fresh }));
  }, [sb]);
  const url = (path?: string | null) => (path ? urls[path] || '' : '');

  // ---------- loading ----------
  const all = useCallback(async <T,>(table: string) => check(await sb.from(table).select('*').order('created_at', { ascending: false })) as T[], [sb]);

  const refresh = useCallback(async () => {
    const [p, i, l, o, prof] = await Promise.all([
      all<Photo>('photos'), all<Item>('items'), all<Look>('tryons'), all<Outfit>('outfits'),
      sb.from('profiles').select('*').maybeSingle(),
    ]);
    const stale = (x: Look) => x.status === 'running' && Date.now() - new Date(x.created_at).getTime() > 6 * 60_000;
    const lk = l.map((x) => (stale(x) ? { ...x, status: 'error' as const, error: 'Timed out, please try again' } : x));
    await sign([...p.map((x) => x.path), ...i.map((x) => x.path), ...lk.map((x) => x.path)]);
    setPhotos(p); setItems(i); setLooks(lk); setOutfits(o);
    setProfile({ ...EMPTY_PROFILE, ...((prof.data as Profile) || {}) });
    setLoaded(true);
  }, [all, sb, sign]);

  useEffect(() => { if (user) refresh().catch((e) => console.error(e)); }, [user, refresh]);

  // poll while a try-on is running
  const running = looks.some((l) => l.status === 'running');
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => refresh().catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [running, refresh]);

  // ---------- server functions ----------
  const api = async <T,>(name: string, body: unknown): Promise<T> => {
    const { data } = await sb.auth.getSession();
    const res = await fetch(`/api/${name}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session?.access_token || ''}` },
      body: JSON.stringify(body ?? {}),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Something went wrong (${res.status})`);
    return json as T;
  };

  const upload = async (file: Blob, folder: string) => {
    const blob = await shrink(file);
    const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${user!.id}/${folder}/${crypto.randomUUID()}.${ext}`;
    check(await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg' }));
    await sign([path]);
    return path;
  };
  const removeFile = async (path?: string | null) => { if (path) await sb.storage.from(BUCKET).remove([path]); };

  // ---------- photos ----------
  const addPhoto = async (file: File, angle: Photo['angle']) => {
    const path = await upload(file, 'photos');
    const { data: main } = await sb.from('photos').select('id').eq('is_default', true).limit(1);
    check(await sb.from('photos').insert({ path, angle, is_default: !main?.length }));
    await refresh();
  };
  const replacePhoto = async (p: Photo, file: File) => {
    const path = await upload(file, 'photos');
    check(await sb.from('photos').update({ path }).eq('id', p.id));
    await removeFile(p.path);
    await refresh();
  };
  const buildStudio = async () => {
    try { return await api<{ photo: Photo; used: number }>('avatar', {}); } finally { await refresh(); }
  };
  const updatePhoto = async (id: string, patch: Partial<Photo>) => {
    if (patch.is_default) check(await sb.from('photos').update({ is_default: false }).neq('id', id));
    check(await sb.from('photos').update(patch).eq('id', id));
    await refresh();
  };
  const deletePhoto = async (p: Photo) => {
    check(await sb.from('photos').delete().eq('id', p.id));
    await removeFile(p.path);
    if (p.is_default) {
      const next = photos.find((x) => x.id !== p.id);
      if (next) check(await sb.from('photos').update({ is_default: true }).eq('id', next.id));
    }
    await refresh();
  };

  // ---------- items ----------
  const uploadItemImage = (file: File) => upload(file, 'items');
  const importItemImage = async (imageUrl: string) => (await api<{ path: string }>('import-image', { imageUrl })).path;
  const addItem = async (fields: Partial<Item> & { path: string }) => {
    const row = check(await sb.from('items').insert(fields).select().single()) as Item;
    await refresh();
    return row;
  };
  const updateItem = async (id: string, patch: Partial<Item>) => {
    setItems((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    check(await sb.from('items').update(patch).eq('id', id));
  };
  const deleteItem = async (it: Item) => {
    check(await sb.from('items').delete().eq('id', it.id));
    await removeFile(it.path);
    for (const o of outfits.filter((o) => o.item_ids.includes(it.id))) {
      check(await sb.from('outfits').update({ item_ids: o.item_ids.filter((x) => x !== it.id) }).eq('id', o.id));
    }
    await refresh();
  };

  // ---------- looks (try-on results) ----------
  const tryOn = async (args: { photoId?: string; itemIds: string[]; outfitId?: string; engine?: string }) => {
    const req = api<Look>('tryon', args);
    setTimeout(() => refresh().catch(() => {}), 1200);
    try { return await req; } finally { await refresh(); }
  };
  const updateLook = async (id: string, patch: Partial<Look>) => {
    setLooks((list) => list.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    check(await sb.from('tryons').update(patch).eq('id', id));
  };
  const deleteLook = async (l: Look) => {
    check(await sb.from('tryons').delete().eq('id', l.id));
    await removeFile(l.path);
    await refresh();
  };

  // ---------- outfits ----------
  const addOutfit = async (o: Partial<Outfit>) => {
    const row = check(await sb.from('outfits').insert({ name: o.name || 'Untitled look', item_ids: o.item_ids || [], tryon_id: o.tryon_id || null, notes: o.notes || '', tags: o.tags || [] }).select().single()) as Outfit;
    await refresh();
    return row;
  };
  const updateOutfit = async (id: string, patch: Partial<Outfit>) => {
    setOutfits((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));
    check(await sb.from('outfits').update(patch).eq('id', id));
  };
  const deleteOutfit = async (id: string) => { check(await sb.from('outfits').delete().eq('id', id)); await refresh(); };

  // ---------- profile ----------
  const saveProfile = async (p: Profile) => {
    const { user_id: _ignored, ...rest } = p;
    check(await sb.from('profiles').upsert({ ...rest, user_id: user!.id, updated_at: new Date().toISOString() }));
    setProfile(p);
  };

  const avatar = useMemo(() => photos.find((p) => p.is_default) || photos[0], [photos]);
  const itemById = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);

  return {
    user, config, loaded, photos, items, looks, outfits, profile, avatar, itemById, url, refresh, api, signIn, signOut,
    removeFile, addPhoto, replacePhoto, updatePhoto, buildStudio, deletePhoto, uploadItemImage, importItemImage, addItem, updateItem, deleteItem,
    tryOn, updateLook, deleteLook, addOutfit, updateOutfit, deleteOutfit, saveProfile,
  };
}
