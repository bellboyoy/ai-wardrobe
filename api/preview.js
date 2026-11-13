// Read a shop link and return the product photo, name, brand and price.
import { handler, requireUser } from './_lib/auth.js';
import { fetchProduct, siteName } from './_lib/linkImport.js';

export default handler(async ({ req, res, body }) => {
  await requireUser(req);
  const url = String(body.url || '').trim();
  if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(url)) return res.json({ name: 'New item', imageUrl: url, price: '', brand: '', source: siteName(url) });
  res.json(await fetchProduct(url));
});
