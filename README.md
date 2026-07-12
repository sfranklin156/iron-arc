# Iron Arc

A personal strength-training tracker with a "protagonist training arc" vibe — rank/XP from lifetime volume, streaks, and RECORD badges. Plain HTML/CSS/vanilla JavaScript, no build step, no backend. All data is stored on-device in `localStorage`. Installable as a PWA.

## Running locally

Any static file server works, e.g.:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`. (Opening `index.html` directly via `file://` will mostly work, but the service worker won't register under that scheme — use a local server to test the full PWA behavior.)

## Deploying to GitHub Pages

1. Push this repository to GitHub (already done if you're reading this from the repo).
2. In the repo, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
4. Choose the branch this app lives on (e.g. `main`, or the branch you pushed) and folder `/ (root)`.
5. Save. GitHub will publish the site at `https://<your-username>.github.io/<repo-name>/`.
6. Wait a minute or two for the first deploy, then visit the URL.

All asset paths in this app are relative (`css/…`, `js/…`, `icons/…`), so it works whether it's served from a domain root or a subpath like `/iron-arc/` — no configuration changes needed for GitHub Pages' subpath hosting.

### Installing on your phone

Once the GitHub Pages URL is live:

- **iOS (Safari):** open the URL, tap the Share icon, then "Add to Home Screen."
- **Android (Chrome):** open the URL, tap the ⋮ menu, then "Add to Home screen" / "Install app."

The app shell (HTML/CSS/JS/icons) is cached by the service worker for offline use. Your workout data lives in the browser's `localStorage` on that device only — it is never sent anywhere.

## Data & privacy

Iron Arc has no server component. Everything you log stays in your browser's local storage on your device. Clearing your browser's site data for this app will erase your history — there's no cloud backup built in yet.

## Project structure

```
index.html        — app shell + markup for all tabs
css/styles.css     — theme (dark palette, Cinzel/Inter/JetBrains Mono)
js/app.js          — all app logic (data model, rendering, event handling)
manifest.json      — PWA manifest
sw.js              — service worker (offline app-shell caching)
icons/             — app icons for the manifest / home screen
```

## Out of scope for v1

Per the project brief, these are intentionally not built yet and would need an Anthropic API key to add later as a separate optional module:

- A "Coaching" tab with AI-generated training recommendations / monthly report
- Natural-language trends summary on the Progress tab
- Parsing freeform pasted notes into structured workouts
