const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const img = (file) => `/files/${encodeURIComponent(file)}`;
const LABEL = { top: 'Tops', bottom: 'Bottoms', 'one-piece': 'Dresses & one-pieces', outerwear: 'Outerwear', shoes: 'Shoes', accessory: 'Accessories' };
const SHORT = { top: 'Top', bottom: 'Bottom', 'one-piece': 'One-piece', outerwear: 'Outerwear', shoes: 'Shoes', accessory: 'Accessory' };

const state = { status: {}, photos: [], items: [], tryons: [], outfits: [], filter: 'all', studioFilter: 'all', selected: new Set(), photoId: null };

async function api(path, opts = {}) {
  const init = { ...opts };
  if (opts.json) { init.body = JSON.stringify(opts.json); init.headers = { 'Content-Type': 'application/json' }; init.method ||= 'POST'; }
  const res = await fetch(path, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3500);
}
function view(file) { $('#viewer-img').src = img(file); $('#viewer').showModal(); }

// ---------- navigation ----------
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => show(b.dataset.view)));
function show(name) {
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== `view-${name}`));
  try { localStorage.setItem('tab', name); } catch {}
  window.scrollTo(0, 0);
}

// ---------- loading ----------
async function load() {
  [state.status, state.photos, state.items, state.tryons, state.outfits] = await Promise.all(
    ['/api/status', '/api/photos', '/api/items', '/api/tryons', '/api/outfits'].map((p) => api(p)));
  if (!state.photoId || !state.photos.find((p) => p.id === state.photoId)) state.photoId = (state.photos.find((p) => p.isDefault) || state.photos[0])?.id;
  const prov = { gemini: 'Gemini AI', fashn: 'FASHN AI', replicate: 'Replicate AI', demo: 'Demo mode' }[state.status.provider] || state.status.provider;
  $('#provider').textContent = prov;
  render();
  if (state.tryons.some((t) => t.status === 'running')) setTimeout(refreshTryons, 2500);
}
async function refreshTryons() {
  const before = state.tryons.filter((t) => t.status === 'running').length;
  state.tryons = await api('/api/tryons');
  state.outfits = await api('/api/outfits');
  const running = state.tryons.filter((t) => t.status === 'running').length;
  if (running < before) {
    const latest = state.tryons.find((t) => t.status !== 'running');
    if (latest?.status === 'error') toast('Try-on failed: ' + latest.error); else toast('Your look is ready ✨');
  }
  renderTryons(); renderOutfits();
  if (running) setTimeout(refreshTryons, 2500);
}

function render() { renderFilters(); renderItems(); renderStudio(); renderTryons(); renderOutfits(); renderPhotos(); }

function chipRow(el, current, onPick) {
  const cats = ['all', ...state.status.categories.filter((c) => state.items.some((i) => i.category === c))];
  el.innerHTML = cats.map((c) => `<button class="chip ${c === current ? 'on' : ''}" data-c="${c}">${c === 'all' ? 'All' : LABEL[c]}</button>`).join('');
  el.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => onPick(b.dataset.c)));
}
function renderFilters() {
  chipRow($('#cat-filter'), state.filter, (c) => { state.filter = c; renderFilters(); renderItems(); });
  chipRow($('#studio-filter'), state.studioFilter, (c) => { state.studioFilter = c; renderFilters(); renderStudio(); });
}

// ---------- wardrobe ----------
function renderItems() {
  const items = state.items.filter((i) => state.filter === 'all' || i.category === state.filter);
  $('#items-empty').hidden = state.items.length > 0;
  $('#items').innerHTML = items.map((i) => `
    <div class="tile" data-id="${i.id}">
      ${i.status === 'wishlist' ? '<span class="badge">Wishlist</span>' : ''}
      <img src="${img(i.file)}" alt="" loading="lazy">
      <div class="meta"><b>${esc(i.name || SHORT[i.category])}</b><span>${esc([SHORT[i.category], i.source, i.price].filter(Boolean).join(' · '))}</span></div>
      <div class="actions">
        <button class="icon-btn" data-act="try">Try on</button>
        <select class="icon-btn" data-act="cat">${state.status.categories.map((c) => `<option value="${c}" ${c === i.category ? 'selected' : ''}>${SHORT[c]}</option>`).join('')}</select>
        ${i.url ? `<a class="icon-btn" href="${esc(i.url)}" target="_blank" rel="noopener">Shop</a>` : ''}
        <button class="icon-btn" data-act="del">Delete</button>
      </div>
    </div>`).join('');
  $('#items').querySelectorAll('.tile').forEach((t) => {
    const id = t.dataset.id;
    t.querySelector('img').addEventListener('click', () => view(state.items.find((i) => i.id === id).file));
    t.querySelector('[data-act=try]').addEventListener('click', () => { state.selected = new Set([id]); show('studio'); renderStudio(); });
    t.querySelector('[data-act=cat]').addEventListener('change', async (e) => { await api(`/api/items/${id}`, { method: 'PATCH', json: { category: e.target.value } }); load(); });
    t.querySelector('[data-act=del]').addEventListener('click', async () => { if (confirm('Delete this item?')) { await api(`/api/items/${id}`, { method: 'DELETE' }); state.selected.delete(id); load(); } });
  });
}

