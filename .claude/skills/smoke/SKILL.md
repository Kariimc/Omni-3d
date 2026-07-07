---
name: smoke
description: Scaffold a new Omni3D smoke suite (src/smoke-<thing>.ts) in the house style and wire it into `npm run check` and package.json. Use whenever a feature, bug fix, or WO needs test coverage — every feature in this repo ships with its own smoke. Args: the thing under test, e.g. "/smoke queue" or "/smoke assets negative-path traversal".
---

# /smoke — scaffold and wire a smoke suite

Every feature in Omni3D is tested by a bespoke `src/smoke-<thing>.ts` script (no test
framework), chained into `npm run check`. This skill produces one that matches the house style
exactly, so it passes review without rework.

## Inputs

`args` = the feature name (kebab-case) and optionally what to cover. If a WO is in progress,
read its acceptance criteria — the smoke must assert exactly those.

## Procedure

1. **Study the two nearest precedents.** Read `src/smoke-assets.ts` (network + temp-dir +
   env-var pattern) and the existing smoke closest to your feature (`smoke-bus.ts` for
   pub/sub, `smoke-live-replay.ts` for WS ordering, `smoke-retopo.ts` for providers,
   `smoke.ts` for pure route inject tests). Copy their shape, not internet patterns.

2. **Create `src/smoke-<thing>.ts`** with this exact skeleton:

   ```ts
   /** <WO-NN if any> smoke — <one line: what it proves, including the negative cases>. */
   import { mkdtempSync, rmSync } from "node:fs";   // only if files are involved
   import { tmpdir } from "node:os";
   import { join } from "node:path";

   // Env overrides MUST be set BEFORE importing the code under test:
   process.env.SOME_KNOB = "small-value-so-the-negative-test-is-cheap";
   const { buildApp } = await import("./app");      // dynamic import AFTER env setup
   const { MemoryJobStore } = await import("./store/memory");

   let fails = 0;
   const check = (ok: boolean, label: string): void => {
     console.log(`  ${ok ? "✓" : "✗"} ${label}`);
     if (!ok) fails++;
   };

   async function main(): Promise<void> {
     console.log("Omni3D — <thing> smoke\n");
     // ...numbered sections: happy path first, then every negative case...
     if (fails > 0) { console.error(`\n${fails} CHECK(S) FAILED`); process.exit(1); }
     console.log("\n<THING> SMOKE PASS");
   }

   main().catch((err) => { console.error(err); process.exit(1); });
   ```

   House rules baked into the skeleton — do not deviate:
   - Self-contained: own `mkdtempSync` temp dir (cleaned with `rmSync` at the end), own env
     vars, no shared state with other smokes, no required credentials or network. If the
     feature has an optional real backend (pg/Supabase), test against a fake by default and
     run the real branch only `if (process.env.X)` — see `smoke-bus.ts`.
   - HTTP: prefer `app.inject()`; use `app.listen({ port: 0, host: "127.0.0.1" })` + `fetch`
     only when multipart/WS/streams require a real socket. Always `await app.close()`.
   - Deterministic: no sleeps for correctness — await the actual signal (event, promise, seq).
   - At least one happy path AND at least one negative case (bad input → 4xx, cap exceeded,
     traversal blocked, ordering violated). Check labels state the expected observation with
     the measured value interpolated, e.g. `` `downloaded glb: ${glb.length} bytes` ``.
   - Paths via `node:path` only (Windows dev box).

3. **Wire it in** — both places, same commit:
   - `package.json` scripts: `"smoke:<thing>": "tsx src/smoke-<thing>.ts"`.
   - Append `&& npm run smoke:<thing>` to the `check` script chain.

4. **Prove it can fail.** Temporarily break one assertion's input (or the code under test),
   run `npm run smoke:<thing>`, confirm a `✗` and exit code 1, then restore. A smoke that
   can't fail is worthless — do not skip this step.

5. **Run the full gate:** `npm run check` must be green end-to-end. Paste the new smoke's
   output block in the PR description.

## Never

- Weaken or edit an existing smoke's assertions to make yours pass.
- Add a test framework or new devDependency.
- Depend on execution order relative to other smokes, or on `data/` contents.
