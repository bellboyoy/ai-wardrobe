# Atelier — AI Wardrobe

A private fashion app for your own clothes and wishlist. Add photos of yourself, import pieces from Vinted, SHEIN, Zara, ASOS or any shop, let AI dress you in them, build outfits and ask an AI stylist what to wear.

## What's inside

- **Home**: greeting, your latest look, recently added pieces, AI outfit ideas, recent outfits and quick wardrobe access.
- **Try On**: pick one of your photos and up to six pieces, then generate a realistic photo of you wearing them. Compare before and after, favourite it, save it as an outfit or download it.
- **My Wardrobe**: a catalogue with search, filters (owned, wishlist, favourites), sorting and categories (T-shirts, Shirts, Hoodies, Jumpers, Jackets, Trousers, Jeans, Shorts, Shoes, Accessories, Dresses).
  - Add a piece by pasting a product link, or by uploading a photo or screenshot. The AI reads the screenshot and fills in the name, category, colour, brand, size and price. Everything stays editable.
- **Outfit Studio**: slots for top, bottom, jacket, shoes and accessories, shuffle, save with name, tags and notes, then view it on you. The AI stylist takes free-form requests and considers your wardrobe, sizes, styles, budget, occasion and the weather in your city.
- **Saved Looks**: a gallery of generated looks to favourite, compare side by side, recreate or delete.
- **Profile**: your avatar photos (front, side, full length), sizes, optional private measurements, styles, brands, budget and account settings.
- **Share to the app**: once installed to an Android home screen, use *Share* in a shopping app and pick Atelier.

## Stack

- Next.js (App Router) with TypeScript and Tailwind CSS, deployed on Vercel.
- Supabase for login, the database and a **private** storage bucket. Row level security locks every row and file to your account (`supabase/schema.sql`).
- AI runs only on the server (`app/api/*`), so API keys never reach the browser:
  - `lib/server/gemini.ts`: Gemini client.
  - `lib/server/tryon.ts`: try-on providers (Gemini, FASHN, Replicate).
  - `app/api/stylist`: AI stylist.
  - `app/api/identify`: screenshot reading.

If no AI key is set, the app says so clearly and never shows a fake result.

## Environment variables (Vercel → Settings → Environment Variables)

| Name | Needed | What it does |
| --- | --- | --- |
| `GEMINI_API_KEY` | Yes, for AI | Try-on, stylist and screenshot reading. Get one at aistudio.google.com/apikey. |
| `ALLOWED_EMAILS` | Recommended | Comma-separated emails allowed to use the AI routes. |
| `TRYON_PROVIDER` | Optional | `gemini` (default when a Gemini key exists), `fashn` or `replicate`. |
| `GEMINI_IMAGE_MODEL` / `GEMINI_TEXT_MODEL` | Optional | Override the Gemini models. |
| `FASHN_API_KEY` / `REPLICATE_API_TOKEN` | Optional | Only for those try-on providers. When more than one try-on key is set, Try On shows an engine switch. |
| `FASHN_MODEL` / `FASHN_QUALITY` | Optional | FASHN model (default `tryon-max`, or `tryon-v1.6`) and quality (`fast`, `balanced`, default `quality`). |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Optional | Override the Supabase project. The public URL and anon key are already built in. |

The old `SUPABASE_URL` and `SUPABASE_ANON_KEY` variables are no longer used and can be deleted.

## Database

Run `supabase/schema.sql` in Supabase → SQL Editor. It is safe to run again. Create your login in Supabase → Authentication → Users.

## Develop

```bash
npm install
npm run dev        # http://localhost:3000
npm run typecheck
npm run build
```
