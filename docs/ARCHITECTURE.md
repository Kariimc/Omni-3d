# Omni3D — Closed-Loop System Architecture

> Video-native 3D production studio. Input text / image / 2D video → output game-ready,
> auto-rigged, animated assets, live-synced into **UE5** and **Unity**.

**Plain English:** You hand Omni3D a phone video of an object (or a text prompt). It rebuilds
the object in 3D, gives it clean geometry, paints its textures with the lighting removed, builds
a working skeleton inside it, copies motion from a second video onto that skeleton, checks the
result against real game-engine rules, fixes its own mistakes, and pushes the finished asset
straight into Unreal or Unity — no manual file juggling.

---

## 1. Deliverable 1 — Closed-Loop Flow Architecture (text diagram)

Legend: `◄── USER` = human-in-the-loop intervention · `back-edge` = automatic self-correction.

```
   INPUTS                 ┌──────────────────────────────────────────┐
   text  ───────────────► │   MULTI-MODAL INGEST (shared latent)      │
   image ───────────────► │   text  : CLIP ViT-L/14 + T5-XXL          │
   video (.mp4/.mov) ───► │   visual: DINOv2 ViT-G/14 (keyframes)     │
   motion video ──┐       └───────────────┬──────────────────────────┘
                  │                        │
  ╔═══════════════╪════ LOOP A — VIDEO-TO-ASSET (STRUCTURAL) ═══════════════════╗
  ║               │   Temporal Frame Sampler (SfM/COLMAP, blur reject)          ║
  ║               │            │                                                ║
  ║               │            ▼                                                ║
  ║               │   NeRF / Triplane density ──► [30%] SPARSE VOXEL DRAFT      ║
  ║               │                                       │                     ║
  ║               │      ◄── USER ── Voxel Draft Tweaker (carve/draw/smooth)    ║
  ║               │      ◄── USER ── Asymmetrical Fusion (mirror override)      ║
  ║               │                                       ▼                     ║
  ║               │   FlexiCubes high-fi mesh ──► Poly-Budget Retopology        ║
  ║               │                              (curvature quad flow 5k–50k)   ║
  ║               │      ◄── USER ── UV Seam Painter / Poly slider / Kitbash    ║
  ║               │                                       │                     ║
  ║               │   Inverse-render PBR Delight ◄────────┘                     ║
  ║               │   (Albedo / Normal / Rough / Metal / Emissive)              ║
  ╚═══════════════╪═══════════════════════════════╤═════════════════════════════╝
                  │                                │ optimized mesh + PBR
                  │                                ▼
  ╔═══════════════╪════ LOOP B — AUTO-RIG & MOCAP RETARGET ═══════════════════════╗
  ║               │   Voxelize ─► 3D GNN Joint Prediction                         ║
  ║               │              (UE5 SK_Mannequin / Unity Humanoid)              ║
  ║               │                      │                                        ║
  ║               │                      ▼                                        ║
  ║               │   Volumetric Heat-Diffusion Skin Weighting (≤4 inf / vtx)     ║
  ║   motion ─────┘                      │                                        ║
  ║   video ─► WHAM 51-joint capture ─► Analytical IK + Foot-Lock solver          ║
  ║                                      │  (kill foot-slide / jitter)            ║
  ║                                      ▼                                        ║
  ║                            Bake animation ► FBX animstack                     ║
  ╚══════════════════════════════════════╤═══════════════════════════════════════╝
                                         │ rigged mesh + baked clip
                                         ▼
  ╔════ LOOP C — ENGINE-IN-THE-LOOP COMPILER (EITL) ════════════════════════════╗
  ║   Headless UE/Unity ruleset  ─►  Virtual Sandbox Test                        ║
  ║   CHECK: watertight • normals • delit • vertex-tear • UV-overlap             ║
  ║   COST:  E = w1·L_manifold + w2·L_intersections + w3·L_vertex_tear           ║
  ║                 │                                                            ║
  ║         ┌───────┴────────┐                                                   ║
  ║   E ≤ T │                │ E > T ─► mask failure site                        ║
  ║   PASS  ▼                ▼         ─► micro-inpaint re-run Phase 2/3 ──┐      ║
  ║   Live-Sync Bridge   (back-edge feedback to Loop A / B) ◄─────────────┘      ║
  ║   WebSocket push ─► UE5 / Unity  (master materials, ORM, scale = 1 cm)       ║
  ╚═════════════════════════════════════════════════════════════════════════════╝
```

---

## 2. The Three Loops (plain English)

| Loop | Name | What it does | Self-correction |
|------|------|--------------|-----------------|
| **A** | Video-to-Asset Structural | Turns a panning video into clean 3D geometry + de-lit textures. Pauses at a rough "voxel" draft so you can sculpt before the detailed bake. | Re-bakes geometry when your brush strokes change the latent shape weights. |
| **B** | Auto-Rig & Mocap Retarget | Predicts a skeleton inside the mesh, paints smooth skin weights, captures motion from a second video, and removes foot-sliding. | IK + foot-lock solver re-solves any frame whose foot drifts off the ground plane. |
| **C** | Engine-in-the-Loop Compiler | Runs the asset through real UE5/Unity rules in a headless sandbox before export. | If the error score `E` exceeds threshold `T`, it masks the bad spot and re-runs only that area through Phase 2/3, then re-tests. |