// ---------- add item dialog ----------
let pending = null; // { file } or { imageUrl, url }
const dlg = $('#add-dialog');
$('#add-item-btn').addEventListener('click', () => {
  pending = null; $('#add-form').reset();
  $('#item-preview').hidden = true; $('#fetch-error').textContent = ''; $('#add-error').textContent = '';
  setMode('link'); dlg.showModal(); $('#link-input').focus();
});
$('#f-category').innerHTML = Object.entries(SHORT).map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
function setMode(m) {
  document.querySelectorAll('.seg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === m));
  $('#mode-link').hidden = m !== 'link'; $('#mode-upload').hidden = m !== 'upload';
}
function guessCategory(name) {
  const n = (name || '').toLowerCase();
  if (/dress|jumpsuit|playsuit|romper|bodysuit|co-?ord/.test(n)) return 'one-piece';
  if (/jean|trouser|pant|short|skirt|legging|jogger|cargo/.test(n)) return 'bottom';
  if (/jacket|coat|blazer|parka|puffer|gilet|cardigan/.test(n)) return 'outerwear';
  if (/shoe|trainer|sneaker|boot|heel|sandal|loafer/.test(n)) return 'shoes';
  if (/bag|hat|cap|belt|scarf|necklace|earring|sunglass|watch/.test(n)) return 'accessory';
  return 'top';
}
function showPreview(src, info = {}) {
  $('#preview-img').src = src;
  $('#f-name').value = info.name || ''; $('#f-brand').value = info.brand || ''; $('#f-price').value = info.price || '';
  $('#f-category').value = guessCategory(info.name); $('#item-preview').hidden = false;
}
async function fetchLink() {
  const url = $('#link-input').value.trim();
  if (!url) return;
  $('#fetch-error').textContent = ''; $('#link-fetch').disabled = true; $('#link-fetch').textContent = 'Fetching…';
  try {
    const info = await api('/api/items/preview', { json: { url } });
    pending = { imageUrl: info.imageUrl, url, source: info.source };
    showPreview(info.imageUrl, info);
  } catch (e) { $('#fetch-error').textContent = e.message; }
  finally { $('#link-fetch').disabled = false; $('#link-fetch').textContent = 'Fetch'; }
}
$('#link-fetch').addEventListener('click', fetchLink);
$('#link-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fetchLink(); } });
$('#link-input').addEventListener('paste', () => setTimeout(fetchLink, 50));
$('#item-file').addEventListener('change', (e) => {
  const f = e.target.files[0]; if (!f) return;
  pending = { file: f }; showPreview(URL.createObjectURL(f), { name: f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ') });
});
$('#item-save').addEventListener('click', async () => {
  if (!pending) return;
  const fd = new FormData();
  if (pending.file) fd.append('image', pending.file);
  else { fd.append('imageUrl', pending.imageUrl); fd.append('url', pending.url); fd.append('source', pending.source || ''); }
  for (const k of ['name', 'category', 'brand', 'price', 'status']) fd.append(k, $(`#f-${k}`).value);
  const btn = $('#item-save'); btn.disabled = true; btn.textContent = 'Saving…';
  try { await api('/api/items', { method: 'POST', body: fd }); dlg.close(); toast('Added to your wardrobe'); load(); }
  catch (e) { $('#add-error').textContent = e.message; }
  finally { btn.disabled = false; btn.textContent = 'Save to wardrobe'; }
});

// ---------- studio ----------
function renderStudio() {
  $('#studio-photos').innerHTML = state.photos.length
    ? state.photos.map((p) => `<div class="tile ${p.id === state.photoId ? 'sel' : ''}" data-id="${p.id}"><span class="check">✓</span><img src="${img(p.file)}" alt=""></div>`).join('')
    : '<p class="hint">No photos yet. Add one in the <b>Me</b> tab.</p>';
  $('#studio-photos').querySelectorAll('.tile').forEach((t) => t.addEventListener('click', () => { state.photoId = t.dataset.id; renderStudio(); }));
  const items = state.items.filter((i) => state.studioFilter === 'all' || i.category === state.studioFilter);
  $('#studio-items').innerHTML = items.map((i) => `<div class="tile ${state.selected.has(i.id) ? 'sel' : ''}" data-id="${i.id}"><span class="check">✓</span><img src="${img(i.file)}" alt="" loading="lazy"><div class="meta"><span>${SHORT[i.category]}</span></div></div>`).join('')
    || '<p class="hint">Add some clothes in the Wardrobe tab first.</p>';
  $('#studio-items').querySelectorAll('.tile').forEach((t) => t.addEventListener('click', () => {
    const id = t.dataset.id;
    state.selected.has(id) ? state.selected.delete(id) : state.selected.add(id);
    renderStudio();
  }));
  const n = state.selected.size;
  $('#studio-count').textContent = `${n} selected`;
  $('#studio-go').disabled = !n || !state.photoId; $('#studio-save').disabled = !n;
}
async function startTryOn(itemIds, outfitId) {
  try {
    await api('/api/tryons', { json: { photoId: state.photoId, itemIds, outfitId } });
    toast('Creating your look… this takes 10 to 60 seconds');
    await load();
  } catch (e) { toast(e.message); }
}
$('#studio-go').addEventListener('click', () => startTryOn([...state.selected]));
$('#studio-save').addEventListener('click', async () => {
  const name = prompt('Name this outfit', 'New outfit'); if (name === null) return;
  const last = state.tryons.find((t) => t.status === 'done' && sameSet(t.itemIds, [...state.selected]));
  await api('/api/outfits', { json: { name, itemIds: [...state.selected], tryonId: last?.id } });
  toast('Outfit saved'); load();
});
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

function renderTryons() {
  $('#tryons-empty').hidden = state.tryons.length > 0;
  $('#tryons').innerHTML = state.tryons.map((t) => {
    const thumbs = t.itemIds.map((id) => state.items.find((i) => i.id === id)).filter(Boolean).map((i) => `<img src="${img(i.file)}" alt="">`).join('');
    const body = t.status === 'running' ? '<div class="spinner">Dressing you…</div>'
      : t.status === 'error' ? `<div class="spinner" style="color:var(--err)">⚠ ${esc(t.error)}</div>`
      : `<img src="${img(t.file)}" alt="" data-view="${t.file}">`;
    return `<div class="tile" data-id="${t.id}">${t.provider === 'demo' ? '<span class="badge">Demo</span>' : ''}${body}
      <div class="meta"><div class="thumbs">${thumbs}</div></div>
      <div class="actions">${t.status === 'done' ? '<button class="icon-btn" data-act="save">Save outfit</button>' : ''}<button class="icon-btn" data-act="del">Delete</button></div></div>`;
  }).join('');
  $('#tryons').querySelectorAll('.tile').forEach((el) => {
    const t = state.tryons.find((x) => x.id === el.dataset.id);
    el.querySelector('[data-view]')?.addEventListener('click', () => view(t.file));
    el.querySelector('[data-act=save]')?.addEventListener('click', async () => {
      const name = prompt('Name this outfit', 'New outfit'); if (name === null) return;
      await api('/api/outfits', { json: { name, itemIds: t.itemIds, tryonId: t.id } }); toast('Outfit saved'); load();
    });
    el.querySelector('[data-act=del]').addEventListener('click', async () => { await api(`/api/tryons/${t.id}`, { method: 'DELETE' }); load(); });
  });
}

// ---------- outfits ----------
function renderOutfits() {
  $('#outfits-empty').hidden = state.outfits.length > 0;
  $('#outfits').innerHTML = state.outfits.map((o) => {
    const t = state.tryons.find((x) => x.id === o.tryonId);
    const running = state.tryons.some((x) => x.outfitId === o.id && x.status === 'running');
    const look = t?.file ? `<img class="look" src="${img(t.file)}" data-view="${t.file}" alt="">`
      : `<div class="look placeholder">${running ? 'Generating…' : 'No look yet'}</div>`;
    const thumbs = o.itemIds.map((id) => state.items.find((i) => i.id === id)).filter(Boolean).map((i) => `<img src="${img(i.file)}" title="${esc(i.name)}" alt="">`).join('');
    return `<div class="outfit" data-id="${o.id}">${look}<div>
      <h3>${esc(o.name)}</h3>${o.notes ? `<p class="hint">${esc(o.notes)}</p>` : ''}<div class="thumbs">${thumbs}</div>
      <div class="row"><button class="btn" data-act="gen" ${running ? 'disabled' : ''}>${t ? 'Regenerate look' : 'Generate look'}</button><button class="btn ghost" data-act="del">Delete</button></div></div></div>`;
  }).join('');
  $('#outfits').querySelectorAll('.outfit').forEach((el) => {
    const o = state.outfits.find((x) => x.id === el.dataset.id);
    el.querySelector('[data-view]')?.addEventListener('click', (e) => view(e.target.dataset.view));
    el.querySelector('[data-act=gen]').addEventListener('click', () => startTryOn(o.itemIds, o.id));
    el.querySelector('[data-act=del]').addEventListener('click', async () => { if (confirm('Delete this outfit?')) { await api(`/api/outfits/${o.id}`, { method: 'DELETE' }); load(); } });
  });
}
$('#stylist-go').addEventListener('click', async () => {
  const btn = $('#stylist-go'); btn.disabled = true; btn.textContent = 'Thinking…';
  try {
    const list = await api('/api/suggest', { json: { request: $('#stylist-q').value } });
    $('#suggestions').innerHTML = list.map((s, n) => `<div class="suggestion"><b>${esc(s.name)}</b><p class="hint">${esc(s.why)}</p>
      <div class="thumbs">${s.itemIds.map((id) => state.items.find((i) => i.id === id)).filter(Boolean).map((i) => `<img src="${img(i.file)}" alt="">`).join('')}</div>
      <button class="btn" data-n="${n}">Save outfit</button></div>`).join('') || '<p class="hint">No ideas this time, try rephrasing.</p>';
    $('#suggestions').querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', async () => {
      const s = list[b.dataset.n];
      await api('/api/outfits', { json: { name: s.name, itemIds: s.itemIds, notes: s.why } });
      b.textContent = 'Saved ✓'; b.disabled = true; load();
    }));
  } catch (e) { toast(e.message); }
  finally { btn.disabled = false; btn.textContent = 'Ask'; }
});
$('#stylist-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#stylist-go').click(); });

