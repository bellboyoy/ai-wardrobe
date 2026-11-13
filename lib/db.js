// Tiny JSON-file database. Everything stays on your own computer in ./data
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const DATA_DIR = path.resolve(process.env.DATA_DIR || 'data');
export const FILES_DIR = path.join(DATA_DIR, 'files');
const DB_FILE = path.join(DATA_DIR, 'db.json');

fs.mkdirSync(FILES_DIR, { recursive: true });

const empty = { photos: [], items: [], tryons: [], outfits: [] };
let db = { ...empty };
if (fs.existsSync(DB_FILE)) {
  db = { ...empty, ...JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) };
}

function save() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
  fs.renameSync(tmp, DB_FILE);
}

export const newId = () => crypto.randomUUID().slice(0, 8) + Date.now().toString(36);

export function list(kind) {
  return [...db[kind]].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export function get(kind, id) {
  return db[kind].find((x) => x.id === id);
}
export function insert(kind, obj) {
  const row = { id: newId(), createdAt: new Date().toISOString(), ...obj };
  db[kind].push(row);
  save();
  return row;
}
export function update(kind, id, patch) {
  const row = get(kind, id);
  if (!row) return null;
  Object.assign(row, patch);
  save();
  return row;
}
export function remove(kind, id) {
  const row = get(kind, id);
  db[kind] = db[kind].filter((x) => x.id !== id);
  save();
  return row;
}

// --- file helpers ---
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/avif': 'avif' };
export const MIME = Object.fromEntries(Object.entries(EXT).map(([m, e]) => [e, m]));

export function saveFile(buffer, mime) {
  const name = `${newId()}.${EXT[mime] || 'jpg'}`;
  fs.writeFileSync(path.join(FILES_DIR, name), buffer);
  return name;
}
export function deleteFile(name) {
  if (!name) return;
  const p = path.join(FILES_DIR, path.basename(name));
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
export function fileAsDataUri(name) {
  const p = path.join(FILES_DIR, path.basename(name));
  const ext = path.extname(p).slice(1);
  return { mime: MIME[ext] || 'image/jpeg', base64: fs.readFileSync(p).toString('base64') };
}
