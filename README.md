# Data Value Chain Agent Foundry

An internal studio that takes a data-and-analytics team from **business
requirements all the way to a working dashboard**, in one place. Each stage of
the value chain is owned by a dedicated AI agent, so the weeks normally lost to
hand-offs between business analysts, data engineers, and BI developers collapse
into a single guided workflow.

This repository is the **application foundation** — the visual identity,
navigation, and the rules that keep a user's work safe across page refreshes —
on top of which individual features are built.

## Why this foundation exists

The workflow is multi-hour, so the app is built to be **professional,
trustworthy, and resilient**. The headline guarantee:

> A single accidental browser refresh must never destroy hours of work.

That guarantee is delivered, not assumed — see [Resilience](#resilience-how-work-is-kept-safe).

## Tech stack

| Concern        | Choice                                          |
| -------------- | ----------------------------------------------- |
| Build / dev    | [Vite](https://vitejs.dev)                      |
| UI             | React 19 + TypeScript                           |
| Styling        | Tailwind CSS (CSS-variable theming, light/dark) |
| Routing        | React Router                                    |
| State + persistence | [Zustand](https://github.com/pmndrs/zustand) with the `persist` middleware |
| Backend        | Node + [Express](https://expressjs.com) (boot id, config status, AI proxy) |

## Getting started

```bash
npm install
npm run dev      # web http://localhost:5173 + api http://localhost:8787
```

`npm run dev` runs the Vite frontend and the Express backend together (Vite
proxies `/api` to the server). The app works with **no configuration** — see
[Environment configuration](#environment-configuration).

Other scripts:

```bash
npm run build       # type-check (tsc -b) + production build
npm run lint        # ESLint
npm run preview     # preview the production build
npm run dev:server  # run just the backend (node --watch server/index.js)
npm start           # run the backend serving the built dist/ (production)
```

## Architecture

```
src/
  config/workflow.ts     # single source of truth for the ordered value-chain stages
  store/
    types.ts             # domain model (Project, stages, sources, …)
    projectStore.ts      # persisted work state (the user's project)
    uiStore.ts           # persisted UI preferences (theme)
    bannerStore.ts       # transient (non-persisted) red/green banners
    uploadStore.ts       # in-memory only uploads (intentionally not persisted)
    runtimeStore.ts      # server-online flag + non-secret config status
  components/
    AppShell.tsx         # persistent chrome: Topbar + TopTabs + routed page
    TopTabs.tsx          # the six workflow tabs (active tab highlighted)
    ErrorBoundary.tsx    # global error boundary -> banner, never a blank page
    BannerHost.tsx       # renders persistent banners, clears them on navigation
    SessionGate.tsx      # runs the server probe + wipe-on-restart before render
    HydrationGate.tsx    # holds render until persisted state is restored
    AgentPanel.tsx       # "Agent" assist with AI / offline-fallback labelling
    ConnectFirst.tsx     # non-blocking "Connect first" notice
    FileUpload.tsx       # in-memory upload; derived work is persisted
    StagePage.tsx        # shared frame for every stage page
    ui/                  # Button, Card, Field, StatusBadge primitives
  pages/                 # Overview + one page per value-chain stage + Settings
  hooks/                 # useApplyTheme, useBootstrap, useNow
  lib/                   # api (server calls), agent (run + fallback), cn, backup
  icons/                 # dependency-free inline SVG icon set
server/
  index.js               # Express: /api/health (boot id), /api/config, /api/agent/run
```

Adding a new stage to the value chain is a **one-line change** in
`config/workflow.ts`; navigation, the progress meter, the overview, and the
stepper all derive from that list.

## Resilience: how work is kept safe

Persistence is intentionally engineered, with three guarantees:

1. **Autosave on every change.** All work lives in a Zustand store mirrored to
   `localStorage` via the `persist` middleware. There is no "Save" button to
   forget — every keystroke is durable.
2. **No empty-state clobber on boot.** A `HydrationGate` blocks the first render
   until persisted state has been read back from storage, and a `_hasHydrated`
   flag prevents the app from overwriting saved data with defaults during the
   rehydration race. This is the exact failure ("refresh wiped my work") the
   product must never exhibit.
3. **Forward-compatible storage.** The persisted blob is versioned with a
   `migrate` hook, so future schema changes upgrade old data instead of
   discarding it.

On top of automatic persistence, **Settings → Data & resilience** offers manual
JSON **export/import**, giving users an off-device backup they can restore on
another machine.

The `SaveStatus` indicator in the top bar surfaces all of this to the user
("All changes saved · 2m ago"), so the safety is visible and trusted.

### State survives refresh & reopen, but dies with the server

The one way to reset everything is an **application-server restart**. The server
generates a fresh **boot id** each time it starts; the client records the boot id
it last saw. On load, `useBootstrap` compares them:

- **Same boot id** (or server unreachable) → work is left untouched.
- **Different boot id** (the server restarted) → the project resets to defaults.

This delivers spec 1.7 precisely: a refresh or reopening the browser keeps every
input, choice, and Agent result, while an IT-driven server restart is the single
way to wipe state. **Uploaded files are the deliberate exception** — the file
itself lives only in memory (`uploadStore`) and is gone after a refresh, but
anything derived from it is written into the persisted project and survives.

## Status, errors, and the Agent

- **AI identity is hidden.** The UI only ever says "Agent" — the underlying
  model/vendor name is never shown to the user or written to a client-visible
  log. The model is held server-side and proxied through `/api/agent/run`.
- **Offline fallback.** If the AI service is unconfigured or unreachable, each
  stage produces a deterministic local result instead of failing. Every result
  is labelled **AI** or **Offline fallback** so provenance is clear.
- **Persistent banners.** Errors (red) and successes (green) stay on screen
  until the user acts — they never flash and vanish. They clear on navigation.
- **Never a blank page.** A global `ErrorBoundary` converts any render error
  into a recoverable banner.

## Environment configuration

All external configuration is read from environment variables at server startup
(see [`.env.example`](./.env.example)); everything has a working default so the
app loads even when nothing is set. Secrets and the AI model name stay
server-side — the client only receives boolean `configured` status, surfaced in
**Settings → Environment & connections**.

| Variable       | Purpose                                  | Default                     |
| -------------- | ---------------------------------------- | --------------------------- |
| `PORT`         | Server port                              | `8787`                      |
| `DATA_DIR`     | Folder for generated artifacts           | `./data`                    |
| `AI_API_KEY`   | Enables the AI service (else fallback)   | _(empty → offline)_         |
| `AI_BASE_URL`  | AI service base URL                      | `https://api.openai.com/v1` |
| `AI_MODEL`     | Model name (server-side only)            | _(internal default)_        |
| `DATABASE_URL` | Enables DB connections (else "Connect first") | _(empty)_              |

## Deploying

This is a client-side SPA. When hosting the production build statically,
configure your host to **rewrite all unknown routes to `index.html`** so deep
links like `/stage/modeling` resolve on refresh (e.g. a Netlify `_redirects`
rule `/* /index.html 200`, or an equivalent rewrite on your platform).
