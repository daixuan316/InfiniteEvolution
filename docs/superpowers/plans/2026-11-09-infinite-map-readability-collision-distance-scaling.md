# Infinite Map Readability, Collision, and Distance Scaling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make streamed districts visually distinct, align navigation and collision with the current chunk art, reduce actor scale, and increase enemy density and health with distance from the Ark.

**Architecture:** Add pure data modules for art-aligned chunk masks, encounter scaling, and presentation metrics. The seeded generator consumes the mask rules; `InfiniteBattleMap` derives deterministic spawn cells and collision; `BattleSimulation` applies distance health multipliers; `BattleHUDViewComp` consumes presentation data without owning gameplay rules.

**Tech Stack:** TypeScript, Cocos Creator 3.8.8, Node 24 native TypeScript test execution, `node:test`, existing oops-game-kit UI helpers.

**Implementation status (2026-11-10):** Complete in the current workspace. `npm run test:battle` passes 163/163, `npm run test:ui` passes 170/170, and `git diff --check` passes. Feature TypeScript files report no errors; the project-wide compiler still reports pre-existing extension errors involving JSZip, Node default imports, and `Logger.logNet`. The Cocos Creator six-boundary manual smoke test remains pending. Final review fixes added a hospital-specific lower road, stable coordinate-derived monster kinds, two-phase budgeted enemy-node reconciliation, and preservation of the finite hospital map's authored enemy composition. Independent review found no remaining Critical or Important issues.

## Global Constraints

- Keep the existing Cocos Creator 3.8.8 project and current pixel-art assets.
- Preserve seeded reconstruction, sparse world deltas, 3×3 active chunks, 5×5 preload, and the six-chunk per-frame generation budget.
- Cap streamed enemies at four per active chunk and health at three times base health.
- Do not scale enemy damage, defense, speed, attack interval, or night-defense encounters.
- Preserve existing cell-based enemy IDs wherever a legacy primary spawn still exists.
- Follow strict red-green-refactor TDD for every gameplay rule.

---

### Task 1: Art-Aligned Chunk Navigation Templates

**Files:**
- Create: `assets/script/game/world/infinite/InfiniteChunkTemplate.ts`
- Create: `assets/script/game/world/infinite/InfiniteChunkTemplate.ts.meta`
- Modify: `assets/script/game/world/infinite/InfiniteChunkGenerator.ts`
- Test: `tests/unit/world/InfiniteChunkTemplate.test.mjs`
- Test: `tests/unit/world/InfiniteChunkGenerator.test.mjs`

**Interfaces:**
- Consumes: `InfiniteChunkDefinition["backgroundId"]`, `ChunkRoadConnections`, `LocalCell`, `CHUNK_COLUMNS`, `CHUNK_ROWS`.
- Produces: `chunkArtTemplate(backgroundId, roads): { roadCells: readonly LocalCell[]; solidCells: readonly LocalCell[] }`.
- Produces: `InfiniteChunkDefinition.solidCells: readonly LocalCell[]`.

- [x] **Step 1: Write failing template tests**

```js
test("residential art exposes its visible center and perimeter streets", () => {
  const template = chunkArtTemplate("residential-district-a", { north: true, east: true, south: true, west: true });
  assert.equal(hasCell(template.roadCells, 6, 4), true);
  assert.equal(hasCell(template.roadCells, 0, 4), true);
  assert.equal(hasCell(template.roadCells, 6, 7), true);
  assert.equal(hasCell(template.roadCells, 2, 1), false);
});

test("closed chunk edges are not traversable", () => {
  const template = chunkArtTemplate("residential-district-a", { north: false, east: false, south: false, west: false });
  assert.equal(template.roadCells.some((cell) => cell.y === 7), false);
  assert.equal(template.roadCells.some((cell) => cell.x === 13), false);
});

test("hospital median blockers are removed from the road mask", () => {
  const template = chunkArtTemplate("hospital-district", { north: true, east: true, south: true, west: true });
  assert.equal(template.solidCells.length > 0, true);
  assert.equal(template.solidCells.every((solid) => !hasCell(template.roadCells, solid.x, solid.y)), true);
});
```

- [x] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/world/InfiniteChunkTemplate.test.mjs`

Expected: FAIL because `InfiniteChunkTemplate.ts` does not exist.

- [x] **Step 3: Implement deterministic templates**

```ts
export interface ChunkArtTemplate {
    readonly roadCells: readonly LocalCell[];
    readonly solidCells: readonly LocalCell[];
}

