# Alejandro Dorado — Personal Portfolio

A static, hand-written single-page portfolio. No framework, no build step, no npm — plain HTML, CSS, and vanilla JavaScript.

Live at [alejandro-dorado.com](https://alejandro-dorado.com), deployed to Cloudflare Workers.

## What's inside

Everything under `public/` — and nothing else — is what gets deployed. Keeping the
site in its own directory is deliberate: `wrangler` uploads the asset directory
verbatim, so a repo-root asset directory would publish `.git/` along with the site.

```
portfolio-site/
├── public/             ← the deployed site; nothing outside this ships
│   ├── index.html          ← the page
│   ├── styles.css          ← all design
│   ├── main.js             ← all behavior (IIFE, vanilla JS)
│   ├── robots.txt
│   ├── lib/
│   │   └── manifest.js     ← brand + section data exposed at window.__BRAND__
│   └── assets/             ← photos, CV, favicons, OG image
├── cv/                 ← LaTeX source for the CV
├── tools/              ← OG-image generation helpers
└── wrangler.toml       ← deploy config (asset dir + custom domain)
```

## How to preview locally

```bash
python3 -m http.server 4173 --directory public
# then open http://localhost:4173
```

Classic `<script defer>` tags, no ES modules — opening `index.html` directly also mostly works, but Google Fonts and some animations behave better over HTTP.

## Deploy

```bash
npx wrangler deploy
```

`wrangler.toml` declares both the asset directory and the custom domain, so the
deploy is reproducible from the CLI without touching the Cloudflare dashboard.

## Design notes

- Every element is visible by default with no JS. Entrance animations (word/line reveals, clip-path photo reveals, section watermark, scroll parallax) only activate under `html.js-reveal`, a class the inline `<head>` script adds before first paint — and only when JS runs **and** the visitor hasn't requested reduced motion. A failed script, or `prefers-reduced-motion: reduce`, never hides content.
- Each effect in `main.js` lives in its own `init*` function wrapped in `safe()`, so one failure can't break the rest.
- `lib/manifest.js` is the single source of truth for section ids/labels used by the nav indicator — keep it in sync with `data-section-num` / `data-section-label` in `index.html`.

## Customizing

| To change... | Edit... |
|---|---|
| Any copy on the page | `index.html` directly |
| Color palette, typography, spacing | The `:root` block at the top of `styles.css` |
| Section list / labels in the nav indicator | `lib/manifest.js` |
| Animations (reveals, parallax, tilt, etc.) | `main.js` |
| Social-share preview (OG image) | `tools/og-template.html` + `tools/generate-og.mjs` |
