# Frontend specification

## Imported implementation

`frontend/` is a direct import of `E:\empire\Paqshi\brain`, excluding `.env`, `node_modules` and build output. Its globe is implemented by `src/components/OsirisMap.tsx` using MapLibre GL and the `public/dark-matter-style.json` basemap.

This preservation is deliberate: it gives the team a verified visual baseline. The inherited broad intelligence controls are not the hackathon application.

## Target routes

| Route | Purpose |
|---|---|
| `/` | Redirects to `/command` |
| `/command` | Globe + disruption alerts sidebar |
| `/risk` | Supplier risk dashboard + cascade analysis |

## Implemented files

| File | Purpose |
|---|---|
| `src/app/page.tsx` | Redirect to `/command` |
| `src/app/layout.tsx` | Root layout, metadata, dark theme |
| `src/app/globals.css` | Design system (CSS variables, glassmorphism, dark theme) |
| `src/app/command/page.tsx` | Globe + alert sidebar + alert detail popup + Zulu clock |
| `src/app/risk/page.tsx` | Supplier list + risk scoring + dimension bars + factor ledger + cascade table + stress tests + concentration |
| `src/lib/api.ts` | Typed API client for all backend endpoints |
| `src/lib/contracts.ts` | TypeScript interfaces matching backend Pydantic models |
| `src/components/OsirisMap.tsx` | MapLibre GL globe component (retained from Paqshi) |

## Component plan

### `/command` page

- Globe (MapLibre GL via `OsirisMap`) with port markers and hazard zones
- Alert sidebar: ranked alert cards with severity color, type icon, posterior, confidence
- Alert detail popup: evidence factors, log-likelihood contributions, affected nodes
- Zulu clock (HH:MM:SSZ format)
- "Load Live Data" button triggers `POST /v1/ingest/live`
- "Reset Demo" button triggers `POST /v1/demo/reset`

### `/risk` page

- Supplier list with risk scores (0-100)
- Risk score card with gauge visualization
- Dimension bars (delivery, quality, financial, capacity, compliance)
- Factor ledger table
- Cascade exposure table (upstream nodes, probability, impact, stock-out days)
- Stress test buttons (port disruption, supplier failure, route closure)
- Concentration risk panel
- Summary stats strip

### Shared

- Types in `src/lib/contracts.ts`
- API client in `src/lib/api.ts`
- No scoring calculations in components — all from backend

## Libraries

Next.js 16 / React 19 / TypeScript / Tailwind 4 / MapLibre GL / Framer Motion / Lucide. No external state library (local React hooks). No Tanstack Query, Zod, or Recharts.

## Interaction and states

- Every number displays its as-of time and confidence where consequential
- Red/orange/amber severity with neutral baseline; never imply certainty from color alone
- Forecast card exposes prior, posterior, stress, top log-likelihood contributions, p50/p80/p95 lead-time distribution, Monte Carlo trial count and seed
- Loading skeletons, empty state with "load demo scenario", disconnected external feed state
- Tooltips expose factor/evidence ledger
- Keyboard focus, labels and color-independent severity icons

## Design system

The `globals.css` design system provides:

- CSS custom properties for colors, glass effects, shadows
- `.glass` and `.glass-heavy` classes for glassmorphism panels
- `.sarvadarshi-glow` and `.sarvadarshi-glow-cyan` for accent effects
- `.sentinal-glow` and `.sentinal-glow-cyan` for glow effects
- `.sarvadarshi-pulse`, `.sarvadarshi-scan`, `.sarvadarshi-rotate` animations
- Severity classes: `.severity-critical`, `.severity-high`, `.severity-medium`, `.severity-low`, `.severity-info`
- Status classes: `.status-good`, `.status-caution`, `.status-warn`, `.status-danger`
- Gauge classes: `.gauge-fill` (animated fill)
- Factor classes: `.factor-positive`, `.factor-negative`, `.factor-neutral`
- Alert classes: `.alert-card`, `.alert-card-selected`
- Button classes: `.btn-primary`, `.btn-danger`
- Scrollbar: `.custom-scrollbar`
- Chart classes: `.fan-gradient`, `.chart-container`
