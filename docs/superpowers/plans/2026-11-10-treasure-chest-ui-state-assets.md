# Treasure Chest UI State Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and integrate three-state world and UI art for all 16 loot object IDs, plus reusable opening effects, in the Cocos Creator exploration HUD.

**Architecture:** Keep the current simulation authoritative and add a small pure asset catalog that maps stable loot IDs and visual states to bundle paths. Generate/edit fixed 4×4 source sheets, slice them deterministically into runtime PNGs, then let `BattleHUDViewComp` layer an async-loaded sprite over its existing programmatic fallback and play one short opening effect only after a successful interaction.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Oops Framework bundle loading, Node test runner, PowerShell/System.Drawing normalization, OpenAI built-in image generation.

## Global Constraints

- Preserve all existing stable loot IDs and the existing simulation reward/state rules.
- Produce 16 IDs × 3 world states × 3 UI states = 96 transparent PNG state assets.
- World assets are 256×256 RGBA PNG; UI assets are 128×128 RGBA PNG.
- Produce 8 reusable transparent PNG effect assets.
- Preserve the existing post-apocalyptic industrial pixel-illustration style and stable visual ground point.
- Keep the current programmatic loot drawing as a fallback when an asset fails to load.
- Do not add all 16 loot types to world generation; only make their assets and mapping available.
- Do not modify unrelated dirty files or user changes.

---

## File Structure

- `scripts/slice-loot-chest-assets.ps1`: deterministic 4×4/state/effect slicer, alpha and dimension validation, preview and runtime manifest generation.
- `docs/design/assets/loot-chests/source-sheets/*.png`: generated/editable source sheets.
- `docs/design/assets/loot-chests/previews/*.png`: visual review composites.
- `docs/design/assets/loot-chests/prompts.md`: exact generation prompts and provenance.
- `assets/bundle/gui/loot-chests/**`: runtime world, icon and effect PNGs plus manifest.
- `assets/script/game/common/ui/LootChestAssets.ts`: pure stable-ID/state/path catalog.
- `assets/script/game/battle/LootChestPresentation.ts`: pure opening timing/profile helpers.
- `assets/script/game/battle/BattleHUDViewComp.ts`: sprite attachment, state reconciliation and one-shot effect playback.
- `tests/unit/ui/LootChestAssets.test.mjs`: catalog completeness and on-disk asset checks.
- `tests/unit/battle/LootChestPresentation.test.mjs`: opening timing/profile checks.
- `tests/integration/ui/BattleFlowBindings.test.mjs`: source-level HUD integration guard.

---

### Task 1: Deterministic Asset Pipeline and Catalog Contract

**Files:**
- Create: `scripts/slice-loot-chest-assets.ps1`
- Create: `assets/script/game/common/ui/LootChestAssets.ts`
- Create: `tests/unit/ui/LootChestAssets.test.mjs`

**Interfaces:**
- Produces: `LOOT_CHEST_IDS`, `LootChestId`, `LootChestVisualState`, `lootChestAssetPath(id, layer, state)`, `lootChestEffectPath(effect)`.
- Produces: runtime files under `assets/bundle/gui/loot-chests/{world,icons,effects}`.

- [ ] **Step 1: Write the failing catalog test**

```js
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";
import {
  LOOT_CHEST_EFFECTS,
  LOOT_CHEST_IDS,
  lootChestAssetPath,
  lootChestEffectPath,
} from "../../../assets/script/game/common/ui/LootChestAssets.ts";

test("loot chest catalog covers 16 stable ids and every state", () => {
  assert.equal(LOOT_CHEST_IDS.length, 16);
  assert.equal(new Set(LOOT_CHEST_IDS).size, 16);
  for (const id of LOOT_CHEST_IDS) {
    for (const layer of ["world", "icons"]) {
      for (const state of ["closed", "opening", "opened"]) {
        const path = lootChestAssetPath(id, layer, state);
        assert.equal(path, `gui/loot-chests/${layer}/${id}/${state}`);
      }
    }
  }
});

test("all catalog assets exist after slicing", () => {
  for (const id of LOOT_CHEST_IDS) {
    for (const layer of ["world", "icons"]) {
      for (const state of ["closed", "opening", "opened"]) {
        assert.equal(existsSync(`assets/bundle/${lootChestAssetPath(id, layer, state)}.png`), true);
      }
    }
  }
  assert.equal(LOOT_CHEST_EFFECTS.length, 8);
  for (const effect of LOOT_CHEST_EFFECTS) {
    assert.equal(existsSync(`assets/bundle/${lootChestEffectPath(effect)}.png`), true);
  }
});
```

