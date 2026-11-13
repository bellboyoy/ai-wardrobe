// Pull the product photo, title and price from a shop link (Vinted, Shein, ASOS, Depop, etc).
// Uses the page's Open Graph / JSON-LD tags. Some shops block this; then upload a screenshot instead.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function meta(html, prop) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1];
}
const decode = (s) => s && s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

function jsonLdProduct(html) {
  const blocks = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const [, body] of blocks) {
    try {
      const data = JSON.parse(body);
      const nodes = [data, ...(Array.isArray(data) ? data : []), ...(data['@graph'] || [])];
      const p = nodes.find((n) => n && /Product/i.test(n['@type']));
      if (p) {
        const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
        return {
          name: p.name,
          image: Array.isArray(p.image) ? (p.image[0]?.url || p.image[0]) : (p.image?.url || p.image),
          price: offer?.price && `${offer.priceCurrency || ''} ${offer.price}`.trim(),
          brand: typeof p.brand === 'string' ? p.brand : p.brand?.name,
        };
      }
    } catch { /* ignore bad JSON */ }
  }
  return {};
}

export function siteName(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\.|^m\./, '');
    return host.split('.').slice(-3).join('.');
  } catch { return ''; }
}

export async function fetchProduct(url) {
  const u = new URL(url);
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http(s) links are supported');
  let res;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-GB,en;q=0.9', Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  } catch {
    throw new Error("Couldn't reach that site. Check the link, or upload a screenshot instead.");
  }
  if (!res.ok) throw new Error(`The shop returned ${res.status}. Try uploading a screenshot of the item instead.`);
  const html = await res.text();
  const ld = jsonLdProduct(html);
  const image = ld.image || meta(html, 'og:image') || meta(html, 'twitter:image');
  if (!image) throw new Error("Couldn't find a product photo on that page. Try uploading a screenshot instead.");
  return {
    name: decode(ld.name || meta(html, 'og:title') || meta(html, 'twitter:title') || 'New item'),
    imageUrl: new URL(decode(image), url).href,
    price: decode(ld.price || [meta(html, 'product:price:currency'), meta(html, 'product:price:amount')].filter(Boolean).join(' ')) || '',
    brand: decode(ld.brand || '') || '',
    source: siteName(url),
  };
}

export async function downloadImage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Couldn't download the image (${res.status})`);
  const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!mime.startsWith('image/')) throw new Error('That link is not an image');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 15 * 1024 * 1024) throw new Error('Image is too large');
  return { buffer: buf, mime };
}
