# Frontend specification

## Imported implementation

`frontend/` is a direct import of `E:\empire\Paqshi\brain`, excluding `.env`, `node_modules` and build output. Its globe is implemented by `src/components/OsirisMap.tsx` using MapLibre GL and the `public/dark-matter-style.json` basemap. `src/app/page.tsx` is intentionally preserved so the copied app can be launched immediately with `npm ci; npm run dev`.

This preservation is deliberate: it gives the team a verified visual baseline. Do not present the inherited broad intelligence controls as the hackathon application.

## Target routes

Create `/command` and `/risk`; make `/` redirect to `/command`. Retain the existing dark, compact, mono-led visual language, but change the product name and vocabulary to SupplyChain Sentinel.

`/command` owns the map. Default visible layers are shipping lanes, ports/chokepoints, selected supplier sites, live disruption/hazard signals, official advisories and active shipments. The left rail filters these layers by supplier, region, severity and signal type. The right rail contains the top alert queue and selected-alert evidence. Clicking a pin or route opens its disruption probability, p50/p80/p95 delay, affected parts/orders, confidence, sources and “view on risk dashboard” action.

`/risk` owns decisions. Its first row shows at-risk orders, suppliers requiring review, expected stock-outs and precision/calibration. Below it, show a sortable supplier table with risk movement and factor chips; an exposure table for SKUs/orders; a forecast fan chart; a dependency/concentration panel; and a mitigation comparator. A stress-test drawer selects a supplier, port or lane and returns p50/p95 duration to first stock-out, SKU/order probabilities, assumptions, trial count and seed.

## Component plan

Reuse `OsirisMap` only through a narrow `SupplyChainMap` adapter that passes supply-chain GeoJSON and removes unrelated layer inputs. Create `AlertQueue`, `EvidenceLedger`, `ChokepointDetail`, `SupplierRiskTable`, `RiskFactorBreakdown`, `ExposureTable`, `LeadTimeFan`, `ConcentrationMatrix`, `MitigationComparator` and `StressTestDrawer`. Types belong in `src/lib/contracts.ts`; a single API client in `src/lib/api.ts`; fixture responses in `src/lib/demo-data.ts`. Avoid scoring calculations in components.

## Libraries

Keep Next.js 16 / React 19 / TypeScript / Tailwind 4 / MapLibre GL / Framer Motion / Lucide from Paqshi. Add `@tanstack/react-query` for server state and cache invalidation, `zod` for browser-side API validation, and `recharts` or `visx` for fan and composition charts. Keep MapLibre's globe projection and client-load the map with `next/dynamic` because it uses browser WebGL.

## Interaction and states

Every number displays its as-of time and confidence where consequential. Use red/orange/amber severity with a neutral baseline; never imply certainty from color alone. The forecast card must expose prior, posterior, stress, top log-likelihood contributions, p50/p80/p95 lead-time distribution, Monte Carlo trial count and seed—not merely a single risk score. Support loading skeletons, an empty state with “load demo scenario,” disconnected external feed state and an explicit last-known-data label. Tooltips expose the factor/evidence ledger. Keyboard focus, labels and color-independent severity icons are mandatory.

## Delivery order

First prove the existing copied globe starts. Then add typed fixture-backed `/command`, build `/risk` from the same fixtures, connect the selected backend endpoints, and finally trim inherited Paqshi controls. Capture a seeded demo video or screenshots only after the end-to-end scenario works offline.
