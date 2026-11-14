import { engines, env, providerName, setupHint } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

export function GET() {
  const provider = providerName();
  return Response.json({ provider, aiReady: provider !== 'none', stylist: Boolean(env('GEMINI_API_KEY')), hint: provider === 'none' ? setupHint() : '', engines: engines() });
}