- [ ] **Step 2: Run the catalog test and verify it fails**

Run: `node --test tests/unit/ui/LootChestAssets.test.mjs`

Expected: FAIL because `LootChestAssets.ts` does not exist.

- [ ] **Step 3: Implement the pure catalog**

```ts
export const LOOT_CHEST_IDS = [
  "supply-crate", "armory-crate", "bio-crate", "heavy-safe",
  "airdrop-crate", "hidden-cache", "weapon-case", "medical-cabinet",
  "scrap-pile", "alloy-stack", "electronics-cache", "energy-cell-crate",
  "fuel-drum", "ration-box", "blueprint-tube", "mutation-pod",
] as const;

export type LootChestId = typeof LOOT_CHEST_IDS[number];
export type LootChestAssetLayer = "world" | "icons";
export type LootChestVisualState = "closed" | "opening" | "opened";

export const LOOT_CHEST_EFFECTS = [
  "interaction-gold-ring", "technology-cyan-ring", "pollution-magenta-ring",
  "rare-white-gold-star", "opening-radial-flash", "diamond-particles",
  "reward-upward-trail", "completed-soft-glow",
] as const;

export type LootChestEffectId = typeof LOOT_CHEST_EFFECTS[number];

const LOOT_CHEST_ID_SET = new Set<string>(LOOT_CHEST_IDS);

export function isLootChestId(value: string): value is LootChestId {
  return LOOT_CHEST_ID_SET.has(value);
}

export function lootChestAssetPath(
  id: LootChestId,
  layer: LootChestAssetLayer,
  state: LootChestVisualState,
): string {
  return `gui/loot-chests/${layer}/${id}/${state}`;
}

export function lootChestEffectPath(effect: LootChestEffectId): string {
  return `gui/loot-chests/effects/${effect}`;
}
```

- [ ] **Step 4: Implement the slicer**

The PowerShell script must:

1. Read six square 4×4 sheets named `world-closed.png`, `world-opening.png`, `world-opened.png`, `icons-closed.png`, `icons-opening.png`, `icons-opened.png`.
2. Slice row-major using the exact `LOOT_CHEST_IDS` order above.
3. Resize world cells to 256×256 and icon cells to 128×128 with nearest-neighbor sampling.
4. Read `effects.png` as a 4×2 sheet in the exact `LOOT_CHEST_EFFECTS` order and resize cells to 256×256.
5. Reject non-square state sheets, non-2:1 effect sheets, fully opaque alpha output, or missing source files.
6. Save runtime files with the paths returned by the TypeScript catalog.
7. Create `docs/design/assets/loot-chests/previews/world-states.png`, `icon-states.png`, and `effects.png` on a dark review background.
8. Write `assets/bundle/gui/loot-chests/asset-manifest.json` with `schemaVersion`, `generatedAt`, `sourceTool`, `ids`, `states`, `effects`, sizes and output roots.

Use the existing `scripts/slice-map-interactables.ps1` rectangle math and `System.Drawing.Imaging.PixelFormat::Format32bppArgb`; do not infer cell boundaries from visible pixels.

- [ ] **Step 5: Run the catalog-only test**

Run: `node --test --test-name-pattern="catalog covers" tests/unit/ui/LootChestAssets.test.mjs`

Expected: PASS. The disk-existence test still fails until Task 2 creates and slices the sheets.

- [ ] **Step 6: Commit the pipeline contract**

```powershell
git add scripts/slice-loot-chest-assets.ps1 assets/script/game/common/ui/LootChestAssets.ts tests/unit/ui/LootChestAssets.test.mjs
git commit -m "feat: define loot chest asset pipeline"
```

---

### Task 2: Generate, Normalize and Validate the Art

