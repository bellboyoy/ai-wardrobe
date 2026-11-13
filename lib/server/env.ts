// Read a setting, dropping spaces, line breaks and invisible characters picked up when pasting.
export function env(name: string, keepSpaces = false) {
  const raw = process.env[name] || '';
  return keepSpaces ? raw.replace(/[^\x20-\x7E]/g, '').trim() : raw.replace(/[^\x21-\x7E]/g, '');
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
