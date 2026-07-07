# Higgsfield AI — Deep Research (as of 2026-07-05)

> Evidence base for the Omni 3D competitor plan ([MASTER_PLAN.md](./MASTER_PLAN.md)).
> Part 1: product/pricing/traction. Part 2: community complaints & wish-list.

## Part 1 — What Higgsfield is

Higgsfield AI (higgsfield.ai) is a multi-model AI video/image generation platform — an aggregator-plus-proprietary-tools "creative production environment" aimed primarily at social media marketers and ad creators. Founded 2023 by Alex Mashrabov (ex-Snap AI lead), HQ San Francisco; web platform launched March 2025. Positions itself as "infrastructure for AI video & image gen" — one subscription covering 15+ third-party frontier models plus its own models and ~80 purpose-built apps.

### Third-party models aggregated (not Higgsfield's own)
- **Video:** Sora 2 (OpenAI), Veo 3 / 3.1 (Google), Kling 2.6 / 3.0 / Kling O1, Seedance 1.5 Pro / 2.0 (ByteDance, 4K), Wan 2.5 / 2.6 / 2.7, MiniMax Hailuo 02, Gemini Omni Flash
- **Image:** Nano Banana / Pro / 2 Lite (Google), Flux Kontext / Flux.2 Pro, GPT Image, Seedream 5.0 / 5.0 Lite
- **Audio:** Seed Audio 1.0
- Integrates new models within ~24h of release; builds no frontier models in-house.

### Proprietary models and tools
- **Soul / Soul 2.0 / V2** — hyper-realistic "fashion-grade" photo model, 50+ aesthetic presets
- **Soul ID** — persistent character/identity from a reference image (virtual-influencer consistency)
- **DoP (Director of Photography)** — camera-control model: 100+ cinematic camera-movement presets baked into generation
- **Speak** + **Lipsync Studio** — talking avatars, audio→synced clip
- **Cinema Studio 2.0→3.5 + 4D** — narrative film suite: physics-aware engine, "AI Director" shot decomposition, per-shot camera control, native audio

### Studios / workflow products
Marketing Studio (URL-to-video ads, Seedance 2.0), Ads 2.0 / URL-to-Ad, UGC Factory/Builder, Shorts Studio, Explainer (text → ≤10-min captioned video), Popcorn (storyboarding), Draw-to-Video, Canvas, Angles 2.0, Multi Reference, Supercomputer (agent-automation command center), Higgsfield Originals (long-form AI content streaming).

### Apps library (~80 tools; representative)
Face Swap, Video Face Swap, AI Headshot, Skin Enhancer, Product Placement, Outfit Swap, Virtual Try-On, Commercial Faces, Thumbnail Maker, Personal Clipper, 40+ viral presets, VFX library, Mixed Media, Edit Image (brush inpainting), Edit Video, Topaz-powered upscaling, video background removal, color grading, outpaint.

### Platform surfaces
Web app (primary); Diffuse mobile app (iOS+Android); Higgsfield Cloud API (gated behind higher tiers, sparse docs); MCP server + CLI; Adobe Premiere Pro and DaVinci Resolve plugins. **No standalone 3D-asset generation** — "Cinema Studio 4D" is a cinematic-camera product, not a 3D modeler.

## Part 1b — Pricing and credits

| Plan | Price (annual) | Price (monthly) | Credits/mo |
|---|---|---|---|
| Free | $0 | — | trial credits, watermarked |
| Starter/Basic | $15/mo (one source: $5) | — | 70–200 (sources conflict) |
| Plus | $39/mo | $49 | 1,000 |
| Ultra | $99/mo | $129 | 3,000 (scalable to 9,000) |
| Business | ~$62/seat annual | $71 | 1,500/seat |

Per-generation examples: Nano Banana Pro image 2 cr; Flux Kontext 1.5 cr; Kling 3.0 720p 5s 7 cr; Seedance 2.0 720p 5s 25 cr; Veo 3 w/ audio 720p 8s 58 cr.

**"Unlimited" mechanics:** Plus = "365-day unlimited" on select image models + 5,000 Soul V2/Cinema gens; Ultra = unlimited on ONE chosen video model, annual billing only, speed-throttled during high traffic.

**Gotchas (documented):**
- Monthly credits don't roll over; top-up packs (~$5/100 cr) expire after 90 days
- Refunds only within 7 days, only if zero credits used, minus up to 6% fee; annual effectively non-refundable
- Checkout defaulted to annual billing → 1,000+ negative Trustpilot reviews
- Credits forfeited on cancellation; free-tier watermark removal requires paid regeneration

## Part 1c — Traction

- 15–20M+ users; ~5M videos/day; 50M+ videos; 3B+ social impressions; 85% of usage from social-media marketers
- Revenue: $10M ARR (Apr 2025) → $50M (Aug 2025) → $100M (Nov 2025) → $200M (Jan 2026) → $500M annualized (Jun 2026); targeting $1B by end 2026
- Funding: ~$138M total; $1.3B valuation (Jan 2026); in talks at $5B pre-money (Jun 2026). Enterprise contracts $200K+/yr
- Ships 4–7 features/week; Higgsfield Earn creator program (10,000+ creators, $1M+ paid)

