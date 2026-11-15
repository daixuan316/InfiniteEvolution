# Map Exploration Interactables Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reachable loot containers and investigation points to the hospital district, reveal hidden loot through radar, and let player projectiles destroy a route-blocking barrier that opens a shortcut.

**Architecture:** `BattleMapModel` remains the source of static placement and owns the dynamic blocked-cell set used by collision and A*. `BattleSimulation` owns runtime discovery, completion, rewards, targeting, damage, and interaction events. `BattleHUDViewComp` renders those authoritative states, exposes one proximity interaction button, and adds the same state to both tactical maps.

**Tech Stack:** TypeScript, Cocos Creator 3.8.8, Oops Framework, Node.js built-in test runner.

## Global Constraints

- Target Cocos Creator 3.8.8 and preserve the existing Oops Framework page lifecycle.
- Interaction is proximity plus one explicit button: `开启` for loot and `调查` for exploration points.
- Player auto-fire prioritizes active enemies, then the nearest active breakable barrier.
- Hidden loot is revealed by the radar terminal, not opened by it.
- Loot, exploration effects, and destruction are one-shot within the current battle only.
- Do not add complete inventory grids, random loot tables, equipment replacement, cross-session saving, indoor maps, hold progress bars, or puzzle systems.
- Preserve the user's unrelated untracked `assets/script/game/common/ui/SurfaceFrameLayout.ts.meta` file.

---

## File Structure

- Modify `assets/script/game/battle/BattleMapModel.ts`: declare loot, exploration point, and barrier placement; expose dynamic barrier blocking to collision and A*.
- Modify `assets/script/game/battle/BattleSimulation.ts`: create runtime exploration state, proximity interaction APIs, resource totals/events, barrier targeting, projectile damage, and route refresh.
- Modify `assets/script/game/battle/BattleHUDViewComp.ts`: render world props, interaction UI, pickup messages, barrier state, and map markers.
- Modify `tests/unit/battle/BattleMapModel.test.mjs`: verify reachability and barrier-dependent route changes.
- Modify `tests/unit/battle/BattleSimulation.test.mjs`: verify interaction and combat rules.
- Modify `tests/integration/ui/BattleFlowBindings.test.mjs`: verify the HUD binds the new runtime state and controls.

### Task 1: Map content and dynamic barrier topology

**Files:**
- Modify: `assets/script/game/battle/BattleMapModel.ts`
- Test: `tests/unit/battle/BattleMapModel.test.mjs`

**Interfaces:**
- Produces: `MapLootDefinition`, `MapExplorationDefinition`, `MapBarrierDefinition`.
- Produces: `BattleMapDefinition.loot`, `.explorationPoints`, `.barriers`.
- Produces: `BattleMapDefinition.setBarrierBlocking(id: string, blocking: boolean): boolean`.
- Preserves: `isWalkable`, `isWorldWalkable`, `cellToWorld`, and `worldToCell` as the only topology/coordinate queries.

- [ ] **Step 1: Write failing map-content tests**

Append tests that assert four unique loot IDs, three unique exploration IDs, all interaction cells reachable from `map.start`, and all relevant coordinates round-trip:

```js
test("hospital district places reachable loot and exploration points", () => {
    const map = createHospitalDistrictMap();
    const pathfinder = new GridPathfinder(map);
    assert.equal(map.loot.length, 4);
    assert.equal(map.explorationPoints.length, 3);
    assert.equal(new Set(map.loot.map((item) => item.id)).size, map.loot.length);
    for (const item of [...map.loot, ...map.explorationPoints]) {
        assert.equal(map.isWalkable(item.cell), true, `${item.id} must be walkable`);
        assert.ok(pathfinder.findPath(map.start, item.cell).length > 0, `${item.id} must be reachable`);
        assert.deepEqual(map.worldToCell(map.cellToWorld(item.cell)), item.cell);
    }
});
```

- [ ] **Step 2: Write the failing dynamic barrier test**

Use the authored barrier's `blockedCells`; assert each cell is blocked while active, `setBarrierBlocking` rejects unknown IDs, and clearing the barrier makes each cell walkable:

