import { env, providerName } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

export function GET() {
  const provider = providerName();
  return Response.json({ provider, aiReady: provider !== 'none', stylist: Boolean(env('GEMINI_API_KEY')) });
}