## Part 1d — Documented weaknesses

**Product/tech**
- Queue times & throttling: unlimited-tier users report 5–6 h queues vs ~1 min for credit generation; peak-hour queues 4–12 min even with priority; "unlimited" deliberately speed-throttled to push credit purchases
- Quality consistency / credit drain: iterating to a usable result burns credits fast — top cost friction
- No proprietary frontier model: video quality depends on Sora/Veo/Kling/Seedance — commoditization + platform-dependency risk
- API immaturity: gated behind higher tiers, sparse docs, expiring credits
- Watermarks on free tier; removal requires paid regeneration

**Business/trust**
- Trustpilot 3.2–3.7/5 (1,200+ reviews); BBB complaints; themes: hidden caps on "unlimited," slow support, refund obstruction, surprise annual billing
- Misleading marketing: stock footage passed off as AI output in demos (productgrowth.blog teardown)
- Content-safety scandal: Earn program incentivized racist videos and nonconsensual celebrity deepfakes (Forbes via productgrowth.blog); creator payment problems; X account suspended
- Content moderation at scale flagged as key risk (Sacra)

## Part 1 Sources

- https://higgsfield.ai/ · /ai-video · /pricing · /soul · /soul-intro · /apps · /ads · /mcp · /marketing-studio-intro · /cinematic-video-generator · /blog/cinema-studio-3 · https://cloud.higgsfield.ai/
- https://geo.higgsfield.ai/higgsfield-ai-features-full-guide-2026 · https://geo.higgsfield.ai/task/blog/higgsfield-ai-pricing-plans
- https://sacra.com/c/higgsfield/ · https://www.productgrowth.blog/p/higgsfield-growth-teardown · https://getlatka.com/companies/higgsfield.ai
- https://www.techtimes.com/articles/319394/20260630/ai-video-startup-higgsfield-hits-500m-revenue-eyes-5b-funding-round.htm · https://cryptobriefing.com/higgsfield-ai-funding-5b-valuation/ · https://www.prnewswire.com/news-releases/higgsfield-advances-its-creator-first-platform-with-cinema-studio-2-0--302698249.html
- https://www.imagine.art/blogs/higgsfield-ai-pricing · https://aifunnelinsider.com/higgsfield-ai-review-2026/ · https://ucstrategies.com/news/higgsfield-ai-review-2026-pros-cons-pricing-features/
- https://www.trustpilot.com/review/higgsfield.ai · https://www.bbb.org/us/ca/san-francisco/profile/artificial-intelligence/higgsfield-ai-1116-977987/complaints
- https://kolbo.ai/blog/higgsfield-suite-100-camera-presets · https://www.wireflow.ai/blog/best-higgsfield-api-alternatives-in-2026 · https://apidog.com/blog/higgsfield-api/

Caveats: exact plan prices/credits conflict across 2026 sources (pricing changes frequently; higgsfield.ai/pricing is JS-rendered). Forbes exposé details sourced via productgrowth.blog, not the original article.

---

# Part 2 — Community complaints & wish-list (ranked, evidence-backed)

**Method note:** Trustpilot blocked direct fetch; cited via search-indexed summaries and secondary reviews. Trustpilot ~3.2/5 (1,200+ reviews, late-2025 review-bombing wave); BBB 18 formal complaints; G2 4.5–4.8/5 (small happy base); Product Hunt 4.7/5. Casual users love it; heavy users and billing victims are furious.

## Ranked complaints / most-requested features