export function chunkArtTemplate(
    backgroundId: InfiniteChunkDefinition["backgroundId"],
    roads: ChunkRoadConnections,
): ChunkArtTemplate {
    // Build background-specific interior lanes, add only enabled edge lanes,
    // subtract declared solid cells, sort by y then x, and return immutable data.
}
```

Residential/commercial templates use the visible center cross and enabled perimeter lanes. Hospital uses its lower horizontal route, center vertical route, enabled perimeter lanes, and declared median/rubble blockers while retaining at least one lane around each blocker.

- [x] **Step 4: Integrate templates into chunk generation**

Replace `createRoadCells(roads)` with `chunkArtTemplate(background, roads)` after `backgroundId` is known. Add `solidCells` to the returned chunk definition. Keep all choices seeded and independent of runtime order.

- [x] **Step 5: Verify template and generator tests GREEN**

Run: `node --test tests/unit/world/InfiniteChunkTemplate.test.mjs tests/unit/world/InfiniteChunkGenerator.test.mjs`

Expected: all tests pass, including shared-edge and connectivity seed sweeps.

- [x] **Step 6: Commit**

```powershell
git add assets/script/game/world/infinite/InfiniteChunkTemplate.ts assets/script/game/world/infinite/InfiniteChunkTemplate.ts.meta assets/script/game/world/infinite/InfiniteChunkGenerator.ts tests/unit/world/InfiniteChunkTemplate.test.mjs tests/unit/world/InfiniteChunkGenerator.test.mjs
git commit -m "fix: align infinite chunk navigation with art"
```

---

### Task 2: Distance-Based Encounter Profiles and Safe Spawn Cells

**Files:**
- Create: `assets/script/game/world/infinite/InfiniteEncounterScaling.ts`
- Create: `assets/script/game/world/infinite/InfiniteEncounterScaling.ts.meta`
- Modify: `assets/script/game/battle/BattleMapModel.ts`
- Modify: `assets/script/game/battle/InfiniteBattleMap.ts`
- Test: `tests/unit/world/InfiniteEncounterScaling.test.mjs`
- Test: `tests/unit/battle/InfiniteBattleMap.test.mjs`

**Interfaces:**
- Produces: `encounterProfileForChunk(coordinate): { distance: number; enemyCount: number; healthMultiplier: number }`.
- Produces: `BattleMapDefinition.enemyHealthMultiplier?(cell: GridPoint): number`.
- Consumes: generated `roadCells`, `solidCells`, landmark/interactable cells, and chunk coordinate.

- [x] **Step 1: Write failing distance-band tests**

```js
test("enemy count increases through the four Ark distance bands", () => {
  assert.equal(encounterProfileForChunk({ x: 0, y: 0 }).enemyCount, 1);
  assert.equal(encounterProfileForChunk({ x: 2, y: 0 }).enemyCount, 2);
  assert.equal(encounterProfileForChunk({ x: 4, y: 3 }).enemyCount, 3);
  assert.equal(encounterProfileForChunk({ x: 8, y: 0 }).enemyCount, 4);
});

test("health grows monotonically and caps at three times base", () => {
  assert.equal(encounterProfileForChunk({ x: 0, y: 0 }).healthMultiplier, 1);
  assert.equal(encounterProfileForChunk({ x: 20, y: 0 }).healthMultiplier, 3);
  assert.equal(encounterProfileForChunk({ x: 200, y: 0 }).healthMultiplier, 3);
});
```

- [x] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/world/InfiniteEncounterScaling.test.mjs`

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement the pure encounter profile**

```ts
export function encounterProfileForChunk(coordinate: ChunkCoordinate): InfiniteEncounterProfile {
    const distance = Math.floor(Math.hypot(coordinate.x, coordinate.y));
    const enemyCount = distance <= 1 ? 1 : distance <= 3 ? 2 : distance <= 6 ? 3 : 4;
    return { distance, enemyCount, healthMultiplier: Math.min(3, 1 + distance * 0.1) };
}
```

- [x] **Step 4: Write failing map spawn tests**

Assert that active chunks at each distance expose exactly the profile count, all spawn cells are unique and walkable, repeated construction returns identical cells, and `enemyHealthMultiplier(cell)` returns the owning chunk multiplier.

- [x] **Step 5: Run map tests and verify RED**

Run: `node --test tests/unit/battle/InfiniteBattleMap.test.mjs`

