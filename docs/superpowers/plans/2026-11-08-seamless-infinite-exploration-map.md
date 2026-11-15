# Seamless Infinite Exploration Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bounded hospital exploration arena with a deterministic, streamed infinite city that contains mostly residential blocks, rarer community blocks, and distance-limited landmark blocks while preserving exploration changes by seed plus deltas.

**Architecture:** Keep procedural generation and persistence in engine-independent TypeScript under `world/infinite`. Adapt the battle map through an unbounded `BattleMapDefinition`, make pathfinding support bounded searches on signed coordinates, and let the Cocos view stream only nearby chunk visuals. Use generated residential/commercial block art matching the existing hospital pixel-art style, while retaining the current hospital as a rare landmark.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript ES modules, Oops Framework conventions, Node `--test`, Cocos `resources.load`, deterministic 32-bit hash RNG.

## Implementation Status (2026-11-09)

- Tasks 1–8 are implemented, including deterministic generation, sparse local persistence, 3×3/5×5 streaming, floating-origin rendering, player-centered maps, and modular residential/commercial art.
- Automated verification is green: `npm run test:battle` (147/147) and `npm run test:ui` (159/159); `git diff --check` is clean.
- Cocos Creator 3.8.8's bundled TypeScript reports no errors in the files changed for this feature. Full-project type checking remains blocked by pre-existing extension declarations (`JSZip`, Node default imports, and `Logger.logNet`).
- The manual six-boundary Creator smoke test remains an editor-side follow-up; it was not simulated by the Node test environment.

## Global Constraints

- Logical cell size remains exactly `96` world units.
- One chunk is exactly `14×8` logical cells (`1344×768` world units).
- Active simulation radius is `3×3`; preload radius is `5×5`.
- Generation never uses `Math.random()`.
- The same `generationVersion`, `worldSeed`, and signed chunk coordinate must reproduce the same initial content.
- Cocos nodes and resources never enter serialized world deltas.
- New art uses the existing top-down pixel-art palette: blue-gray concrete, dark asphalt, cyan windows, amber pipes/markings, green overgrowth, and sparse magenta contamination.
- Existing unrelated research, equipment, workshop, night-defense, and navigation changes in the working tree must be preserved.

---

### Task 1: Deterministic world primitives

**Files:**
- Create: `assets/script/game/world/infinite/InfiniteWorldTypes.ts`
- Create: `assets/script/game/world/infinite/WorldSeed.ts`
- Create: `assets/script/game/world/infinite.meta`
- Create: `assets/script/game/world/infinite/InfiniteWorldTypes.ts.meta`
- Create: `assets/script/game/world/infinite/WorldSeed.ts.meta`
- Test: `tests/unit/world/WorldSeed.test.mjs`

**Interfaces:**
- Produces: `ChunkCoordinate`, `ChunkKey`, `ChunkDirection`, `CHUNK_COLUMNS`, `CHUNK_ROWS`, `CELL_SIZE`, `chunkKey()`, `parseChunkKey()`, `deriveSeed()`, and `SeededRandom`.
- Consumes: no game runtime or Cocos APIs.

- [ ] **Step 1: Write the failing deterministic seed tests**

```js
test("signed chunk coordinates round-trip through stable keys", () => {
  assert.deepEqual(parseChunkKey(chunkKey({ x: -12, y: 7 })), { x: -12, y: 7 });
});

test("derived streams are repeatable and isolated", () => {
  const a = new SeededRandom(deriveSeed(0x4a17, { x: -3, y: 9 }, "roads"));
  const b = new SeededRandom(deriveSeed(0x4a17, { x: -3, y: 9 }, "roads"));
  const decoration = new SeededRandom(deriveSeed(0x4a17, { x: -3, y: 9 }, "decoration"));
  assert.deepEqual([a.next(), a.next(), a.int(0, 99)], [b.next(), b.next(), b.int(0, 99)]);
  assert.notEqual(a.state, decoration.state);
});
```

- [ ] **Step 2: Run the focused test and verify missing-module failure**

Run: `node --test tests/unit/world/WorldSeed.test.mjs`

Expected: FAIL because `WorldSeed.ts` does not exist.

- [ ] **Step 3: Implement signed coordinates and fixed 32-bit hashing**

