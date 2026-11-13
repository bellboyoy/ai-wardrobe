// Public settings the page needs before login (no secrets here).
import { providerName } from './_lib/tryon.js';

// Keys and URLs are plain ASCII; drop spaces, line breaks or invisible characters picked up when pasting.
const clean = (v) => String(v || '').replace(/[^\x21-\x7E]/g, '');

export default function config(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    supabaseUrl: clean(process.env.SUPABASE_URL).replace(/\/+$/, ''),
    supabaseAnonKey: clean(process.env.SUPABASE_ANON_KEY),
    provider: providerName(),
    stylist: Boolean(process.env.GEMINI_API_KEY),
    categories: ['top', 'bottom', 'one-piece', 'outerwear', 'shoes', 'accessory'],
  });
}
