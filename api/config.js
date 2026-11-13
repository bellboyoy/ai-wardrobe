// Public settings the page needs before login (no secrets here).
import { providerName } from './_lib/tryon.js';

export default function config(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    provider: providerName(),
    stylist: Boolean(process.env.GEMINI_API_KEY),
    categories: ['top', 'bottom', 'one-piece', 'outerwear', 'shoes', 'accessory'],
  });
}
