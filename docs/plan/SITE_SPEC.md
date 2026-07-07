# SITE SPEC — the Omni 3D web experience that beats higgsfield.ai

> The product is a **site** people land on, trust, and create in. This spec defines it
> end-to-end. Measurable pass/fail bar: [QUALITY_BAR.md](./QUALITY_BAR.md).
> Built by WO-16 (marketing site + design system), WO-04 (workspace), gated by WO-17.

## 1. What Higgsfield's site does — and where it loses

From the research (RESEARCH_HIGGSFIELD.md): their site wins on breadth (15+ models, ~80 apps, constant launches) and loses on **sprawl** (80 apps = decision paralysis; every feature is a separate tool page), **trust** (annual-default checkout, "unlimited" asterisks, watermarked free tier), and **opacity** (credit costs discovered after the fact, queue times hidden until you're waiting). Every complaint in research Part 2 is visible *on the site itself* — the fix is a site design principle, not just backend policy.

## 2. Information architecture

**Marketing site** (static, SEO-first, WO-16):

| Page | Purpose / key sections |
|---|---|
| `/` Landing | Convert. Spec in §3 |
| `/3d` | The moat page: video→game-ready asset pipeline, live viewer demos, UE5/Unity sync |
| `/video` | Generation + camera presets + characters; comparison strip vs prompt-lottery tools |
| `/pricing` | ONE table, monthly default, exact totals, credit calculator, "never expires" badge; no hidden tiers |
| `/trust` | Renders TRUST.md verbatim + live status widget + refund policy in plain words |
| `/docs` | Quickstarts (web, API, local engine), API reference from openapi.json |
| `/changelog` | Every release, honest notes (including regressions fixed) |
| `/status` | Public queue depth, generation success rate, uptime (WO-15) — linked in the footer of every page |
| `/legal/*` | ToS, privacy, content policy (versioned), DMCA (WO-18) |

**Workspace app** (`/app`, WO-04+): one canvas, four modes — **Create** (input → 3D asset), **Animate** (character + motion), **Direct** (scenes/timeline/cameras), **Export** (formats/engines). No app grid. Everything else is a panel inside a mode.

## 3. Landing page, section by section

1. **Hero**: headline "Make characters that never drift. Own every asset." Sub: video/photo/text → rigged, game-ready 3D — then film it from any angle. **The hero visual is a live, orbitable 3D viewer** (real generated asset, drag to rotate, preset camera-move buttons underneath) — proof, not a sizzle reel. Higgsfield was caught passing stock footage as AI output; our hero is literally the product running. CTA pair: `Start free — no signup` (local/demo path) + `See pricing` (nothing hidden).
2. **Trust strip** (immediately under hero, small): "Credits never expire · Failed generations auto-refunded · Monthly billing by default · Free local tier forever" — each linking to /trust.
3. **The three differentiators**, each with a live/looping demo: (a) Zero-drift characters — same character, 6 angles, geometry-hash equal; (b) Real camera moves — same asset, 3 presets, deterministic; (c) Own your compute — terminal clip of the local engine producing a `.glb`, "$0.00/asset".
4. **Pipeline walk**: horizontal 6-stage strip (plain words per stage) with real intermediate artifacts.
5. **Pricing preview**: the actual price table inline (not a teaser), with the credit calculator.
6. **Made-with gallery** + changelog ticker (shipping velocity as social proof).
7. **Footer**: status, trust, docs, API, GitHub, legal. No newsletter modal, no exit-intent popup, ever.

## 4. Workspace UX principles (anti-sprawl, anti-dark-pattern)

- **One canvas, modes not apps.** A new user sees exactly one input box and one Run button; power reveals progressively (targets, budgets, presets in collapsible panels).
- **Cost before commit**: the Run button itself shows the estimate ("Run — 12 credits" or "Run — free (local)"). Estimate comes from `/estimate` (WO-06); the button never says less than the true total.
- **Honest queue chip** in the header: live depth + expected wait from `/queue/status`, before you submit. If the wait is bad, the chip says so — trust is the brand.
- **Progress rail** with the six stages in plain words; failures show the auto-refund note inline.
- **The 3D viewer is the centerpiece** of every result: orbit, wireframe, bones, camera-preset playbar. Downloads (glb/fbx/usdz…) one click, never gated by watermark.
- **Toggles are sticky** (Higgsfield's mobile app silently reset "Unlimited" per generation — a documented complaint). Settings persist per project; changing spend mode requires an explicit click.
- **Keyboard palette** (Cmd/Ctrl-K) for every action; full flows keyboard-navigable (WCAG 2.2 AA, WO-17 gate).

## 5. Design direction

**Recommended: "Studio Dark"** — near-black neutral surface (#0A0B0E family), single accent (electric cyan-green, used only for actions/success), high-contrast off-white text. Rationale: 3D content IS the color on the page — the UI must be a neutral stage (this is why Blender/Unreal/every DCC tool is dark); it also reads "professional studio" against Higgsfield's consumer-gloss.
- Type: Geist or Inter for UI; JetBrains Mono for numbers (credits, hashes, coords) — data is monospaced everywhere, it signals honesty.
- Motion: restrained — 150–250 ms ease-out on panels, no scroll-jacking, no autoplaying sound; the only "wow" motion is the 3D content itself.
- Tokens (WO-16): single `tokens.css` (colors, spacing 4-px grid, radii, type scale, durations) consumed by BOTH marketing site and workspace — one visual language, enforced by review.
- Rejected directions (recorded so agents don't relitigate): "Creator gradient" (loud purple/pink gradients — reads consumer-toy, fights 3D content), "Paper light" (light UI washes out 3D viewports).

## 6. What we deliberately do NOT copy from Higgsfield

- No 80-tile app grid; no separate landing page per micro-feature.
- No annual-default checkout, no countdown timers, no "limited offer" banners, no exit modals.
- No watermark on any tier (free tier is rate-limited, not defaced).
- No hidden credit math — every price the UI shows is the number the ledger writes.
- No stock/staged demo media anywhere — every pixel of demo content is generated by the product, and the repo keeps the job JSON that made it (provable).
