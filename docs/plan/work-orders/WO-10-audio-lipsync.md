# WO-10 — Native audio + bone-driven lipsync

**Phase 3 · depends on WO-07, WO-09 · branch `wo/10-audio-lipsync`**

## Goal
Generate speech (and optionally background audio) inside the platform and drive a rigged character's mouth from it — audio baked into video exports.

## Why
Community complaint #6: Higgsfield has no native audio; Kling/Runway do. And because Omni 3D characters are rigged 3D, lipsync can be **bone/viseme-driven** (deterministic) instead of pixel-space lipsync (uncanny) — another structurally-better move.

## Read first
- WO-09 character model (rig structure — check whether the rig standard includes jaw/face bones; `docs/payloads/stageB1.rigging_skinweights.json`), WO-07 gateway adapter pattern, WO-03 queue, ffmpeg usage from WO-08.

## Spec
1. **TTS providers** (`src/gateway/providers/tts-*.ts`): local first — Piper (or Kokoro) via the Python engine service (extend `engine/` with a `/generate/speech` endpoint); hosted adapter (ElevenLabs) optional behind env key. Contract: `GenerateSpeechRequest {text, voiceId?} → wav assetUri + phoneme/timing JSON` (Piper emits phoneme timing; otherwise derive rough timing from forced alignment or per-word duration heuristic — document which).
2. **Viseme mapping** (`src/audio/visemes.ts`): phoneme→viseme table (Preston-Blair 10-viseme set); generate a bone animation track for the jaw/mouth bones. **Fallback**: if the rig has no face bones, amplitude-driven jaw rotation on the head/jaw joint (honest "basic mode" flag in the result).
3. **Pipeline stage**: optional `audio` block on job payload `{speech: {text, voiceId}, applyLipsync: bool}`; runs after B2; output: animation clip with mouth track + wav.
4. **Muxing**: video renders (WO-08 server render, WO-11 later) gain `audioUri` and mux via ffmpeg.
5. **Web**: on a character's page — "Make it speak": textbox → preview clip with audio.

## Acceptance
```bash
npm run check
npm run smoke:audio      # NEW (mock/local): text → wav + timing json → animation clip
                         # containing a mouth/jaw track → mp4 with an audio stream
                         # (verify: ffprobe shows one video + one audio stream; paste output)
```
Manual (document): real Piper voice on a rigged character — mouth visibly moves with speech.

## Out of scope
Music generation, voice cloning, multi-speaker dialogue scenes (WO-11 sequencing handles ordering).
