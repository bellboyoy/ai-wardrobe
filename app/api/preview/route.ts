import { requireUser, route } from '@/lib/server/auth';
import { fetchProduct } from '@/lib/server/linkImport';

export const POST = route<{ url?: string }>(async (req, body) => {
  await requireUser(req);
  return fetchProduct(String(body.url || '').trim());
});
