# AI Wardrobe

A private web app for your own clothes and wishlist. Add photos of yourself, save items from Vinted, Shein or any shop by pasting the link, let AI put them on you, and build outfits.

## What it does (v0.1)

- **Me**: upload full-length photos of yourself and star a default.
- **Wardrobe**: paste a product link (Vinted, Shein, ASOS, H&M, Depop…) and it grabs the photo, name, brand and price. If a shop blocks it, upload a screenshot instead. Mark items as *owned* or *wishlist*.
- **Try on**: pick a photo of you plus one item or a whole outfit, and the AI dresses you in it.
- **Outfits**: save combinations with their try-on image, regenerate looks, and ask the **AI stylist** (Gemini) for outfit ideas from your wardrobe.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
cd wardrobe-app
npm install
cp .env.example .env     # then paste your API key into .env
npm start
```

Open http://localhost:3000.

Without any key it runs in **demo mode**: everything works, but try-ons show a side-by-side preview instead of a real AI image.

## AI services

| Setting | What it's good at | Key |
|---|---|---|
| `gemini` (default) | Try-ons of whole outfits in one go, including shoes and accessories, plus the AI stylist. Can occasionally alter your face or pose a little. | [Google AI Studio](https://aistudio.google.com/apikey) |
| `fashn` | Most faithful try-on of tops, bottoms and dresses. Paid per image. | [FASHN](https://app.fashn.ai/api) |
| `replicate` | Open-source IDM-VTON, cheap, slower and less consistent. | [Replicate](https://replicate.com/account/api-tokens) |

Change `TRYON_PROVIDER` in `.env` and restart to switch. The AI stylist always uses Gemini.

## Use it on your phone

1. Set `APP_PASSWORD=something` in `.env` and restart. The app then listens on your Wi-Fi.
2. On your phone (same Wi-Fi), open `http://<your-computer's-IP>:3000`, log in with any username and that password.
3. Use your browser's *Add to Home Screen* to get an app icon.

## Privacy

Everything is stored on your computer in `data/` (photos, clothes, results, `db.json`). Nothing is uploaded anywhere until you press **Try it on** or **Ask**, and then only the images needed go to the AI service you picked. `data/` and `.env` are git-ignored, so they never end up in a repo.

## Tips for good try-ons

- Full-length photo, standing straight, arms slightly away from your body, plain background, good light.
- Fitted clothing in your own photo works better than baggy layers.
- Product photos on a plain background or flat-lay give the cleanest results.

## Ideas for next versions

- Share to the app straight from the Vinted/Shein phone apps (needs hosting with HTTPS).
- Host it online with login so it works away from home.
- Weather-aware daily outfit suggestions, outfit calendar, price-drop tracking for wishlist items.
