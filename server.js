import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (fs.existsSync('.env') && process.loadEnvFile) process.loadEnvFile('.env');

const express = (await import('express')).default;
const multer = (await import('multer')).default;
const db = await import('./lib/db.js');
const { fetchProduct, downloadImage, siteName } = await import('./lib/linkImport.js');
const { runTryOn, providerName, suggestOutfits } = await import('./lib/tryon.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const PASSWORD = process.env.APP_PASSWORD || '';
const PORT = Number(process.env.PORT) || 3000;
const CATEGORIES = ['top', 'bottom', 'one-piece', 'outerwear', 'shoes', 'accessory'];

// ---- privacy: password when shared on your Wi-Fi, otherwise localhost only ----
if (PASSWORD) {
  app.use((req, res, next) => {
    const [, b64] = (req.headers.authorization || '').split(' ');
    const pass = b64 ? Buffer.from(b64, 'base64').toString().split(':').slice(1).join(':') : '';
    if (pass === PASSWORD) return next();
    res.set('WWW-Authenticate', 'Basic realm="Wardrobe"').status(401).send('Password required');
  });
}

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/files', express.static(db.FILES_DIR, { maxAge: '7d' }));

const wrap = (fn) => (req, res) => Promise.resolve(fn(req, res)).catch((e) => {
  console.error(e);
  res.status(400).json({ error: e.message || String(e) });
});
const needImage = (f) => {
  if (!f) throw new Error('Please choose an image');
  if (!f.mimetype.startsWith('image/')) throw new Error('That file is not an image');
};

app.get('/api/status', (req, res) => res.json({
  provider: providerName(),
  stylist: Boolean(process.env.GEMINI_API_KEY),
  categories: CATEGORIES,
}));

// ---- Photos of you ----
app.get('/api/photos', (req, res) => res.json(db.list('photos')));
app.post('/api/photos', upload.single('image'), wrap((req, res) => {
  needImage(req.file);
  const first = db.list('photos').length === 0;
  res.json(db.insert('photos', { file: db.saveFile(req.file.buffer, req.file.mimetype), label: req.body.label || '', isDefault: first }));
}));
app.patch('/api/photos/:id', wrap((req, res) => {
  if (req.body.isDefault) db.list('photos').forEach((p) => db.update('photos', p.id, { isDefault: p.id === req.params.id }));
  if ('label' in req.body) db.update('photos', req.params.id, { label: req.body.label });
  res.json(db.get('photos', req.params.id));
}));
app.delete('/api/photos/:id', wrap((req, res) => {
  const row = db.remove('photos', req.params.id);
  db.deleteFile(row?.file);
  res.json({ ok: true });
}));

// ---- Clothing items ----
app.get('/api/items', (req, res) => res.json(db.list('items')));
app.post('/api/items/preview', wrap(async (req, res) => {
  const url = String(req.body.url || '').trim();
  if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(url)) return res.json({ name: 'New item', imageUrl: url, price: '', brand: '', source: siteName(url) });
  res.json(await fetchProduct(url));
}));
function itemFields(b) {
  const category = CATEGORIES.includes(b.category) ? b.category : 'top';
  return { name: (b.name || '').slice(0, 200), category, brand: b.brand || '', price: b.price || '', url: b.url || '', source: b.source || (b.url ? siteName(b.url) : ''), notes: b.notes || '', status: b.status === 'owned' ? 'owned' : 'wishlist' };
}
app.post('/api/items', upload.single('image'), wrap(async (req, res) => {
  let file;
  if (req.file) { needImage(req.file); file = db.saveFile(req.file.buffer, req.file.mimetype); }
  else if (req.body.imageUrl) { const img = await downloadImage(req.body.imageUrl); file = db.saveFile(img.buffer, img.mime); }
  else throw new Error('Add a photo or a link');
  res.json(db.insert('items', { file, ...itemFields(req.body) }));
}));
app.patch('/api/items/:id', wrap((req, res) => {
  const cur = db.get('items', req.params.id);
  if (!cur) throw new Error('Not found');
  res.json(db.update('items', req.params.id, itemFields({ ...cur, ...req.body })));
}));
app.delete('/api/items/:id', wrap((req, res) => {
  const row = db.remove('items', req.params.id);
  db.deleteFile(row?.file);
  db.list('outfits').forEach((o) => db.update('outfits', o.id, { itemIds: o.itemIds.filter((i) => i !== req.params.id) }));
  res.json({ ok: true });
}));

// ---- Try-ons (run in the background, the page polls) ----
app.get('/api/tryons', (req, res) => res.json(db.list('tryons')));
app.post('/api/tryons', wrap((req, res) => {
  const photo = db.get('photos', req.body.photoId) || db.list('photos').find((p) => p.isDefault);
  if (!photo) throw new Error('Add a photo of yourself first (Me tab)');
  const items = (req.body.itemIds || []).map((id) => db.get('items', id)).filter(Boolean);
  if (!items.length) throw new Error('Pick at least one item');
  const row = db.insert('tryons', { photoId: photo.id, itemIds: items.map((i) => i.id), outfitId: req.body.outfitId || null, provider: providerName(), status: 'running', file: null, error: null });
  runTryOn(photo, items)
    .then((file) => {
      db.update('tryons', row.id, { status: 'done', file });
      if (row.outfitId) db.update('outfits', row.outfitId, { tryonId: row.id });
    })
    .catch((e) => { console.error(e); db.update('tryons', row.id, { status: 'error', error: e.message }); });
  res.json(row);
}));
app.delete('/api/tryons/:id', wrap((req, res) => {
  const row = db.remove('tryons', req.params.id);
  db.deleteFile(row?.file);
  res.json({ ok: true });
}));

// ---- Outfits ----
app.get('/api/outfits', (req, res) => res.json(db.list('outfits')));
app.post('/api/outfits', wrap((req, res) => {
  const itemIds = (req.body.itemIds || []).filter((id) => db.get('items', id));
  if (!itemIds.length) throw new Error('Pick at least one item');
  res.json(db.insert('outfits', { name: req.body.name || 'New outfit', itemIds, tryonId: req.body.tryonId || null, notes: req.body.notes || '' }));
}));
app.patch('/api/outfits/:id', wrap((req, res) => {
  const { name, itemIds, tryonId, notes } = req.body;
  const patch = Object.fromEntries(Object.entries({ name, itemIds, tryonId, notes }).filter(([, v]) => v !== undefined));
  res.json(db.update('outfits', req.params.id, patch));
}));
app.delete('/api/outfits/:id', wrap((req, res) => { db.remove('outfits', req.params.id); res.json({ ok: true }); }));

// ---- AI stylist ----
app.post('/api/suggest', wrap(async (req, res) => {
  const items = db.list('items');
  if (items.length < 2) throw new Error('Add a few items first');
  res.json(await suggestOutfits(items, req.body.request));
}));

const host = PASSWORD ? '0.0.0.0' : '127.0.0.1';
app.listen(PORT, host, () => {
  console.log(`\n  AI Wardrobe running at http://localhost:${PORT}`);
  console.log(`  Try-on AI: ${providerName()}${providerName() === 'demo' ? ' (add a key in .env for real try-ons)' : ''}`);
  if (PASSWORD) console.log('  Open from your phone at http://<this-computer-ip>:' + PORT + ' (password protected)');
  else console.log('  Only this computer can open it. Set APP_PASSWORD in .env to use it from your phone.');
});