**Files:**
- Create: `docs/design/assets/loot-chests/source-sheets/world-closed.png`
- Create: `docs/design/assets/loot-chests/source-sheets/world-opening.png`
- Create: `docs/design/assets/loot-chests/source-sheets/world-opened.png`
- Create: `docs/design/assets/loot-chests/source-sheets/icons-closed.png`
- Create: `docs/design/assets/loot-chests/source-sheets/icons-opening.png`
- Create: `docs/design/assets/loot-chests/source-sheets/icons-opened.png`
- Create: `docs/design/assets/loot-chests/source-sheets/effects.png`
- Create: `docs/design/assets/loot-chests/prompts.md`
- Create: `docs/design/assets/loot-chests/previews/*.png`
- Create: `assets/bundle/gui/loot-chests/**`

**Interfaces:**
- Consumes: fixed ID/effect ordering and slicer from Task 1.
- Produces: every runtime PNG referenced by `LootChestAssets.ts`.

- [ ] **Step 1: Seed the closed sheets from the approved existing art**

Copy without resampling:

- `docs/design/assets/map-interactables/source-sheets/03-world-loot-resource.png` → `world-closed.png`
- `docs/design/assets/map-interactables/source-sheets/01-ui-loot-resource.png` → `icons-closed.png`

These are the identity and composition references for all generated state variants.

- [ ] **Step 2: Generate the opening world sheet**

Use built-in image generation in edit mode with `world-closed.png` as the local reference and actual transparent output:

```text
Use case: precise-object-edit
Asset type: 4×4 game world-prop sprite source sheet
Primary request: transform every object into its distinct mid-opening or mid-search state while preserving all sixteen object identities and their exact cell positions
Composition: exact 4 columns × 4 rows, row-major, one centered object per cell, identical scale and ground contact to the reference
Style: post-apocalyptic industrial pixel illustration, dark outline, three-quarter top-down view
Constraints: preserve palette and identity; doors/lids partly open; resource piles visibly disturbed; no text; no labels; no watermark; no shadows crossing cell boundaries; transparent background
```

- [ ] **Step 3: Generate the opened world sheet**

Edit `world-closed.png` with the same invariant block, changing only the request to “fully opened or fully searched, visibly empty/collected, structurally believable, stable ground point.”

- [ ] **Step 4: Generate the two UI-state sheets**

Edit `icons-closed.png` twice. Preserve every circular dark plate and cyan outer ring. For `icons-opening`, use the matching half-open world silhouette plus a small radial highlight. For `icons-opened`, use the matching opened/empty silhouette, reduced brightness and a clear light check mark; do not rely on color alone.

- [ ] **Step 5: Generate the effect sheet**

Generate an independent transparent 4×2 sheet in this order: gold ring, cyan ring, magenta ring, white-gold star, radial flash, diamond particles, upward trail, soft completed glow. Each cell contains one centered isolated effect with generous transparent padding, no chest, no text, no watermark and no cross-cell overlap.

- [ ] **Step 6: Record prompts and provenance**

Write `prompts.md` with the exact seven source-sheet prompts, input-reference path, built-in image generation as the source tool, generation date `2026-11-10`, transparent-background requirement and commercial-review reminder.

- [ ] **Step 7: Slice and validate**

Run: `powershell -ExecutionPolicy Bypass -File scripts/slice-loot-chest-assets.ps1`

Expected: `Sliced 96 loot state assets and 8 effects` and no alpha/dimension errors.

- [ ] **Step 8: Run the complete asset test**

Run: `node --test tests/unit/ui/LootChestAssets.test.mjs`

Expected: PASS.

- [ ] **Step 9: Inspect the three preview sheets**

Verify all IDs remain in their original cells, opening/opened poses are distinct, checkerboard is not baked into alpha, no object crosses a cell boundary, and state changes do not shift the ground point.

- [ ] **Step 10: Import PNGs through Cocos Creator**

Open the project once in Cocos Creator 3.8.8 or use the installed Creator asset database refresh so `.meta` files are generated by Creator. Do not hand-author UUID-bearing metadata. Confirm one world texture resolves through `oops.res.load("bundle", textureAssetPath(path), Texture2D)`.

- [ ] **Step 11: Commit generated art and provenance**

```powershell
git add docs/design/assets/loot-chests assets/bundle/gui/loot-chests
git commit -m "art: add loot chest state and effect assets"
```

---

### Task 3: Pure Opening Presentation Model

