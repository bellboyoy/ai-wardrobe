// Run the app on your own computer: `npm run dev`. Online, Vercel runs the same /api functions.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';

if (fs.existsSync('.env') && process.loadEnvFile) process.loadEnvFile('.env');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

for (const file of fs.readdirSync(path.join(__dirname, 'api'))) {
  if (!file.endsWith('.js')) continue;
  const { default: fn } = await import(`./api/${file}`);
  app.all(`/api/${file.replace(/\.js$/, '')}`, (req, res) => fn(req, res));
}

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, process.env.HOST || '127.0.0.1', () => console.log(`\n  AI Wardrobe running at http://localhost:${PORT}\n`));
