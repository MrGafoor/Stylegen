**Style Gen**

I got tired of opening DevTools every time I liked how a website looked.

You know the drill — you find a site with great typography or a color system that just *works*, and suddenly you're spending 20 minutes digging through computed styles, CSS variables, and network tabs trying to reverse-engineer what someone else already figured out.

So I built Style Gen. Paste a URL, get back the design system behind it.

## What it does

### 🔭 Live Spec

Pulls a live design specification from any website — colors, typography, spacing patterns, CSS variables, breakpoints, interaction styles, layout patterns. Not a screenshot. The actual values.

### 🚀 Dev Prompt

Takes everything it extracted and turns it into a prompt you can drop straight into Cursor, Claude, ChatGPT, or whatever you're using. Skips the "describe the design to me" step.

### 🔍 Token Inspector

Raw design tokens. Color palette, font stacks, spacing scale, CSS variables, breakpoints. Useful when you want to look at the numbers directly rather than a formatted output.

### 📦 Export

Gets the data out in a format you can actually use — CSS variables, JSON tokens, Tailwind config, or a plain prompt. Pick what fits your workflow.


## Stack

React + Vite on the frontend, Node + Express on the backend, Puppeteer for the analysis. There's optional Gemini support if you have an API key, but it falls back to local generation without one.



## Running it locally

```bash
git clone YOUR_REPOSITORY_URL
cd style-gen
npm install
npm run dev
```

Or run them separately if you prefer:

```bash
npm run server   # backend
npm run client   # frontend
```

Then open `http://localhost:3005`.


## Known limitations

Some sites are deliberately hard to scrape — Cloudflare, bot protection, heavy client-side rendering. Stripe, Apple, Vercel will sometimes fail or return incomplete results. Working on it.



## Why

There's a gap between *looking* at a design and *rebuilding* a design. Screenshot tools show you what something looks like. Code generators try to reproduce it. I wanted something in the middle — something that shows you how it's structured, so you can make decisions from there.

Still a work in progress. Suggestions welcome.
