# Live demo (GitHub Pages)

A fully interactive demo of the **RGM Power Tools dashboard**, running entirely
in the browser against a **simulated Redgate Monitor test environment**. No
backend, no PowerShell, no real Monitor instance — and nothing leaves your
machine.

**▶ https://dialgforgsu.github.io/alertcode/**

## How it works

GitHub Pages serves static files only, so there's no server to run the real API.
Instead:

- [`index.html`](index.html) — the dashboard page, plus a small demo banner.
- [`app.js`](app.js) — a **byte-identical copy** of
  [`packages/server/public/app.js`](../packages/server/public/app.js), the real
  dashboard front-end. The demo is the genuine UI, not a re-creation.
- [`styles.css`](styles.css) — copy of the dashboard stylesheet.
- [`mock-monitor.js`](mock-monitor.js) — patches `window.fetch` for `/api/*`
  **before** `app.js` loads, answering each call from in-memory fixtures that
  mirror the real response shapes (`packages/server/src/api.ts`). Writes (apply,
  tag sync, annotate) mutate the in-memory state, so the demo is stateful for the
  session — apply the alert-config plan once and the next diff comes back clean.

Every tool works: status, groups, tags + sync, alert-config diff/apply, doctor,
cost (+ onboarding projection), incident replay, and annotations.

## Enabling Pages

Repository **Settings → Pages → Build and deployment**:

- **Source:** Deploy from a branch
- **Branch:** `main` / `/docs`

(The `.nojekyll` file keeps Pages from running the content through Jekyll.)

## Keeping it in sync

`app.js` and `styles.css` here are copies of the dashboard's real assets. If you
change [`packages/server/public/`](../packages/server/public/), re-copy them:

```bash
cp packages/server/public/app.js   docs/app.js
cp packages/server/public/styles.css docs/styles.css
```

`mock-monitor.js` only needs updating if the API request/response shapes in
`packages/server/src/api.ts` change.
