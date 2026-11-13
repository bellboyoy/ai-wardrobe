import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Public values: the anon key only works together with a logged-in user and the database rules.
// Built in so a bad paste in hosting settings can't break login. Override with NEXT_PUBLIC_* if you move projects.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://bewvqukosnqfwtkyuwbf.supabase.co';
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJld3ZxdWtvc25xZnd0a3l1d2JmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1OTg0OTIsImV4cCI6MjExMDE3NDQ5Mn0.zE2LCyBAFV5fK5vWEd725pvd7Fc9PxeVVWUXP_tfi5Q';
export const BUCKET = 'wardrobe';

let browser: SupabaseClient | null = null;
export function supabase() {
  if (!browser) browser = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return browser;
}
