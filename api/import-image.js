// Download a product photo from a shop and keep a private copy in your storage.
import { handler, requireUser, uploadImage } from './_lib/auth.js';
import { downloadImage } from './_lib/linkImport.js';

export default handler(async ({ req, res, body }) => {
  const { sb, user } = await requireUser(req);
  const img = await downloadImage(String(body.imageUrl || ''));
  res.json({ path: await uploadImage(sb, user, 'items', img.buffer, img.mime) });
});