**Files:**
- Create: `assets/script/game/battle/LootChestPresentation.ts`
- Create: `tests/unit/battle/LootChestPresentation.test.mjs`

**Interfaces:**
- Consumes: `LootChestId`, `LootChestVisualState`, and effect IDs from `LootChestAssets.ts`.
- Produces: `lootChestEffectProfile(typeId)`, `lootChestVisualState(opened, openingRemaining)`, `advanceLootChestOpening(remaining, deltaTime)`, `LOOT_CHEST_OPENING_SECONDS`.

- [ ] **Step 1: Write failing timing/profile tests**

```js
test("opening transitions to opened after the fixed window", () => {
  assert.equal(lootChestVisualState(false, 0), "closed");
  assert.equal(lootChestVisualState(true, 0.2), "opening");
  assert.equal(lootChestVisualState(true, 0), "opened");
  assert.equal(advanceLootChestOpening(0.42, 0.5), 0);
});

test("effect profiles distinguish normal tech bio and rare loot", () => {
  assert.equal(lootChestEffectProfile("supply-crate").ring, "interaction-gold-ring");
  assert.equal(lootChestEffectProfile("energy-cell-crate").ring, "technology-cyan-ring");
  assert.equal(lootChestEffectProfile("bio-crate").ring, "pollution-magenta-ring");
  assert.equal(lootChestEffectProfile("heavy-safe").burst, "rare-white-gold-star");
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/unit/battle/LootChestPresentation.test.mjs`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the minimal pure model**

Set `LOOT_CHEST_OPENING_SECONDS = 0.48`. Use `Math.max(0, remaining - Math.max(0, deltaTime))`. Group tech IDs (`armory-crate`, `electronics-cache`, `energy-cell-crate`, `blueprint-tube`) under the cyan ring; bio IDs (`bio-crate`, `mutation-pod`) under magenta; rare IDs (`heavy-safe`, `airdrop-crate`, `hidden-cache`, `weapon-case`) use the white-gold burst; every other ID uses gold and the radial flash.

- [ ] **Step 4: Run and verify pass**