// ---------- me ----------
function renderPhotos() {
  $('#photos-empty').hidden = state.photos.length > 0;
  $('#photos').innerHTML = state.photos.map((p) => `<div class="tile" data-id="${p.id}">${p.isDefault ? '<span class="badge">★ Default</span>' : ''}
    <img src="${img(p.file)}" alt=""><div class="actions">${p.isDefault ? '' : '<button class="icon-btn" data-act="def">Make default</button>'}<button class="icon-btn" data-act="del">Delete</button></div></div>`).join('');
  $('#photos').querySelectorAll('.tile').forEach((el) => {
    const id = el.dataset.id;
    el.querySelector('img').addEventListener('click', () => view(state.photos.find((p) => p.id === id).file));
    el.querySelector('[data-act=def]')?.addEventListener('click', async () => { await api(`/api/photos/${id}`, { method: 'PATCH', json: { isDefault: true } }); state.photoId = id; load(); });
    el.querySelector('[data-act=del]').addEventListener('click', async () => { if (confirm('Delete this photo?')) { await api(`/api/photos/${id}`, { method: 'DELETE' }); load(); } });
  });
}
$('#photo-input').addEventListener('change', async (e) => {
  for (const f of e.target.files) {
    const fd = new FormData(); fd.append('image', f);
    try { await api('/api/photos', { method: 'POST', body: fd }); } catch (err) { toast(err.message); }
  }
  e.target.value = ''; toast('Photo added'); load();
});

let startTab = 'wardrobe';
try { startTab = localStorage.getItem('tab') || 'wardrobe'; } catch {}
show(startTab);
load().catch((e) => toast(e.message));
