# AI Wardrobe

A private app for your own clothes and wishlist. Add photos of yourself, save items from Vinted, Shein or any shop by pasting the link, let AI put them on you, and build outfits. Works on your phone and can be added to your home screen.

## What it does

- **Me**: upload full-length photos of yourself and star a default.
- **Wardrobe**: paste a product link (Vinted, Shein, ASOS, H&M, Depop…) and it grabs the photo, name, brand and price. If a shop blocks it, upload a screenshot instead. Mark items as *owned* or *wishlist*.
- **Try on**: pick a photo of you plus one item or a whole outfit, and the AI dresses you in it.
- **Outfits**: save combinations with their try-on image, regenerate looks, and ask the **AI stylist** (Gemini) for outfit ideas.
- **Share to the app** (Android, once installed to the home screen): use *Share* in the Vinted or Shein app and pick Wardrobe.

## How it's built

- `public/`: the web app (plain HTML, CSS and JavaScript, no build step).
- `api/`: small serverless functions on Vercel for things that need secrets or a server: reading shop links, AI try-on, AI stylist.
- **Supabase** for login, the database and a **private** storage bucket. Every row and file is locked to your account by database rules (`supabase/schema.sql`), and only emails in `ALLOWED_EMAILS` can use the AI functions.

## Set up (one time, about 15 minutes)

### 1. Supabase (free)
1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**, paste all of `supabase/schema.sql`, press **Run**.
3. **Authentication → Users → Add user**: your email and a password, tick *Auto confirm*.
4. **Authentication → Sign In / Providers**: turn off *Allow new users to sign up*.
5. **Project Settings → API**: copy the *Project URL* and the *anon public* key.

### 2. Gemini key
Get one at [Google AI Studio](https://aistudio.google.com/apikey).

### 3. Vercel (free)
1. At [vercel.com/new](https://vercel.com/new), import the `ai-wardrobe` GitHub repo.
2. Add these **Environment Variables**, then **Deploy**:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Project URL from Supabase |
| `SUPABASE_ANON_KEY` | anon public key from Supabase |
| `ALLOWED_EMAILS` | your email (the one you added in Supabase) |
| `GEMINI_API_KEY` | your Gemini key |
| `TRYON_PROVIDER` | `gemini` |

Open the Vercel link on your phone, log in, and use *Add to Home Screen*.

## AI services

| `TRYON_PROVIDER` | Good at | Key variable |
|---|---|---|
| `gemini` (default) | Whole outfits in one go, incl. shoes and accessories, plus the stylist. Can occasionally alter your face or pose a little. | `GEMINI_API_KEY` |
| `fashn` | Most faithful try-on of tops, bottoms and dresses. Paid per image. | `FASHN_API_KEY` |
| `replicate` | Open-source IDM-VTON, cheap, slower and less consistent. | `REPLICATE_API_TOKEN` |
| `demo` | No AI, shows a side-by-side preview. Free. | none |

Change the variable in Vercel and redeploy to switch. Optional: `GEMINI_IMAGE_MODEL` (default `gemini-3.1-flash-image`) and `GEMINI_TEXT_MODEL` (default `gemini-flash-latest`).

## Run on your own computer

```bash
npm install
cp .env.example .env   # fill in the same values as above
npm run dev            # http://localhost:3000
```

## Privacy

Photos are stored in a private Supabase bucket and shown through links that expire after an hour. A photo goes to the AI service only when you press **Try it on**, and to Gemini when you ask the stylist.

## Tips for good try-ons

- Full-length photo, standing straight, arms slightly away from your body, plain background, good light.
- Product photos on a plain background or flat-lay give the cleanest results.