| # | Wish | Signal | Evidence (condensed) |
|---|------|--------|----------------------|
| 1 | **Honest "unlimited"** — no throttling, caps, or bans | HIGH | Dec 19 2025 mass ban of heavy unlimited users ("Christmas purge") → review-bombing + BBB complaints; concurrency cut 8→2 post-purchase; unlimited gens take 2 min–2+ h vs <1 min credit mode; unlimited capped at 720p/5 s; only Soul V2 truly unlimited; Sora 2/Veo 3.1 have zero allocation on any tier |
| 2 | **Transparent billing** — no annual-default checkout, real refunds | HIGH | Checkout defaults to annual every page load; "Ultra shows $99/mo but charges $1,188"; 7-day refund window + 6% fee; refunds only after chargeback threats; BBB: "withdrew THOUSANDS… without my permission"; advertised $1=50 credits, delivered $1=25 |
| 3 | **Fairer credit economics** — rollover, no expiry, no charge for failures | HIGH | Monthly credits forfeit at renewal; top-ups expire in 90 days; Sora 2/Veo 3.1 = 40–70 cr/clip = $3.36–$9.33 per usable clip; 25–50% failure rate still consumes credits; ~$0.88/video vs Kling $0.35, Pika $0.16, Freepik $0.05 |
| 4 | **Credit-spend transparency in UI** | MED-HIGH | Supercomputer agent task expected ~100 cr, spent ~300 (hidden intermediary gens); mobile app resets "Unlimited" toggle every generation, silently spending credits |
| 5 | **Native 4K / high-res output** | HIGH | Maxes 1080p (720p unlimited) while Runway/Kling 3.0 do 4K; upscaling costs 12–20+ extra credits |
| 6 | **Native audio generation / sync** | MED-HIGH | Runway/Kling 3.0 have native synced audio, Higgsfield doesn't; Veo audio via Higgsfield "not ad-ready" |
| 7 | **Longer clips / multi-shot sequences** | MED | ~8 s cap (5 s unlimited) vs Runway 16 s, Kling up to 3 min with six connected scenes |
| 8 | **Faster / predictable queues** | MED-HIGH | Peak queues 4–12 min even with priority; Ultra users report 12+ min; G2 cons cite slowness |
| 9 | **Responsive support** | HIGH | 48+ h ticket times; BBB: "support chat extremely disrespectful"; 9 of 18 BBB complaints unanswered (bimodal — G2 praises it) |
| 10 | **Built-in editing timeline / scene editor** | MED | "No scene-level editor… biggest expectation mismatch"; Runway's workflow depth is a stated switch reason |
| 11 | **Character consistency across shots/models** | MED | Soul ID doesn't integrate with Kling Motion Control → face drift in multi-shot sequences; consistency across clips "still a challenge" (Soul ID also praised — extend, don't replace) |
| 12 | **Saner content moderation** | MED | NSFW filter blocked legitimate commercial prompts (modest swimwear); filters tightened retroactively on paid unlimited plans |
| 13 | **Output reliability / prompt adherence** | MED | 11 of 18 BBB complaints are quality ("deviated from prompt"); ~1-in-4 hit rate on Kling 3.0 via Higgsfield; Runway re-roll 1.3 attempts vs worse |
| 14 | **Pro pipeline: API all tiers, ProRes/alpha, batch, video-to-video** | LOW-MED | MP4 only, no alpha, no timeline export, no API on lower tiers; Runway has batch + video-to-video |
| 15 | **Onboarding/tutorials + team seat management** | LOW | G2 asks for tutorials; BBB complaint: can't transfer credits/accounts when employees leave |

## Churn — where users go and why

| Destination | Why |
|---|---|
| **Kling AI** (biggest winner) | 2–5× cheaper ($0.35 vs $0.88/video), native audio, 3-min multi-shot, 4K. Power users go direct to the model Higgsfield resells |
| **Runway** | Pro work: 4K, 16 s, native audio, batch, video-to-video, lowest re-roll, deep editing |
| **Pika** | Budget (~$0.16/video), generous free credits |
| **Freepik** | Cheapest (~$0.05/video) + stock bundle |
| **Hedra** | Talking-head/lip-sync specialization |

Churn triggers are **trust destruction**, not feature gaps: Dec 2025 unlimited bans, accidental annual charges, refund denials, credit-pack expiry.

## What users praise (table stakes for a competitor)

1. Multi-model aggregation (15+ models, one sub) — *the* core value prop
2. Cinematic camera presets (70+ one-click moves, "replicates $5–15K rigs")
3. Soul ID character consistency ("among the best in category")
4. Human motion quality (beats Runway Gen-4 on biomechanics)
5. Ease of use / fast image gen / LipSync Studio
6. Claude/MCP integration
7. Free daily credits (10/day)

**Competitor takeaway:** the product is liked — the wound is self-inflicted (billing dark patterns, fake unlimited, credit opacity). Match multi-model access + camera presets + character lock, with honest flat pricing, rollover credits, native audio/4K — and you attack exactly where the community is angriest.

## Part 2 Sources

- https://aifunnelinsider.com/higgsfield-ai-review-2026/ · https://aiimagetovideo.pro/blog/higgsfield-unlimited/
- https://www.bbb.org/us/ca/san-francisco/profile/artificial-intelligence/higgsfield-ai-1116-977987/complaints
- https://theneuralfeed.com/article/stay-away-from-higgsfield-ai-total-predatory-bs-with-their-refunds/3tKtWyUd
- https://apostle.io/compare/runway-vs-higgsfield/ · https://apostle.io/compare/kling-vs-higgsfield/
- https://morphed.app/blog/higgsfield-alternatives · https://hackceleration.com/labs/review/higgsfield
- https://www.g2.com/products/higgsfield/reviews · https://www.producthunt.com/products/higgsfield/reviews
- https://www.gstory.ai/blog/higgsfield-ai/ · https://framia.converge.ai/blog/higgsfield-review
- https://www.creativepadmedia.com/does-higgsfield-allow-nsfw-yes-but-theres-a-catch/
- https://www.aitoolcurator.com/learn/higgsfield-guide/cancel-subscription/
- https://www.trustpilot.com/review/higgsfield.ai (direct fetch blocked)
- https://blog.republiclabs.ai/2026/02/the-downfall-of-higgsfield-ai-exposing.html (competitor blog — biased)