```js
test("breakable barrier owns dynamic blocked cells and opens them once destroyed", () => {
    const map = createHospitalDistrictMap();
    const barrier = map.barriers[0];
    assert.ok(barrier.blockedCells.length >= 4);
    for (const cell of barrier.blockedCells) assert.equal(map.isWalkable(cell), false);
    assert.equal(map.setBarrierBlocking("missing", false), false);
    assert.equal(map.setBarrierBlocking(barrier.id, false), true);
    for (const cell of barrier.blockedCells) assert.equal(map.isWalkable(cell), true);
});
```

- [ ] **Step 3: Run the focused tests and verify failure**

Run: `node --test tests/unit/battle/BattleMapModel.test.mjs`

Expected: FAIL because `loot`, `explorationPoints`, `barriers`, and `setBarrierBlocking` do not exist.

- [ ] **Step 4: Implement static definitions and the dynamic blocked-cell set**

Add exact domain shapes:

```ts
export type ResourceKind = "scrap" | "medical" | "ammo" | "parts" | "intel";
export interface MapReward { readonly kind: ResourceKind; readonly amount: number; }
export interface MapLootDefinition {
    readonly id: string;
    readonly typeId: "supply-crate" | "medical-cabinet" | "weapon-case" | "hidden-cache";
    readonly name: string;
    readonly cell: GridPoint;
    readonly initiallyDiscovered: boolean;
    readonly rewards: readonly MapReward[];
}
export interface MapExplorationDefinition {
    readonly id: string;
    readonly typeId: "medical-terminal" | "rescue-beacon" | "radar-terminal";
    readonly name: string;
    readonly cell: GridPoint;
    readonly rewards: readonly MapReward[];
}
export interface MapBarrierDefinition {
    readonly id: string;
    readonly typeId: "breakable-barrier";
    readonly name: string;
    readonly cell: GridPoint;
    readonly blockedCells: readonly GridPoint[];
    readonly maxHealth: number;
    readonly defense: number;
    readonly radius: number;
}
```

Author loot at `(14,11)`, `(23,20)`, `(33,3)`, and `(5,20)`; exploration at `(13,3)`, `(24,12)`, and `(34,19)`; place the barrier at `(8,3)` and block `(8,2)` through `(8,5)`. Define `baseWalkable` separately, initialize a `Set<string>` with barrier cells, and have `isWalkable` require both base walkability and absence from the dynamic set. `setBarrierBlocking` adds or removes exactly the definition's blocked cells.

- [ ] **Step 5: Run map tests**