```ts
export const CELL_SIZE = 96;
export const CHUNK_COLUMNS = 14;
export const CHUNK_ROWS = 8;
export type ChunkKey = `${number}:${number}`;
export interface ChunkCoordinate { readonly x: number; readonly y: number; }
export type ChunkDirection = "north" | "east" | "south" | "west";

export function chunkKey({ x, y }: ChunkCoordinate): ChunkKey {
  return `${Math.trunc(x)}:${Math.trunc(y)}`;
}
```

`deriveSeed()` must hash the generation version, unsigned world seed, signed coordinates, and stream name with `Math.imul`. `SeededRandom` uses xorshift32, clamps `next()` to `[0, 1)`, and implements inclusive integer selection.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/unit/world/WorldSeed.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit the deterministic primitives**

```powershell
git add assets/script/game/world/infinite tests/unit/world/WorldSeed.test.mjs
git commit -m "feat: add deterministic infinite world seeds"
```

### Task 2: Road, district, and landmark generation

**Files:**
- Create: `assets/script/game/world/infinite/InfiniteChunkGenerator.ts`
- Create: `assets/script/game/world/infinite/InfiniteChunkGenerator.ts.meta`
- Test: `tests/unit/world/InfiniteChunkGenerator.test.mjs`

**Interfaces:**
- Consumes: `ChunkCoordinate`, `ChunkDirection`, `deriveSeed()`, and `SeededRandom` from Task 1.
- Produces: `InfiniteChunkDefinition`, `BuildingLotDefinition`, `ChunkRoadConnections`, `DistrictKind`, `generateInfiniteChunk(worldSeed, coordinate)`, and `isRareLandmarkAnchor(worldSeed, coordinate, kind)`.

- [ ] **Step 1: Write failing generator invariants**

```js
test("neighboring chunks independently agree on shared road exits", () => {
  for (let y = -20; y <= 20; y++) for (let x = -20; x <= 20; x++) {
    const here = generateInfiniteChunk(1907, { x, y });
    const east = generateInfiniteChunk(1907, { x: x + 1, y });
    const north = generateInfiniteChunk(1907, { x, y: y + 1 });
    assert.equal(here.roads.east, east.roads.west);
    assert.equal(here.roads.north, north.roads.south);
  }
});

test("ten thousand chunks stay inside distribution and landmark spacing budgets", () => {
  const chunks = sampleChunks(10_000, 1907);
  const residential = chunks.filter((chunk) => chunk.district === "residential").length / chunks.length;
  assert.ok(residential >= 0.60 && residential <= 0.72);
  assertLandmarksAreSeparated(chunks, 4);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/unit/world/InfiniteChunkGenerator.test.mjs`

Expected: FAIL because the generator module does not exist.

- [ ] **Step 3: Implement order-independent shared edges and district selection**

For an east/west edge, hash the lexicographically lower endpoint plus the constant `"edge-x"`; for north/south use `"edge-y"`. Always enable at least one connection by promoting the highest-priority edge if all four hashes reject.

Choose district thresholds from a dedicated stream:

```ts
const roll = districtRandom.next();
const district: DistrictKind = roll < 0.66
  ? "residential"
  : roll < 0.86
    ? "community"
    : roll < 0.96
      ? "industrial"
      : "open-space";
```

Generate stable lot IDs such as `lot:2:5`, keep every lot inside `14×8`, and mark road cells walkable.

- [ ] **Step 4: Implement deterministic landmark competition**

A chunk becomes a landmark candidate only when its landmark stream is below the per-kind threshold. It wins only when its hash priority is greater than every same-kind candidate inside Chebyshev distance 4. This permits the confirmed average density of one key landmark per 20–35 chunks. Hospital is enabled first; police, factory, and laboratory remain defined kinds but disabled from natural selection until their art exists.

- [ ] **Step 5: Run generator tests**

Run: `node --test tests/unit/world/InfiniteChunkGenerator.test.mjs`

Expected: PASS, including the 10,000-chunk sample under two seconds on the development machine.

- [ ] **Step 6: Commit the generator**

```powershell
git add assets/script/game/world/infinite/InfiniteChunkGenerator.ts* tests/unit/world/InfiniteChunkGenerator.test.mjs
git commit -m "feat: generate connected infinite city chunks"
```

### Task 3: Seed-plus-delta persistence

