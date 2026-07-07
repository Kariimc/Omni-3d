# WO-16 — Design system + marketing site: the face that beats higgsfield.ai

**Phase 2 (parallel with WO-04+) · depends on WO-15 (hosting target) · branch `wo/16-marketing-site`**

## Goal
Ship the design tokens both surfaces share, and the full marketing site from [../SITE_SPEC.md](../SITE_SPEC.md): landing, /3d, /video, /pricing, /trust, /docs, /changelog, /legal — meeting every QUALITY_BAR §A number.

## Why
"Better than Higgsfield" is judged first at the site. Their weaknesses are visible on-page (sprawl, dark patterns, opaque pricing); SITE_SPEC turns each into a section we win.

## Read first
- **[../SITE_SPEC.md](../SITE_SPEC.md) is the requirements document — this WO implements it.** Also [../QUALITY_BAR.md](../QUALITY_BAR.md) §A/§C/§D, RESEARCH_HIGGSFIELD.md Part 2 (the complaints each page answers), TRUST.md (WO-14; if not yet merged, render the policy text from WO-14's spec §1).

## Spec
1. **Design tokens** (`design/tokens.css` + `design/README.md`): Studio Dark direction per SITE_SPEC §5 — color scale, 4-px spacing grid, radii, type scale (Geist/Inter + JetBrains Mono for all numerals), motion durations. This file is a **cross-WO contract**: the workspace (WO-04) imports it verbatim. Document every token.
2. **Site framework**: Astro in `site/` (static output, zero client JS except explicitly-hydrated islands). Pages per SITE_SPEC §2–3. The landing hero's orbitable 3D viewer is a lazy-hydrated island using the same `<model-viewer>`-style three.js component as the workspace, loading a real generated `.glb` committed under `site/public/demo/` **with the job JSON that produced it** (provable-demo rule, SITE_SPEC §6).
3. **Pricing page**: table + interactive credit calculator (island) fed by the same cost table JSON the API serves (`/models` + costs — single source of truth; at build time, snapshot it and show "prices as of <date>").
4. **Docs**: Astro Starlight under `/docs` — quickstart (web), quickstart (local engine), API reference generated from `openapi.json` (WO-13; stub a placeholder page until it lands).
5. **Honesty hard rules** (QUALITY_BAR §D, enforced by WO-17): no countdown/urgency/exit-intent components; monthly pricing shown first; every demo asset provable.
6. **SEO**: unique meta/OG per page, sitemap, structured data (Product, FAQPage on /pricing), og-images generated from real renders.
7. Deploy per WO-15's decision (Cloudflare Pages or Fly static); record in ledger.

## Allowed new dependencies (site/ only)
`astro`, `@astrojs/starlight`, `three` (viewer island).

## Acceptance
```bash
cd site && npm run build          # zero errors/warnings
npx lighthouse <deployed-landing-url> --preset perf  # Perf/SEO/BP/A11y ≥95, LCP <1.8s — paste JSON summary
# axe scan: 0 critical/serious on all pages (paste)
# grep gate: no component named *Countdown*/*Urgency*/*ExitIntent* exists
# hero viewer: orbits a real glb; site/public/demo/<asset>.job.json exists and re-runs
```
Attach full-page screenshots of every page to the PR.

## Out of scope
Blog content authoring, i18n, A/B testing, analytics beyond a privacy-friendly counter (Plausible optional).