Run: `node --test tests/unit/battle/BattleMapModel.test.mjs tests/unit/battle/GridPathfinder.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the map model**

```powershell
git add -- assets/script/game/battle/BattleMapModel.ts tests/unit/battle/BattleMapModel.test.mjs
git commit -m "feat: define map exploration content"
```

### Task 2: Exploration runtime and breakable barrier combat

**Files:**
- Modify: `assets/script/game/battle/BattleSimulation.ts`
- Test: `tests/unit/battle/BattleSimulation.test.mjs`

**Interfaces:**
- Consumes: map definitions and `setBarrierBlocking` from Task 1.
- Produces: `BattleLoot`, `BattleExplorationPoint`, `BattleInteractionTarget`, `BattleInteractionResult`, `BattleNoticeEvent`.
- Produces: `BattleSimulation.nearestInteraction`, `.interact(id)`, `.resources`, `.loot`, `.explorationPoints`, `.noticeEvents`, and `.structures` with kind `breakable-barrier`.
- Produces: `BattleSimulation.findCombatTarget(id: string): CombatTarget | null` for projectile presentation.

- [ ] **Step 1: Write failing proximity and one-shot interaction tests**

Add a helper that relocates the player to a runtime object's coordinates. Verify distance rejection, successful loot rewards, and duplicate rejection:

```js
test("loot requires proximity and grants its rewards only once", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const loot = simulation.loot[0];
    assert.equal(simulation.interact(loot.id).accepted, false);
    simulation.player.x = loot.x;
    simulation.player.y = loot.y;
    const first = simulation.interact(loot.id);
    assert.equal(first.accepted, true);
    assert.equal(loot.opened, true);
    assert.ok(Object.values(simulation.resources).some((amount) => amount > 0));
    assert.equal(simulation.interact(loot.id).accepted, false);
});
```

- [ ] **Step 2: Write failing radar reveal tests**

```js
test("radar investigation reveals hidden loot without opening it", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const hidden = simulation.loot.find((item) => item.typeId === "hidden-cache");
    const radar = simulation.explorationPoints.find((item) => item.typeId === "radar-terminal");
    assert.equal(hidden.discovered, false);
    simulation.player.x = radar.x;
    simulation.player.y = radar.y;
    assert.equal(simulation.interact(radar.id).accepted, true);
    assert.equal(hidden.discovered, true);
    assert.equal(hidden.opened, false);
    assert.equal(simulation.interact(radar.id).accepted, false);
});
```

- [ ] **Step 3: Replace the old repair test with failing player barrier-combat tests**

Cover enemy priority, barrier fallback, actual projectile damage, destruction, removal from targeting, and topology opening:

```js
test("player prioritizes enemies then auto-fires at and destroys a nearby barrier", () => {
    const map = createHospitalDistrictMap();
    const simulation = new BattleSimulation(map);
    const barrier = simulation.structures[0];
    const enemy = simulation.enemies[0];
    simulation.player.x = barrier.x - 180;
    simulation.player.y = barrier.y;
    enemy.x = simulation.player.x + 100;
    enemy.y = simulation.player.y;
    simulation.update(1 / 60);
    assert.equal(simulation.playerTarget.id, enemy.id);
    enemy.vitality.applyDamage(9999);
    for (let i = 0; i < 300 && barrier.vitality.active; i++) simulation.update(1 / 60);
    assert.equal(barrier.vitality.active, false);
    assert.equal(simulation.playerTarget, null);
    for (const cell of map.barriers[0].blockedCells) assert.equal(map.isWalkable(cell), true);
});
```

- [ ] **Step 4: Run focused tests and verify failure**

Run: `node --test tests/unit/battle/BattleSimulation.test.mjs`

Expected: FAIL because exploration runtime APIs and player barrier targeting are absent.

- [ ] **Step 5: Implement runtime exploration state**

Create runtime arrays from the map definitions, using `map.cellToWorld`. Set `interactionRange = 145`. Initialize exact resource totals:

```ts
readonly resources: Record<ResourceKind, number> = {
    scrap: 0, medical: 0, ammo: 0, parts: 0, intel: 0,
};
```

Implement `nearestInteraction` to return only discovered/unopened loot or incomplete exploration points within range, sorted by distance. Implement `interact(id)` with player-active and distance checks; award configured resources, set the one-shot state, reveal unopened loot for radar, and append one notice event with a stable incrementing ID.

- [ ] **Step 6: Convert the structure and projectile target model**

Construct `structures` from `map.barriers`, with `kind: "breakable-barrier"` and `zeroState: "destroyed"`. Change `playerTarget` and `spawnPlayerProjectile` to accept `CombatTarget`. In `updateAutoAttack`, choose the nearest active enemy first, then nearest active structure. Implement `findCombatTarget` by checking player, enemies, and structures. Use it from `updateProjectiles` and call `map.setBarrierBlocking(target.id, false)` exactly once when a structure reaches zero.

Clear `playerPath` and every enemy's cached `path`, `pathIndex`, `targetCellKey`, and `repathIn` when topology changes so the next update recalculates paths.

- [ ] **Step 7: Run simulation and map tests**

Run: `node --test tests/unit/battle/BattleSimulation.test.mjs tests/unit/battle/BattleMapModel.test.mjs tests/unit/battle/GridPathfinder.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit runtime behavior**

```powershell
git add -- assets/script/game/battle/BattleSimulation.ts tests/unit/battle/BattleSimulation.test.mjs
git commit -m "feat: add exploration interactions and breakable barriers"
```

### Task 3: World presentation, interaction control, notices, and map markers

**Files:**
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Test: `tests/integration/ui/BattleFlowBindings.test.mjs`

**Interfaces:**
- Consumes: `simulation.loot`, `.explorationPoints`, `.nearestInteraction`, `.interact(id)`, `.noticeEvents`, `.findCombatTarget(id)`, `.structures`, and `.resources`.
- Produces: one `InteractionPanel` with target label and action button; programmatic world nodes for each authored object; discovery/completion markers in both maps.

- [ ] **Step 1: Add failing HUD binding assertions**

Read the HUD source in the existing integration test and assert the new integration points:

```js
test("battle HUD binds exploration objects, interaction action, notices, and map markers", () => {
    assert.match(source, /renderExplorationObjects\(\)/);
    assert.match(source, /nearestInteraction/);
    assert.match(source, /simulation\.interact\(/);
    assert.match(source, /consumeNoticeEvents\(\)/);
    assert.match(source, /simulation\.loot/);
    assert.match(source, /simulation\.explorationPoints/);
    assert.match(source, /findCombatTarget\(projectile\.targetId\)/);
});
```

- [ ] **Step 2: Run integration test and verify failure**

Run: `node --test tests/integration/ui/BattleFlowBindings.test.mjs`

Expected: FAIL because the HUD does not bind exploration objects.

- [ ] **Step 3: Render exploration objects as readable program graphics**

Add `lootNodes` and `explorationNodes` maps. Call `renderExplorationObjects()` after the world background and before actors. Use distinct shapes: a rectangular orange-outlined crate with a lid line for loot; a cyan diamond/antenna marker for exploration points. Add a short name label. Hidden undiscovered loot starts inactive. Opened/completed objects remain visible at opacity `100`.

Keep the existing barrier art but rename it `BreakableBarrier`, show `可破坏路障`, and switch its zero-state text to `路障 · 已摧毁 / 捷径已开放`.

- [ ] **Step 4: Add the proximity interaction panel and feedback notice**

Create an `InteractionPanel` above the lower-right controls with a target label, distance label, and a single button. Each update, read `simulation.nearestInteraction`; hide the panel when null, otherwise show `开启` for loot and `调查` for exploration. Button activation calls `simulation.interact(target.id)` and immediately refreshes nodes and maps.

Consume `noticeEvents` once using a remembered last event ID. Display the most recent message in the existing exploration HUD pickup-card visual (`exploration-hud/12-pickup-notification-card`) or a panel fallback, then fade it after `2.4` seconds.

- [ ] **Step 5: Add markers to small and full maps**

In `drawDynamicMap`, draw discovered unfinished loot as orange squares, incomplete exploration points as cyan diamonds, and the active barrier as a red bar. Draw completed objects at smaller size with a white check stroke; draw a destroyed barrier as a cyan gap marker. In the full map, add runtime labels only for discovered objects and update their active state when radar reveals loot.

- [ ] **Step 6: Generalize projectile and hit presentation**

In `syncProjectiles`, replace the enemy-only lookup with:

```ts
const target = this.simulation.findCombatTarget(projectile.targetId);
```

Keep damage numbers and hit flashing for structures. Use the structure's real zero state when calculating resting opacity.

- [ ] **Step 7: Run UI tests**

Run: `npm run test:ui`

Expected: PASS.

- [ ] **Step 8: Commit HUD integration**

```powershell
git add -- assets/script/game/battle/BattleHUDViewComp.ts tests/integration/ui/BattleFlowBindings.test.mjs
git commit -m "feat: present map exploration interactions"
```

### Task 4: Full regression and project handoff

**Files:**
- Verify: `assets/script/game/battle/BattleMapModel.ts`
- Verify: `assets/script/game/battle/BattleSimulation.ts`
- Verify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Verify: all changed battle tests

**Interfaces:**
- Consumes: all deliverables from Tasks 1–3.
- Produces: a verified, internally consistent exploration slice ready for Cocos Creator visual playtesting.

- [ ] **Step 1: Run all automated suites**

Run:

```powershell
npm run test:battle
npm run test:ui
```

Expected: both commands exit `0` with no failed tests.

- [ ] **Step 2: Run repository hygiene checks**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only intentional implementation changes plus the pre-existing untracked `assets/script/game/common/ui/SurfaceFrameLayout.ts.meta` remain.

- [ ] **Step 3: Inspect the final diff against the spec**

Verify each item explicitly in the diff: four loot types, three exploration point types, radar reveal without opening, proximity validation, one-shot rewards, enemy-first targeting, player barrier damage, dynamic topology opening, world feedback, minimap/full-map markers, and no inventory/save expansion.

- [ ] **Step 4: Commit any final test-only correction**

Only if verification required a correction:

```powershell
git add -- assets/script/game/battle tests/unit/battle tests/integration/ui/BattleFlowBindings.test.mjs
git commit -m "test: verify map exploration flow"
```