Expected: FAIL because every chunk currently contributes one fixed spawn and the map has no multiplier API.

- [x] **Step 6: Implement safe deterministic spawn selection**

In `contentForChunks`, keep `{x:11,y:4}` as the preferred legacy slot when it is walkable. Fill remaining slots from a seeded, sorted road-cell candidate list after excluding portals, loot, exploration cells, solid cells, and duplicate cells. Emit fewer spawns if no valid candidate remains. Add `enemyHealthMultiplier(cell)` by converting the cell to its chunk coordinate and calling `encounterProfileForChunk`.

- [x] **Step 7: Verify encounter and map tests GREEN**

Run: `node --test tests/unit/world/InfiniteEncounterScaling.test.mjs tests/unit/battle/InfiniteBattleMap.test.mjs`

Expected: all tests pass.

- [x] **Step 8: Commit**

```powershell
git add assets/script/game/world/infinite/InfiniteEncounterScaling.ts assets/script/game/world/infinite/InfiniteEncounterScaling.ts.meta assets/script/game/battle/BattleMapModel.ts assets/script/game/battle/InfiniteBattleMap.ts tests/unit/world/InfiniteEncounterScaling.test.mjs tests/unit/battle/InfiniteBattleMap.test.mjs
git commit -m "feat: scale exploration encounters from the Ark"
```

---

### Task 3: Apply Distance Health Without Breaking Sparse Enemy State

**Files:**
- Modify: `assets/script/game/battle/BattleSimulation.ts`
- Test: `tests/unit/battle/InfiniteBattleSimulation.test.mjs`

**Interfaces:**
- Consumes: `BattleMapDefinition.enemyHealthMultiplier?(cell)`.
- Preserves: stable ID `chunk-enemy:${spawn.x}:${spawn.y}` and existing destroyed deltas.

- [x] **Step 1: Write failing simulation tests**

```js
test("streamed enemy health scales from its chunk while combat stats stay fixed", () => {
  const near = createSimulationAtChunk({ x: 0, y: 0 }).enemies[0];
  const far = createSimulationAtChunk({ x: 8, y: 0 }).enemies[0];
  assert.ok(far.vitality.maxHealth > near.vitality.maxHealth);
  assert.ok(far.vitality.maxHealth <= near.vitality.maxHealth * 3);
  assert.equal(far.attackDamage, near.attackDamage);
});
```

Also retain the existing recycle test and extend it so a defeated far-chunk enemy remains absent after leaving and returning.

- [x] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/battle/InfiniteBattleSimulation.test.mjs`

Expected: FAIL because `createEnemy` always uses base health.

- [x] **Step 3: Pass health multiplier into enemy construction**

Change `createEnemy` to accept `healthMultiplier = 1`, sanitize it to `[1, 3]`, and construct vitality with `combat.health * multiplier`. Both constructor and streamed refresh derive the multiplier from the spawn cell. Horde/night-defense calls retain the default multiplier.

- [x] **Step 4: Verify simulation tests GREEN**

Run: `node --test tests/unit/battle/InfiniteBattleSimulation.test.mjs tests/unit/battle/NightDefenseSimulation.test.mjs`

Expected: distance scaling and night-defense regressions pass.

- [x] **Step 5: Commit**

```powershell
git add assets/script/game/battle/BattleSimulation.ts tests/unit/battle/InfiniteBattleSimulation.test.mjs
git commit -m "feat: scale streamed enemy health by distance"
```

---

### Task 4: District Overlays and Actor Presentation Metrics

**Files:**
- Create: `assets/script/game/battle/InfiniteDistrictPresentation.ts`
- Create: `assets/script/game/battle/InfiniteDistrictPresentation.ts.meta`
- Create: `assets/script/game/battle/BattleActorPresentation.ts`
- Create: `assets/script/game/battle/BattleActorPresentation.ts.meta`
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Modify: `assets/script/game/battle/BattleSimulation.ts`
- Test: `tests/unit/battle/InfiniteDistrictPresentation.test.mjs`
- Test: `tests/unit/battle/BattleActorPresentation.test.mjs`
- Test: `tests/integration/ui/InfiniteWorldViewBindings.test.mjs`

**Interfaces:**
- Produces: `districtPresentation(district, hasHospital): { label: string; accent: readonly [number, number, number, number]; tint: readonly [number, number, number, number] }`.
- Produces: `PLAYER_PRESENTATION_SIZE`, `PLAYER_COLLISION_RADIUS`, `enemyPresentation(kind)`.

- [x] **Step 1: Write failing pure presentation tests**

Assert all district labels and accents are distinct, hospital overrides the district label, player size is 104, ordinary enemies are at most 90, brute is 118, and collision radii match 22/18/18/20/28.

- [x] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/battle/InfiniteDistrictPresentation.test.mjs tests/unit/battle/BattleActorPresentation.test.mjs`