**Files:**
- Create: `assets/script/game/world/infinite/WorldDeltaStore.ts`
- Create: `assets/script/game/world/infinite/WorldDeltaStore.ts.meta`
- Test: `tests/unit/world/WorldDeltaStore.test.mjs`

**Interfaces:**
- Consumes: `ChunkKey` and stable object IDs from Tasks 1–2.
- Produces: `WorldDeltaSnapshotV1`, `WorldObjectDelta`, and class `WorldDeltaStore` with `setObjectDelta()`, `getObjectDelta()`, `markLandmarkDiscovered()`, `isLandmarkDiscovered()`, `snapshot()`, and `restore()`.

- [ ] **Step 1: Write failing sparse-delta tests**

```js
test("snapshot stores only changed objects and round-trips signed chunks", () => {
  const store = new WorldDeltaStore(1907);
  store.setObjectDelta("-8:3", "loot:lot:2:5", { opened: true });
  store.markLandmarkDiscovered("hospital:-8:3");
  const restored = WorldDeltaStore.restore(JSON.parse(JSON.stringify(store.snapshot())));
  assert.deepEqual(restored.getObjectDelta("-8:3", "loot:lot:2:5"), { opened: true });
  assert.equal(restored.isLandmarkDiscovered("hospital:-8:3"), true);
  assert.equal(restored.snapshot().chunks["0:0"], undefined);
});
```

- [ ] **Step 2: Run and verify missing-module failure**

Run: `node --test tests/unit/world/WorldDeltaStore.test.mjs`

- [ ] **Step 3: Implement validation and immutable snapshots**

Reject mismatched schema versions, non-finite coordinates encoded in keys, and invalid object IDs. Deep-copy returned snapshots so callers cannot mutate live state. Remove an object or chunk entry when its delta becomes empty.

- [ ] **Step 4: Run the focused test**

Run: `node --test tests/unit/world/WorldDeltaStore.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit persistence**

```powershell
git add assets/script/game/world/infinite/WorldDeltaStore.ts* tests/unit/world/WorldDeltaStore.test.mjs
git commit -m "feat: persist infinite world changes as sparse deltas"
```

### Task 4: Chunk streaming and floating-origin model

**Files:**
- Create: `assets/script/game/world/infinite/ChunkStreamingModel.ts`
- Create: `assets/script/game/world/infinite/ChunkStreamingModel.ts.meta`
- Test: `tests/unit/world/ChunkStreamingModel.test.mjs`

**Interfaces:**
- Consumes: chunk constants and coordinates from Task 1.
- Produces: class `ChunkStreamingModel`, `ChunkStreamingDiff`, `PermanentWorldPosition`, `toChunkCoordinate()`, `toLocalRenderPoint()`, and `shiftOriginIfNeeded()`.

- [ ] **Step 1: Write failing lifecycle tests**

```js
test("streaming exposes 3x3 active and 5x5 preload sets", () => {
  const model = new ChunkStreamingModel();
  const diff = model.update({ x: 0, y: 0 });
  assert.equal(model.activeKeys.size, 9);
  assert.equal(model.preloadedKeys.size, 25);
  assert.equal(diff.load.length, 25);
});

