# Omni3D — Unified 3-Phase Workspace (UI Wireframe)

One production viewport, three phase tabs. The multi-view canvas, 3D skeletal viewer, animation
timeline, and engine optimization settings all live in the same window — switch phase, not app.

```
┌─ OMNI3D ──────────────────────────────────────────────────────────────────────────────────┐
│ Job: bronze_knight   [① STRUCTURE]  [② RIG & ANIMATE]  [③ COMPILE & SYNC]                   │
│ GEN ███████████░░░░░ 62%   Loop A ✔   Loop B ✔   Loop C ◐   ● Live-Sync: UE5 connected      │
├──────────────┬───────────────────────────────────────────────────────┬─────────────────────┤
│ TOOLS        │                  PRODUCTION VIEWPORT                    │ INSPECTOR           │
│ (phase ①)    │                                                         │ (context-sensitive) │
│              │   ┌─ multi-view ─┐                                      │                     │
│ ◉ Carve      │   │ ◳ front  ◳ R │      ┌───────────────────┐          │ Poly-Budget         │
│ ○ Draw       │   │ ◳ back   ◳ L │      │                   │          │  Mobile/XR  <5k     │
│ ○ Smooth     │   └──────────────┘      │   3D / VOXEL      │          │  ▶Hero    20–50k    │
│ ─────────    │                         │   DRAFT VIEW      │          │  Nanite   dense     │
│ ⊕ Asymmetry  │   gizmo ✛               │                   │          │  [====|===] 32k     │
│ ⊕ Kitbash    │                         │   (brush here)    │          │ ─────────────────   │
│ ⊕ UV Seams   │                         └───────────────────┘          │ PBR  ☀ delight ✔    │
│ ⊕ Style Anc. │                                                         │  albedo|norm|rough  │
│              │   [◀ scrub multi-view frames ▶]                         │  metal |emissive◉   │
├──────────────┴─────────────────────────────────────────────────────────┴─────────────────────┤
│ TIMELINE / GEN-GRAPH                                                                          │
│ A1 Sampler ─► A2 Voxel[30%]●you-are-here ─► A3 Retopo ─► B1 Rig ─► B2 Mocap ─► C EITL ─► Sync │
│ ◀──────────────────────────────────────────────────────────────────────────────────────────▶│
└──────────────────────────────────────────────────────────────────────────────────────────────┘
```

## Phase ② — Rig & Animate (same window, tab switch)

```
│ TOOLS (phase ②)│            3D SKELETAL VIEWER              │ INSPECTOR                        │
│ ◉ Auto-Rig     │      ○─┐ spine_03                          │ Rig: ▶UE5 SK_Mannequin           │
│ ○ Weight Paint │   clav_l ●──● upperarm_l                   │      Unity Humanoid              │
│ ○ Joint Nudge  │         │    └──● lowerarm_l──● hand_l      │ Joints 67 · conf 0.93            │
│ ○ Mocap Import │      pelvis ●                               │ Skin: heat-diffuse ≤4/vtx        │
│                │       ╱   ╲                                 │ Foot-lock ▣  slide 0.3cm         │
│                │   thigh_l   thigh_r   (weight heat overlay) │ Mocap: walk_cycle.mov 51-joint   │
├────────────────┴────────────────────────────────────────────┴──────────────────────────────────┤
│ ANIM TIMELINE  ◀│▶  walk_cycle  0:00 ──●──────── 2:00   keys●●● ● ●  [bake FBX]  IK ▣ ground ▣  │
```

## Phase ③ — Compile & Sync (EITL)

```
│ EITL PANEL                                   │ EXPORT / LIVE-SYNC                                │
│ watertight   ✔     normals      ✔            │ Target: ▶UE5 (1u=1cm)   Unity (URP)              │
│ delight      ✔     vertex-tear  ✔            │ Materials: auto MI · ORM packed · emissive ×2.5  │
│ E = 0.0195  ≤  T = 0.05   PASS ✔             │ ● ws://127.0.0.1:8788  streaming…                │
│ micro-repair: none (0 passes)                │ [ PUSH TO ENGINE ]   [ Export FBX/GLB/STL ]      │
```

## Layout rules
- **Top bar** — job name · phase tabs · global gen progress · per-loop status · Live-Sync light.
- **Left** — phase-scoped tools (features 1–9 surface here per phase).
- **Center** — single viewport; multi-view inset (①) / skeleton overlay (②) / EITL report (③).
- **Right** — context inspector: poly-budget + PBR (①), rig standard + weights (②), EITL + export (③).
- **Bottom** — unified gen-graph (① / ③) doubling as the animation timeline (②); the same nodes
  map 1:1 to the payload chain in `docs/payloads/`.