Expected: FAIL because the modules do not exist.

- [x] **Step 3: Implement pure presentation modules**

Use numeric RGBA tuples so Node tests do not import Cocos. Export actor assets, sizes, collision radii, and health-bar widths from one module consumed by both simulation and HUD.

- [x] **Step 4: Integrate actor sizes and radii**

Replace the HUD-local enemy size table and hardcoded player size with `BattleActorPresentation`. Replace simulation player/enemy radii with the same module's collision metrics. Scale health-bar widths and vertical offsets from each actor presentation.

- [x] **Step 5: Integrate pooled district presentation**

Add `refreshDistrictPresentation(node, chunk)` to create/update a translucent border, corner label plate, and label. Call it for new, reused, and already-active chunk nodes. Convert tuple colors to Cocos `Color` only inside `BattleHUDViewComp`. Expand closed-edge barriers across the full relevant chunk edge so art and collision communicate the same boundary.

- [x] **Step 6: Verify presentation and UI binding tests GREEN**

Run: `node --test tests/unit/battle/InfiniteDistrictPresentation.test.mjs tests/unit/battle/BattleActorPresentation.test.mjs tests/integration/ui/InfiniteWorldViewBindings.test.mjs`

Expected: all tests pass.

- [x] **Step 7: Commit**

The pure presentation modules, actor collision integration, and tests were committed in `064e206`. `BattleHUDViewComp.ts` remains in the working tree because it already contains unrelated equipment/intel presentation work; the district overlay hunks were not committed separately to avoid capturing those changes.

```powershell
git add assets/script/game/battle/InfiniteDistrictPresentation.ts assets/script/game/battle/InfiniteDistrictPresentation.ts.meta assets/script/game/battle/BattleActorPresentation.ts assets/script/game/battle/BattleActorPresentation.ts.meta assets/script/game/battle/BattleHUDViewComp.ts assets/script/game/battle/BattleSimulation.ts tests/unit/battle/InfiniteDistrictPresentation.test.mjs tests/unit/battle/BattleActorPresentation.test.mjs tests/integration/ui/InfiniteWorldViewBindings.test.mjs
git commit -m "feat: improve infinite district and actor readability"
```

---

### Task 5: Regression Verification and Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-11-09-infinite-map-readability-collision-distance-scaling.md`

**Interfaces:**
- Consumes all preceding task outputs.
- Produces verification evidence and editor smoke-test instructions.

- [x] **Step 1: Run focused world and battle tests**

Run:

```powershell
node --test tests/unit/world/InfiniteChunkTemplate.test.mjs tests/unit/world/InfiniteEncounterScaling.test.mjs tests/unit/world/InfiniteChunkGenerator.test.mjs tests/unit/battle/InfiniteBattleMap.test.mjs tests/unit/battle/InfiniteBattleSimulation.test.mjs tests/unit/battle/InfiniteDistrictPresentation.test.mjs tests/unit/battle/BattleActorPresentation.test.mjs
```

- [x] **Step 2: Run full regression suites**

Run: `npm run test:battle`

Run: `npm run test:ui`

Expected: zero failures.

- [x] **Step 3: Run feature TypeScript validation**

Run the Cocos Creator bundled TypeScript compiler with `--noEmit -p tsconfig.json --skipLibCheck`. Separate known extension errors from any error under `assets/script/game/battle` or `assets/script/game/world/infinite`; feature files must report no errors.

- [x] **Step 4: Run diff validation**

Run: `git diff --check`

Expected: exit code 0. Existing line-ending warnings may remain, but no whitespace errors.

- [x] **Step 5: Document behavior and manual smoke test**

Update README with district colors, art-aligned streets, actor scale, and distance bands. Record automated counts and leave the six-boundary Cocos Creator smoke test explicitly pending unless it was actually performed.

- [x] **Step 6: Commit**

```powershell
git add README.md docs/superpowers/plans/2026-11-09-infinite-map-readability-collision-distance-scaling.md
git commit -m "docs: describe infinite map readability scaling"
```