test("moving one chunk loads one column and unloads one column", () => {
  const model = new ChunkStreamingModel();
  model.update({ x: 0, y: 0 });
  const diff = model.update({ x: 1344, y: 0 });
  assert.equal(diff.load.length, 5);
  assert.equal(diff.unload.length, 5);
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/unit/world/ChunkStreamingModel.test.mjs`

- [ ] **Step 3: Implement stable set diffs and render-origin shifts**

Use floor division that handles negative coordinates. Shift the render origin only in whole chunk increments when the player exceeds two chunks from the current render origin. Return the shift vector instead of mutating Cocos nodes inside the model.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/unit/world/ChunkStreamingModel.test.mjs`

Expected: PASS for positive and negative boundary cases.

- [ ] **Step 5: Commit streaming model**

```powershell
git add assets/script/game/world/infinite/ChunkStreamingModel.ts* tests/unit/world/ChunkStreamingModel.test.mjs
git commit -m "feat: model infinite chunk streaming and floating origin"
```

### Task 5: Unbounded battle map and bounded-search pathfinding

**Files:**
- Create: `assets/script/game/battle/InfiniteBattleMap.ts`
- Create: `assets/script/game/battle/InfiniteBattleMap.ts.meta`
- Modify: `assets/script/game/battle/BattleMapModel.ts`
- Modify: `assets/script/game/battle/GridPathfinder.ts`
- Modify: `assets/script/game/battle/BattleCamera.ts`
- Test: `tests/unit/battle/InfiniteBattleMap.test.mjs`
- Modify: `tests/unit/battle/GridPathfinder.test.mjs`
- Modify: `tests/unit/battle/BattleCamera.test.mjs`

**Interfaces:**
- Consumes: `generateInfiniteChunk()`, chunk coordinate helpers, and `WorldDeltaStore`.
- Produces: `createInfiniteExplorationMap({ worldSeed, deltas })`, `BattleMapDefinition.infinite`, `BattleMapDefinition.revision`, and `BattleMapDefinition.refreshAround(point)`.

- [ ] **Step 1: Write failing unbounded-map tests**

```js
test("infinite map converts negative and distant cells without clamping", () => {
  const map = createInfiniteExplorationMap({ worldSeed: 1907 });
  for (const cell of [{ x: -200, y: 17 }, { x: 900, y: -500 }]) {
    assert.deepEqual(map.worldToCell(map.cellToWorld(cell)), cell);
  }
});

test("pathfinder reaches a nearby goal across a chunk boundary", () => {
  const map = createInfiniteExplorationMap({ worldSeed: 1907 });
  const start = { x: 12, y: 4 };
  const goal = { x: 16, y: 4 };
  assert.deepEqual(new GridPathfinder(map).findPath(start, goal).at(-1), goal);
});
```

- [ ] **Step 2: Run tests and verify the finite-map assumptions fail**

Run: `node --test tests/unit/battle/InfiniteBattleMap.test.mjs tests/unit/battle/GridPathfinder.test.mjs tests/unit/battle/BattleCamera.test.mjs`

- [ ] **Step 3: Extend the map interface without breaking finite maps**

Add optional members:

```ts
readonly infinite?: boolean;
readonly revision?: number;
refreshAround?(point: WorldPoint): boolean;
```

Finite hospital and night-defense maps keep current behavior. Infinite `cellToWorld()` uses global signed cells with no world-center offset. `isWalkable()` finds the owning chunk and checks its generated local road grid plus delta-blocked cells.

- [ ] **Step 4: Bound A* by work, not world dimensions**

For finite maps, preserve existing bounds. For `infinite` maps, accept signed coordinates and stop after `maxVisited = 4096`. Restrict neighbor expansion to a rectangle spanning start and goal plus 16 cells on each side. Rewrite nearest-walkable search as expanding rings capped at radius 12 instead of iterating `columns × rows`.

- [ ] **Step 5: Make infinite camera follow unclamped**

`cameraTargetFor()` returns the player position directly when `map.infinite === true`; finite maps retain current clamps.

- [ ] **Step 6: Run battle-map tests**

Run: `node --test tests/unit/battle/InfiniteBattleMap.test.mjs tests/unit/battle/GridPathfinder.test.mjs tests/unit/battle/BattleCamera.test.mjs tests/unit/battle/BattleMapModel.test.mjs`

Expected: PASS for both finite and infinite maps.

- [ ] **Step 7: Commit map integration**

```powershell
git add assets/script/game/battle/BattleMapModel.ts assets/script/game/battle/GridPathfinder.ts assets/script/game/battle/BattleCamera.ts assets/script/game/battle/InfiniteBattleMap.ts* tests/unit/battle
git commit -m "feat: support unbounded exploration navigation"
```

### Task 6: Stream generated content through the battle simulation

**Files:**
- Modify: `assets/script/game/battle/BattleSimulation.ts`
- Modify: `tests/unit/battle/BattleSimulation.test.mjs`
- Test: `tests/unit/battle/InfiniteBattleSimulation.test.mjs`

**Interfaces:**
- Consumes: `BattleMapDefinition.refreshAround()`, `revision`, generated map definitions, and delta store callbacks.
- Produces: `BattleSimulation.refreshWorldContent()`, stable runtime entity IDs, and `BattleSimulation.worldRevision`.

- [ ] **Step 1: Write failing simulation streaming tests**

```js
test("moving into a neighboring chunk refreshes content without duplicating stable ids", () => {
  const map = createInfiniteExplorationMap({ worldSeed: 1907 });
  const simulation = new BattleSimulation(map);
  const firstIds = new Set(simulation.loot.map((item) => item.id));
  simulation.player.x += 1344 * 3;
  simulation.update(1 / 60);
  assert.ok(simulation.worldRevision > 0);
  assert.equal(new Set(simulation.loot.map((item) => item.id)).size, simulation.loot.length);
  assert.ok([...firstIds].some((id) => !simulation.loot.some((item) => item.id === id)));
});
```

- [ ] **Step 2: Run and verify failure**

Run: `node --test tests/unit/battle/InfiniteBattleSimulation.test.mjs`

- [ ] **Step 3: Reconcile runtime arrays by stable ID**

At the start of `update()`, call `map.refreshAround(player)`. When `revision` changes, diff enemies, loot, exploration points, and barriers. Reuse live entries with matching IDs; create newly active entries; remove entries outside the active radius after writing their changes. Do not respawn completed one-shot objects.

- [ ] **Step 4: Invalidate navigation only when the map revision changes**

Clear player paths that reference unloaded or newly blocked cells. Enemies request a fresh local route after entering a new chunk; they do not pathfind while outside the active `3×3` set.

- [ ] **Step 5: Run simulation regression tests**

Run: `node --test tests/unit/battle/BattleSimulation.test.mjs tests/unit/battle/InfiniteBattleSimulation.test.mjs`

Expected: PASS with all existing combat, interaction, horde, and projectile tests unchanged.

- [ ] **Step 6: Commit simulation streaming**

```powershell
git add assets/script/game/battle/BattleSimulation.ts tests/unit/battle/BattleSimulation.test.mjs tests/unit/battle/InfiniteBattleSimulation.test.mjs
git commit -m "feat: stream procedural exploration content"
```

### Task 7: Produce and import residential city art

**Files:**
- Create: `assets/bundle/gui/battle-hud/texture/residential-district-a.png`
- Create: `assets/bundle/gui/battle-hud/texture/residential-district-a.png.meta`
- Create: `assets/bundle/gui/battle-hud/texture/residential-district-b.png`
- Create: `assets/bundle/gui/battle-hud/texture/residential-district-b.png.meta`
- Create: `assets/bundle/gui/battle-hud/texture/neighborhood-commercial-a.png`
- Create: `assets/bundle/gui/battle-hud/texture/neighborhood-commercial-a.png.meta`
- Create: `docs/design/assets/infinite-city/asset-manifest.json`
- Create: `docs/design/18-infinite-city-modular-assets.md`
- Modify: `tests/integration/ui/UIVisualComposition.test.mjs`

**Interfaces:**
- Consumes: existing `hospital-district.png` as the visual reference and Task 2 district IDs.
- Produces: Cocos resource keys `gui/battle-hud/texture/residential-district-a`, `residential-district-b`, and `neighborhood-commercial-a`.

- [ ] **Step 1: Generate three top-down pixel-art chunk backgrounds**

Use the existing hospital image as a style reference. Generate exactly `1344×768` final PNGs with roads touching all four edges at the standard connector positions, no text, no characters, and no UI. Residential A contains low-rise housing; Residential B contains apartments and row houses; Commercial contains a convenience store, pharmacy, garage, and parking lot. Hospital, police, factory, and laboratory must not appear in these three assets.

- [ ] **Step 2: Normalize and visually inspect**

Center-crop or resize the generated images to `1344×768`, confirm RGB/RGBA PNG output, and visually check perspective, pixel density, connector placement, repeated text-like marks, and edge seams. Reject and regenerate any image that bakes labels or characters into the scene.

- [ ] **Step 3: Add nearest-filter Cocos metadata and asset manifest**

Each image meta uses `minfilter: "nearest"`, `magfilter: "nearest"`, `mipfilter: "none"`, clamp-to-edge wrapping, and a unique UUID. The manifest records stable ID, district tag, width, height, connector mask, source prompt, and Cocos resource key.

- [ ] **Step 4: Test resource presence and dimensions**

Add assertions for all three resource paths and use the existing PNG dimension reader in `UIVisualComposition.test.mjs` to require `1344×768`.

Run: `node --test tests/integration/ui/UIVisualComposition.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit modular art**

```powershell
git add assets/bundle/gui/battle-hud/texture docs/design/assets/infinite-city docs/design/18-infinite-city-modular-assets.md tests/integration/ui/UIVisualComposition.test.mjs
git commit -m "feat: add modular infinite city map art"
```

### Task 8: Render streamed chunks and replace the bounded minimap

**Files:**
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Test: `tests/integration/ui/UIViewBindings.test.mjs`
- Modify: `tests/integration/ui/UIVisualComposition.test.mjs`

**Interfaces:**
- Consumes: infinite map active chunks, district art keys, `ChunkStreamingModel`, and `BattleSimulation.worldRevision`.
- Produces: pooled chunk background nodes, player-centered minimap projection, and render-origin synchronization.

- [ ] **Step 1: Write failing source-contract tests**

```js
assert.match(source, /createInfiniteExplorationMap/);
assert.match(source, /refreshChunkViews/);
assert.match(source, /residential-district-a/);
assert.doesNotMatch(source, /this\.map\.worldWidth\s*\/\s*3/);
```

Add a behavior test for a pure exported helper `localMapPosition(point, center, radius, width, height)` so negative and distant world coordinates project relative to the player rather than the nonexistent global bounds.

- [ ] **Step 2: Run UI tests and verify failure**

Run: `node --test tests/integration/ui/UIViewBindings.test.mjs tests/integration/ui/UIVisualComposition.test.mjs`

- [ ] **Step 3: Switch exploration construction to the infinite map**

Instantiate `createInfiniteExplorationMap({ worldSeed: 1907 })`. Keep the night-defense view on `createArkDefenseMap()` and do not alter its finite camera or arena.

- [ ] **Step 4: Pool and position chunk views**

Create one background node per preloaded chunk key, load the district texture selected by its deterministic definition, and place it from permanent coordinate minus render origin. Reuse inactive nodes. Hospital landmark chunks use the existing hospital texture; residential/community chunks use Task 7 textures. Apply rotation only when the resource manifest allows it.

- [ ] **Step 5: Synchronize floating-origin shifts**

When the streaming model returns an origin shift, move the world root, update the camera's local value, and retain simulation permanent coordinates. Actor synchronization converts permanent positions through `toLocalRenderPoint()`.

- [ ] **Step 6: Replace global map scaling**

The minimap shows a fixed local radius around the player. The full map shows discovered chunk bounds and landmark markers, with unexplored space clipped rather than pretending to have finite borders. Viewport size is constant in local-map scale.

- [ ] **Step 7: Run UI and battle tests**

Run: `npm run test:ui`

Expected: PASS with no regression in pause, return, interaction, projectile, or night-defense bindings.

- [ ] **Step 8: Commit runtime rendering**

```powershell
git add assets/script/game/battle/BattleHUDViewComp.ts tests/integration/ui
git commit -m "feat: render streamed infinite exploration chunks"
```

### Task 9: End-to-end verification and documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/plans/2026-11-08-seamless-infinite-exploration-map.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified commands, documented seed/reset behavior, and checked task boxes.

- [ ] **Step 1: Run the complete automated suite**

Run: `npm run test:battle`

Expected: PASS.

Run: `npm run test:ui`

Expected: PASS.

- [ ] **Step 2: Run deterministic stress generation**

Run: `node --test tests/unit/world/InfiniteChunkGenerator.test.mjs`

Expected: the 10,000-chunk invariants pass with no road mismatch, disconnected reward, or landmark-distance violation.

- [ ] **Step 3: Run static validation**

Run: `npx tsc --noEmit`

Expected: PASS with no TypeScript errors.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 4: Document the playable behavior**

Add a README section explaining that daytime exploration uses seed `1907` by default, streams a `5×5` window, runs simulation in `3×3`, preserves sparse deltas, and uses the existing hospital as a rare landmark. Include the command that runs generation tests.

- [ ] **Step 5: Manual Creator smoke test**

Open the project in Cocos Creator 3.8.8, enter daytime exploration, travel across at least six chunk boundaries in positive and negative directions, revisit an opened container, open the local/full maps, pause/resume, and return to the ark. Confirm there are no blank seams, duplicated interaction rewards, camera clamps, or increasing node counts.

- [ ] **Step 6: Commit verification documentation**

```powershell
git add README.md docs/superpowers/plans/2026-11-08-seamless-infinite-exploration-map.md
git commit -m "docs: verify seamless infinite exploration"
```
