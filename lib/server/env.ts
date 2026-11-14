// Read a setting, dropping spaces, line breaks and invisible characters picked up when pasting.
export function env(name: string, keepSpaces = false) {
  const raw = process.env[name] || '';
  return keepSpaces ? raw.replace(/[^\x20-\x7E]/g, '').trim() : raw.replace(/[^\x21-\x7E]/g, '');
}

// An API key, forgiving common paste mistakes: surrounding quotes, or "NAME=value" pasted whole.
export function apiKey(name: string) {
  const v = env(name).replace(/^['"`]+|['"`]+$/g, '');
  const google = v.match(/AIza[0-9A-Za-z_-]{35}/);
  if (google) return google[0];
  return v.includes('=') && v.startsWith(name) ? v.slice(name.length + 1) : v;
}

export function providerName(): 'gemini' | 'fashn' | 'replicate' | 'none' {
  const p = env('TRYON_PROVIDER').toLowerCase();
  if (p === 'gemini' && env('GEMINI_API_KEY')) return 'gemini';
  if (p === 'fashn' && env('FASHN_API_KEY')) return 'fashn';
  if (p === 'replicate' && env('REPLICATE_API_TOKEN')) return 'replicate';
  if (!p || p === 'demo') {
    if (env('GEMINI_API_KEY')) return 'gemini';
    if (env('FASHN_API_KEY')) return 'fashn';
    if (env('REPLICATE_API_TOKEN')) return 'replicate';
  }
  return 'none';
}

const KEY_FOR = { gemini: 'GEMINI_API_KEY', fashn: 'FASHN_API_KEY', replicate: 'REPLICATE_API_TOKEN' } as const;

/** Why try-on is off, in plain words. Names settings only, never their values. */
export function setupHint(): string {
  const chosen = env('TRYON_PROVIDER').toLowerCase() as keyof typeof KEY_FOR;
  const where = 'in Vercel (Settings, Environment Variables, with Production and Preview ticked), then redeploy';
  if (chosen && chosen in KEY_FOR && !env(KEY_FOR[chosen])) return `TRYON_PROVIDER is set to ${chosen}, but this deployment can't see ${KEY_FOR[chosen]}. Add it ${where}.`;
  return `Add FASHN_API_KEY or GEMINI_API_KEY ${where}.`;
}
