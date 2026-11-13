// Pull the product photo, title, brand and price from a shop link (Vinted, SHEIN, Zara, ASOS…).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function meta(html: string, prop: string) {
  const tag = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*>`, 'i'))?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1];
}
const decode = (s?: string) =>
  (s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

type LdProduct = { name?: string; image?: string; price?: string; brand?: string; colour?: string };

function jsonLd(html: string): LdProduct {
  for (const [, body] of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(body);
      const nodes = [data, ...(Array.isArray(data) ? data : []), ...(data['@graph'] || [])];
      const p = nodes.find((n) => n && /Product/i.test(String(n['@type'])));
      if (!p) continue;
      const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
      const img = Array.isArray(p.image) ? p.image[0] : p.image;
      return {
        name: p.name,
        image: typeof img === 'string' ? img : img?.url,
        price: offer?.price ? `${currency(offer.priceCurrency)}${offer.price}` : undefined,
        brand: typeof p.brand === 'string' ? p.brand : p.brand?.name,
        colour: p.color,
      };
    } catch { /* ignore */ }
  }
  return {};
}

const currency = (c?: string) => ({ EUR: '€', GBP: '£', USD: '$' } as Record<string, string>)[String(c || '').toUpperCase()] || (c ? `${c} ` : '');

export function retailerName(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^(www|m|uk|ie|fr|de|es|it|us|eu)\./, '');
    const base = host.split('.')[0];
    const known: Record<string, string> = { vinted: 'Vinted', shein: 'SHEIN', zara: 'Zara', asos: 'ASOS', hm: 'H&M', depop: 'Depop', zalando: 'Zalando', nike: 'Nike', adidas: 'adidas', uniqlo: 'Uniqlo', cos: 'COS', mango: 'Mango' };
    return known[base] || base.charAt(0).toUpperCase() + base.slice(1);
  } catch { return ''; }
}

export async function fetchProduct(url: string) {
  let u: URL;
  try { u = new URL(url); } catch { throw new Error('That doesn\'t look like a link'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only web links are supported');
  if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(u.pathname)) return { name: '', imageUrl: url, price: '', brand: '', colour: '', retailer: retailerName(url) };
  let res: Response;
  try {
    res = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-GB,en;q=0.9', Accept: 'text/html' }, redirect: 'follow', signal: AbortSignal.timeout(20000) });
  } catch { throw new Error("Couldn't reach that shop. Upload a screenshot of the item instead."); }
  if (!res.ok) throw new Error(`The shop blocked the request (${res.status}). Upload a screenshot instead.`);
  const html = await res.text();
  const ld = jsonLd(html);
  const image = ld.image || meta(html, 'og:image') || meta(html, 'twitter:image');
  if (!image) throw new Error("Couldn't find a product photo on that page. Upload a screenshot instead.");
  const amount = meta(html, 'product:price:amount') || meta(html, 'og:price:amount');
  return {
    name: decode(ld.name || meta(html, 'og:title') || meta(html, 'twitter:title')).replace(/\s*[|–-]\s*(Vinted|SHEIN|ZARA|ASOS).*$/i, ''),
    imageUrl: new URL(decode(image), url).href,
    price: decode(ld.price || (amount ? `${currency(meta(html, 'product:price:currency') || meta(html, 'og:price:currency'))}${amount}` : '')),
    brand: decode(ld.brand || meta(html, 'product:brand') || ''),
    colour: decode(ld.colour || meta(html, 'product:color') || ''),
    retailer: retailerName(url),
  };
}

export async function downloadRemoteImage(url: string) {
  let res: Response;
  try { res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) }); }
  catch { throw new Error("Couldn't download the product photo"); }
  if (!res.ok) throw new Error(`Couldn't download the product photo (${res.status})`);
  const mime = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
  if (!mime.startsWith('image/')) throw new Error('That link is not an image');
  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > 15e6) throw new Error('That image is too large');
  return { buffer, mime };
}