Run: `node --test tests/unit/battle/LootChestPresentation.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the pure model**

```powershell
git add assets/script/game/battle/LootChestPresentation.ts tests/unit/battle/LootChestPresentation.test.mjs
git commit -m "feat: model loot chest opening presentation"
```

---

### Task 4: Integrate World Sprites and One-Shot Effects

**Files:**
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Modify: `tests/integration/ui/BattleFlowBindings.test.mjs`

**Interfaces:**
- Consumes: catalog paths and pure presentation functions from Tasks 1 and 3.
- Preserves: `BattleSimulation.interact(id)` as the only reward/state mutation path.

- [ ] **Step 1: Add failing integration guards**

Assert that `BattleHUDViewComp.ts` imports `lootChestAssetPath`, `isLootChestId`, `lootChestEffectProfile`, and `advanceLootChestOpening`; contains `lootOpeningRemaining`; calls `UIBuilder.sprite` with a `gui/loot-chests/world/` path; and starts opening only after `result.accepted`.

- [ ] **Step 2: Run the integration guard and verify failure**

Run: `node --test tests/integration/ui/BattleFlowBindings.test.mjs`

Expected: FAIL on the new loot presentation assertions.

- [ ] **Step 3: Add state tracking**

Add:

```ts
private readonly lootOpeningRemaining = new Map<string, number>();
private readonly lootVisualState = new Map<string, LootChestVisualState>();
private readonly lootEffectNodes = new Map<string, Node>();
```

In `activateInteraction`, capture the target before calling `interact`. After `result.accepted`, look up `simulation.loot.find(item => item.id === result.targetId)`; only for a loot hit, set its opening time to `LOOT_CHEST_OPENING_SECONDS`. Restored `opened` values never enter this map.

- [ ] **Step 4: Attach sprites over the fallback**

When a loot node is created or reused:

1. Keep the existing `Graphics` fallback.
2. Resolve `typeId` with `isLootChestId`.
3. Compute state from `opened` and opening remaining.
4. Destroy only the previous child named `LootArt`, then call `UIBuilder.sprite(node, lootChestAssetPath(typeId, "world", state), new Size(104, 104), Vec3.ZERO, false, Color.WHITE, "contain")`.
5. Rename the returned sprite node to `LootArt` and disable the fallback `Graphics` only after the texture loads successfully.
6. Before applying an async result, verify `node.isValid`, `node.name === Loot:<id>` and the desired state still matches to prevent pooled-node races.

- [ ] **Step 5: Play the reusable effect stack**

On transition into `opening`, create/reuse one effect root for the loot ID, attach ring + radial/burst + upward trail with `UIBuilder.sprite`, and animate with Cocos `tween` over 0.48 seconds: scale `0.72 → 1.12 → 1`, opacity `0 → 255 → 0`, and Y offset `0 → 30`. Destroy or pool only the effect children after completion; never mutate the simulation from the tween callback.

- [ ] **Step 6: Advance and reconcile state**

During `update`, advance opening timers only when gameplay is not paused and the full map is closed. Refresh a loot visual only when its computed state changes. When a streamed node leaves the active set, clear transient timers/effects for its instance ID; if it later returns opened, show `opened` directly.

- [ ] **Step 7: Add UI-state usage to the interaction panel**

Create/reuse one `InteractionLootIcon` node in the interaction panel. For a loot target, display `icons/<typeId>/closed`; hide it for exploration targets. Immediately after interaction succeeds, allow the world animation to play while the panel hides because the object is no longer interactable.

- [ ] **Step 8: Run focused tests**

Run:

```powershell
node --test tests/unit/ui/LootChestAssets.test.mjs tests/unit/battle/LootChestPresentation.test.mjs tests/integration/ui/BattleFlowBindings.test.mjs tests/unit/battle/BattleSimulation.test.mjs
```

Expected: PASS, including the existing one-shot reward test.

- [ ] **Step 9: Commit the integration**

```powershell
git add assets/script/game/battle/BattleHUDViewComp.ts tests/integration/ui/BattleFlowBindings.test.mjs
git commit -m "feat: present animated loot chest states"
```

---

### Task 5: Final Validation and Documentation

**Files:**
- Modify: `docs/design/15-map-interactable-assets.md`
- Modify: `docs/design/assets/loot-chests/prompts.md`

**Interfaces:**
- Consumes: all generated assets and runtime integration.
- Produces: final human-readable usage and provenance record.

- [ ] **Step 1: Run static and test verification**

Run:

```powershell
git diff --check
node --test tests/unit/ui/LootChestAssets.test.mjs tests/unit/battle/LootChestPresentation.test.mjs tests/integration/ui/BattleFlowBindings.test.mjs tests/unit/battle/BattleSimulation.test.mjs
npx tsc --noEmit
```

Expected: no whitespace errors, all tests PASS, TypeScript exits 0.

- [ ] **Step 2: Validate every PNG mechanically**

Use the slicer validation path to confirm exactly 96 state assets and 8 effects, exact dimensions, RGBA/alpha presence, unique non-empty pixel bounds and no missing manifest entry.

- [ ] **Step 3: Perform Cocos Creator visual checks**

At 1334×750 and one shorter safe frame:

1. Enter daytime exploration.
2. Verify the four currently spawned loot types display real closed art.
3. Verify hidden cache remains invisible until radar reveal.
4. Open each visible type and confirm exactly one 0.48-second effect, one reward event and a persistent opened pose.
5. Leave and re-enter the streamed area; opened loot must not replay the burst or grant rewards.
6. Temporarily rename one texture in an uncommitted local check and verify the graphics fallback stays visible; restore it immediately.
7. Confirm interaction-panel icons remain readable at 48–64 px.

- [ ] **Step 4: Update the asset guide**

Add the new directory, three-state semantics, effect reuse rule, runtime catalog path, source-sheet prompts and import note to `docs/design/15-map-interactable-assets.md`.

- [ ] **Step 5: Commit final documentation**

```powershell
git add docs/design/15-map-interactable-assets.md docs/design/assets/loot-chests/prompts.md
git commit -m "docs: document loot chest state assets"
```

- [ ] **Step 6: Review final scope**

Run `git status --short` and `git diff --stat HEAD~5..HEAD`. Confirm only the planned asset, script, catalog, presentation, HUD, tests and docs files were changed by this feature; leave all pre-existing unrelated dirty files untouched.