---

## 3. Phased Network Blueprint (jargon → plain English)

- **Multi-modal ingest** — *"reads text, pictures and video into one shared understanding"*
  - Text: **CLIP ViT-L/14 + T5-XXL** → drives cross-attention everywhere downstream.
  - Visual: **DINOv2 ViT-G/14** → dense feature maps that keep edges, hidden parts, micro-texture.
- **Phase 1 — Neural Surface Reconstruction** — *"build a 3D shape from camera angles"*
  - Triplane **Latent Diffusion** + **Instant-NGP NeRF** grid; **COLMAP SfM** picks sharp frames and camera rays. At 30% it freezes a **Sparse Voxel Octree** draft; brush strokes edit the signed-distance weights so the final bake respects your carving.
- **Phase 2 — Topology + Inverse PBR** — *"make tidy quads and remove baked-in lighting"*
  - **FlexiCubes** extracts the mesh; an **Anisotropic Cross-Field Curvature Net** lays quad loops along the surface's curves *(grid that lines up squares along the model's curves)*; inverse rendering with **spherical harmonics** strips lighting → clean Albedo + Normal/Roughness/Metallic/Emissive.
- **Phase 3 — Auto-Rig + Motion Transfer** — *"put a skeleton in and copy real movement onto it"*
  - **3D Volumetric GNN** predicts joint XYZ (UE5 SK_Mannequin / Unity Humanoid); **Heat-Diffusion** skin weights; **WHAM** temporal transformer captures 3D motion; **Analytical IK** with ground-collision kills jitter/foot-slide before FBX bake.

### EITL verification cost function

```
E = w1·L_manifold + w2·L_intersections + w3·L_vertex_tear
```

If `E > T`: latent features at the failure site are masked and a **localized inpainting pass**
re-runs Phase 2/3 over only that area — clean deploy guaranteed before Live-Sync push.

---

## 4. 11 Features → Loop / Phase map

| # | Feature | Loop | Phase | Payload field |
|---|---------|------|-------|---------------|
| 1 | Voxel Draft Tweaker | A | 1 | `voxelDraft.userEdits.brushStrokes` |
| 2 | Asymmetrical Fusion | A | 1 | `voxelDraft.userEdits.asymmetry` |
| 3 | Poly-Budget Retopology | A | 2 | `retopology.polyBudget` |
| 4 | UV Seam Painter | A | 2 | `retopology.uvSeams` |
| 5 | PBR Relight / Delight | A | 2 | `retopology.pbr` |
| 6 | Watertight Scanner | A→C | 2/EITL | `retopology.watertight`, `eitl.checks` |
| 7 | AI Kitbashing | A | 1 | `job.features.kitbash` (locked transforms) |
| 8 | Emissive / Particle Mapping | A | 2 | `retopology.pbr.emissiveTerms` |
| 9 | Style Anchors | A | 1–2 | `job.features.styleAnchors` |
| 10 | Live-Sync Bridges | C | EITL | `eitl.liveSync` |
| 11 | Auto-Rig + Video Mocap | B | 3 | `rigging.*`, `animation.*` |

---

## 5. Engine export standards

- **UE5** — scale `1 unit = 1 cm`; auto Material Instances (Albedo→Base Color, Normal→Normal,
  packed **ORM**, Emissive→Emissive + scalar intensity); skeletal mesh accepts existing AnimBPs.
- **Unity** — URP/HDRP texture packing; non-overlapping **secondary lightmap UVs**; zero vertex
  tearing at joints during Mecanim playback.

---

## 6. Payload ↔ Loop conformance (self-check)

Every payload in `docs/payloads/` carries `$omni3d`, `jobId`, `loop`, and `nextStage`, forming a
verifiable chain. Loop C's back-edge (`microRepair.rerunPhases`) re-enters Phase 2/3 — preserving
the closed loop.

| Payload file | Loop | Stage | Self-correcting handle |
|--------------|------|-------|------------------------|
| `pipeline.job.json` | — | envelope | `loops.{A,B,C}.status` |
| `stageA1.frame_sampler.json` | A | sampler | `sharpnessThreshold` re-filter |
| `stageA2.voxel_draft.json` | A | 30% draft | `latentWeightDeltas` re-bake |
| `stageA3.retopology.json` | A | retopo/PBR | `curvatureField`, `watertight` |
| `stageB1.rigging_skinweights.json` | B | rig | `jointPrediction.confidence` |
| `stageB2.animation_retarget.json` | B | mocap | `footLock.slideResidualCm` |
| `stageC.eitl_validation.json` | C | compile | `costFunction`, `microRepair` |

**Conformance:** chain is unbroken `A1→A2→A3→B1→B2→C`; backward compatibility of the 3-loop
contract and the native UE5/Unity bone naming are preserved (no breaking changes introduced).
