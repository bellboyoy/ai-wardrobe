import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  reactStrictMode: true,
  // Only for local end-to-end tests: swap Supabase for an in-memory stand-in.
  webpack: (cfg) => {
    if (process.env.FAKE_SUPABASE) {
      cfg.resolve.alias = { ...cfg.resolve.alias, '@supabase/supabase-js$': path.resolve(process.env.FAKE_SUPABASE) };
    }
    return cfg;
  },
};
export default config;
