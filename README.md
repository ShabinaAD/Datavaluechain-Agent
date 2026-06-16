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

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173
```

Other scripts:

```bash
npm run build    # type-check (tsc -b) + production build
npm run lint     # ESLint
npm run preview  # preview the production build
```

## Architecture

```
src/
  config/workflow.ts     # single source of truth for the ordered value-chain stages
  store/
    types.ts             # domain model (Project, stages, sources, …)
    projectStore.ts      # persisted work state (the user's project)
    uiStore.ts           # persisted UI preferences (theme, sidebar)
  components/
    AppShell.tsx         # persistent chrome: Sidebar + Topbar + routed page
    HydrationGate.tsx    # holds render until persisted state is restored
    SaveStatus.tsx       # live "All changes saved" trust indicator
    StagePage.tsx        # shared frame for every stage page
    ui/                  # Button, Card, Field, StatusBadge primitives
  pages/                 # Overview + one page per value-chain stage + Settings
  hooks/                 # useApplyTheme, useNow
  lib/                   # cn, formatting, backup (export/import)
  icons/                 # dependency-free inline SVG icon set
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

## Deploying

This is a client-side SPA. When hosting the production build statically,
configure your host to **rewrite all unknown routes to `index.html`** so deep
links like `/stage/modeling` resolve on refresh (e.g. a Netlify `_redirects`
rule `/* /index.html 200`, or an equivalent rewrite on your platform).
