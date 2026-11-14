import { requireUser, route, uploadImage } from '@/lib/server/auth';
import { downloadRemoteImage } from '@/lib/server/linkImport';

// Keep a private copy of a shop's product photo in your own storage.
export const POST = route<{ imageUrl?: string }>(async (req, body) => {
  const { sb, user } = await requireUser(req);
  const img = await downloadRemoteImage(String(body.imageUrl || ''));
  return { path: await uploadImage(sb, user, 'items', img.buffer, img.mime) };
});
