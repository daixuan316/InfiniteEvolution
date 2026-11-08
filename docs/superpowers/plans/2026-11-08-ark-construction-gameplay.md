# Ark Construction Gameplay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Ark construction demo with a saved module-layout system whose power, noise, durability, repair, evolution, and combat effects form one playable loop.

**Architecture:** Keep all Ark rules in Cocos-independent TypeScript under `shelter/model`, coordinate mutations through one `ArkService`, and persist versioned plain data through an injected key-value store. A dedicated `ArkBuildViewComp` renders live state, while battle consumes an immutable `ArkBattleSnapshot` and returns a narrow settlement containing durability and resource changes.

**Tech Stack:** TypeScript, Node `node:test`, Cocos Creator 3.8.8, Oops Framework, existing `GamePage`/`UIBuilder` UI runtime.

## Global Constraints

- Keep Cocos Creator at 3.8.8 and do not add runtime dependencies.
- Use seven fixed slots; do not implement pixel-level free placement.
- UI never mutates saved Ark objects directly; every mutation goes through `ArkService`.
- Zero durability disables a module but never deletes it.
- Power allocation is deterministic: `core`, then `important`, then `normal`, with instance ID as the stable tie-breaker.
- Every evolution has a gameplay ability, a numeric side effect, and a visible state marker.
- Battle reads an immutable snapshot and writes only a settlement at a safe checkpoint.
- Preserve unrelated working-tree edits, especially current battle and UI changes.

---

## File Structure

### Domain and persistence

- Create `assets/script/game/shelter/model/ArkTypes.ts`: serializable definitions, state, commands, errors, derived values, snapshots, settlements.
- Create `assets/script/game/shelter/model/ArkCatalog.ts`: ten first-party module definitions, seven slots, evolutions, default resources and state factory.
- Create `assets/script/game/shelter/model/ArkRules.ts`: placement, power, noise, adjacency, repair, evolution, layout validation and battle snapshot calculations.
- Create `assets/script/game/shelter/model/ArkService.ts`: atomic command API and battle settlement application.
- Create `assets/script/game/shelter/model/ArkRepository.ts`: versioned JSON storage, migration and corrupt-state recovery.
- Create `assets/script/game/shelter/ArkRuntime.ts`: browser/localStorage adapter and shared service instance.

### UI and integration

- Create `assets/script/game/shelter/ArkBuildViewComp.ts`: dedicated interactive Ark construction page.
- Modify `assets/script/game/common/ui/UIRuntime.ts`: register `UIID.ArkBuild` with `ArkBuildViewComp`.
- Modify `assets/script/game/hall/HallViewComp.ts`: render live Ark resources and derived Ark status.
- Modify `assets/script/game/common/config/GameEvent.ts`: add Ark state, power, noise, damage and settlement events.
- Modify `assets/script/game/battle/BattleSimulation.ts`: accept Ark snapshot, create allied modules, apply noise-scaled hordes, expose settlement.
- Modify `assets/script/game/battle/BattleHUDViewComp.ts`: load the snapshot, render allied modules, expose emergency power/repair, settle before returning.

### Tests

- Create `tests/unit/shelter/ArkRules.test.mjs`.
- Create `tests/unit/shelter/ArkService.test.mjs`.
- Create `tests/unit/shelter/ArkRepository.test.mjs`.
- Create `tests/unit/shelter/ArkBattleSnapshot.test.mjs`.
- Modify `tests/unit/battle/BattleSimulation.test.mjs`.
- Create `tests/integration/ui/ArkBuildBindings.test.mjs`.
- Modify `tests/integration/ui/UIViewBindings.test.mjs`.

---

### Task 1: Ark data contract and content catalog

**Files:**
- Create: `assets/script/game/shelter/model/ArkTypes.ts`
- Create: `assets/script/game/shelter/model/ArkCatalog.ts`
- Test: `tests/unit/shelter/ArkRules.test.mjs`

**Interfaces:**
- Produces: `ArkState`, `ArkModuleDefinition`, `ArkModuleInstance`, `ArkSlotDefinition`, `ArkEvolutionDefinition`, `ArkDerivedState`, `ArkResult<T>`, `createDefaultArkState()` and catalog lookup helpers.
- Consumes: no earlier task interfaces.

- [ ] **Step 1: Write a failing catalog/default-state test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { ARK_MODULES, ARK_SLOTS, createDefaultArkState } from "../../../assets/script/game/shelter/model/ArkCatalog.ts";

test("default Ark owns ten modules and exposes seven fixed slots", () => {
    const state = createDefaultArkState();
    assert.equal(ARK_MODULES.length, 10);
    assert.equal(ARK_SLOTS.length, 7);
    assert.equal(new Set(state.modules.map((item) => item.instanceId)).size, 10);
    assert.deepEqual(Object.keys(state.layouts), ["alpha", "beta", "gamma"]);
});
```

- [ ] **Step 2: Run the focused test and verify missing-module failure**

Run: `node --test tests/unit/shelter/ArkRules.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `ArkCatalog.ts`.

- [ ] **Step 3: Define serializable contracts**

`ArkTypes.ts` must define these stable unions and shapes:

```ts
export type ArkCategory = "structure" | "energy" | "defense" | "bio";
export type ArkSlotKind = "front" | "top" | "side" | "internal" | "bio";
export type PowerPriority = "core" | "important" | "normal";
export type ArkLayoutId = "alpha" | "beta" | "gamma";
export type NoiseTier = "hidden" | "noticed" | "danger" | "bait";
export type ArkResourceId = "scrap" | "parts" | "alloy" | "energyCell" | "mutationCore";

export interface ArkModuleInstance {
    instanceId: string;
    definitionId: string;
    durability: number;
    priority: PowerPriority;
    evolutionId: string | null;
}

export interface ArkLayoutState {
    slots: Record<string, string | null>;
}

export interface ArkState {
    schemaVersion: 1;
    resources: Record<ArkResourceId, number>;
    modules: ArkModuleInstance[];
    layouts: Record<ArkLayoutId, ArkLayoutState>;
    activeLayoutId: ArkLayoutId;
    repairQueue: string[];
    repairSpentToday: number;
    coreDurability: number;
    coreMaxDurability: number;
}
```

Define `ArkErrorCode` as the union `"unknown_module" | "unknown_slot" | "slot_rejects_module" | "slot_occupied" | "instance_already_installed" | "insufficient_resources" | "invalid_layout" | "repair_not_needed" | "repair_cap_reached" | "evolution_incompatible" | "already_evolved" | "settlement_already_applied"`. Define `ArkResult<T>` as `{ ok: true; value: T } | { ok: false; error: ArkErrorCode }`. The battle contracts must include snapshot module entries, frozen snapshot arrays, settlement module durability entries, resource deltas and a stable `battleId`.

- [ ] **Step 4: Add the fixed catalog and default state**

Create seven slot definitions whose IDs are `front-left`, `front-right`, `top-left`, `top-right`, `side`, `internal`, and `bio`. Add ten module definitions for armor plate, barricade, generator, battery, machine-gun turret, shotgun turret, electric grid, repair drone, radar and regenerative tissue. Each definition includes exact costs, durability, power, noise, tags, battle stats and compatible slot kinds. `createDefaultArkState()` must return new arrays/objects on every call and install a generator, armor plate and machine-gun turret in layout `alpha` so the first battle demonstrates the system.

- [ ] **Step 5: Run the test**

Run: `node --test tests/unit/shelter/ArkRules.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit the data contract**

```powershell
git add -- assets/script/game/shelter/model/ArkTypes.ts assets/script/game/shelter/model/ArkCatalog.ts tests/unit/shelter/ArkRules.test.mjs
git commit -m "feat: define ark construction catalog"
```

### Task 2: Deterministic placement, power, noise and adjacency rules

**Files:**
- Create: `assets/script/game/shelter/model/ArkRules.ts`
- Modify: `tests/unit/shelter/ArkRules.test.mjs`

**Interfaces:**
- Consumes: `ArkState` and catalog definitions from Task 1.
- Produces: `validatePlacement(state, layoutId, slotId, instanceId)`, `deriveArkState(state)`, `classifyNoise(value)`, `quoteRepair(state, instanceId)`, `validateEvolution(state, instanceId, evolutionId)` and `buildArkBattleSnapshot(state)`.

- [ ] **Step 1: Add failing placement and power tests**

```js
test("placement rejects incompatible and occupied slots without changing state", () => {
    const state = createDefaultArkState();
    const before = structuredClone(state);
    assert.deepEqual(validatePlacement(state, "alpha", "top-right", "generator-1"), {
        ok: false, error: "slot_rejects_module",
    });
    assert.deepEqual(state, before);
});

test("power keeps core modules online before normal modules", () => {
    const state = createDefaultArkState();
    state.modules.find((item) => item.instanceId === "generator-1").durability = 1;
    const derived = deriveArkState(state);
    assert.ok(derived.poweredInstanceIds.includes("generator-1"));
    assert.ok(derived.unpoweredInstanceIds.every((id) => id !== "generator-1"));
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/unit/shelter/ArkRules.test.mjs`

Expected: FAIL because `ArkRules.ts` does not exist.

- [ ] **Step 3: Implement placement and derived calculations**

`validatePlacement` validates stable IDs, category/slot compatibility, duplicate instance use and occupancy. `deriveArkState` must:

1. Resolve installed modules from the active layout.
2. Treat zero-durability modules as disabled.
3. Sum generator and battery capacity.
4. Allocate power in `core`, `important`, `normal` order with instance ID tie-breaking.
5. Calculate active noise and classify thresholds `<25`, `25..59`, `60..99`, `>=100`.
6. Apply adjacency pairs using the fixed slot-neighbor graph and cap visible bonuses to two per instance.
7. Return copied arrays/maps so callers cannot mutate `ArkState` through derived values.

- [ ] **Step 4: Add failing noise and adjacency tests**

```js
test("noise exposes all four deterministic tiers", () => {
    assert.equal(classifyNoise(0), "hidden");
    assert.equal(classifyNoise(25), "noticed");
    assert.equal(classifyNoise(60), "danger");
    assert.equal(classifyNoise(100), "bait");
});

test("battery beside generator adds one visible adjacency bonus", () => {
    const state = createDefaultArkState();
    state.layouts.alpha.slots.internal = "battery-1";
    const derived = deriveArkState(state);
    assert.ok(derived.adjacencies.some((entry) => entry.bonusId === "generator-battery"));
    assert.ok(derived.adjacencies.filter((entry) => entry.instanceId === "battery-1").length <= 2);
});
```

- [ ] **Step 5: Run all shelter rule tests**

Run: `node --test tests/unit/shelter/ArkRules.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit deterministic rules**

```powershell
git add -- assets/script/game/shelter/model/ArkRules.ts tests/unit/shelter/ArkRules.test.mjs
git commit -m "feat: calculate ark placement power and noise"
```

### Task 3: Atomic Ark commands, repair, layouts and evolution

**Files:**
- Create: `assets/script/game/shelter/model/ArkService.ts`
- Create: `tests/unit/shelter/ArkService.test.mjs`

**Interfaces:**
- Consumes: Task 1 state/catalog and Task 2 rule functions.
- Produces: `ArkService` methods `install`, `remove`, `move`, `setPriority`, `switchLayout`, `enqueueRepair`, `processRepair`, `applyEvolution`, `removeEvolution`, `createBattleSnapshot`, `applyBattleSettlement`, and read-only `snapshot()`/`derived()`.

- [ ] **Step 1: Write failing atomicity and repair tests**

```js
test("failed install neither charges resources nor changes layout", () => {
    const service = new ArkService(createDefaultArkState());
    const before = service.snapshot();
    const result = service.install("alpha", "top-left", "generator-1");
    assert.equal(result.ok, false);
    assert.deepEqual(service.snapshot(), before);
});

test("zero-durability module remains installed and repair reactivates it", () => {
    const state = createDefaultArkState();
    state.modules.find((item) => item.instanceId === "turret-mg-1").durability = 0;
    const service = new ArkService(state);
    assert.equal(service.enqueueRepair("turret-mg-1").ok, true);
    assert.equal(service.processRepair(100).ok, true);
    assert.ok(service.snapshot().modules.find((item) => item.instanceId === "turret-mg-1").durability > 0);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/unit/shelter/ArkService.test.mjs`

Expected: FAIL with missing `ArkService.ts`.

- [ ] **Step 3: Implement clone-mutate-validate-commit commands**

Each public command clones current state, applies one mutation, recalculates derived state, and commits the clone only on success. Return `ArkResult<ArkDerivedState>` with a stable error code. `install` charges the module definition cost only when the instance has never been commissioned; use a serializable `commissioned: boolean` field on instances. `remove` and `move` do not refund or charge. `switchLayout` rejects unknown/missing instances and leaves the old layout active.

- [ ] **Step 4: Implement repair and evolution rules**

Repair cost is `ceil(missingDurability / 10)` scrap plus `ceil(missingDurability / 25)` parts, capped by a daily repair value of 200. Night repair consumes two energy cells per processed queue step. Evolution consumes one mutation core, applies catalog deltas, and rejects an already evolved or incompatible instance. Removal clears the stored evolution and returns `0.5` mutation core; resource quantities therefore allow finite non-negative half units, and repeat removal must fail so no duplication is possible.

- [ ] **Step 5: Add layout/evolution/settlement tests**

Test that three layouts remain independent, missing instances reject a switch, evolution changes power/noise and exposes its ability, removing it restores exact base values, duplicate settlement IDs are rejected, and a valid settlement updates durability/resources exactly once.

- [ ] **Step 6: Run service tests**

Run: `node --test tests/unit/shelter/ArkService.test.mjs tests/unit/shelter/ArkRules.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit command layer**

```powershell
git add -- assets/script/game/shelter/model/ArkTypes.ts assets/script/game/shelter/model/ArkService.ts tests/unit/shelter/ArkService.test.mjs
git commit -m "feat: add atomic ark construction commands"
```

### Task 4: Versioned persistence and shared runtime

**Files:**
- Create: `assets/script/game/shelter/model/ArkRepository.ts`
- Create: `assets/script/game/shelter/ArkRuntime.ts`
- Create: `tests/unit/shelter/ArkRepository.test.mjs`

**Interfaces:**
- Consumes: `ArkState`, `createDefaultArkState`, `ArkService`.
- Produces: `KeyValueStore`, `ArkRepository.load()`, `ArkRepository.save(state)`, and singleton `arkRuntime` exposing `service`, `reload`, `save`, `subscribe`.

- [ ] **Step 1: Write failing round-trip and corruption tests**

```js
test("repository round-trips an Ark state through injected storage", () => {
    const memory = new Map();
    const repo = new ArkRepository({ getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) });
    const state = createDefaultArkState();
    state.resources.scrap = 77;
    repo.save(state);
    assert.equal(repo.load().resources.scrap, 77);
});

test("corrupt JSON recovers default layout without throwing", () => {
    const repo = new ArkRepository({ getItem: () => "{bad", setItem: () => undefined });
    assert.equal(repo.load().activeLayoutId, "alpha");
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/unit/shelter/ArkRepository.test.mjs`

Expected: FAIL with missing `ArkRepository.ts`.

- [ ] **Step 3: Implement repository normalization**

Use storage key `infinite-evolution.ark.v1`. Parse only plain JSON, normalize all finite non-negative numbers, drop unknown module instances, clear slot references to missing instances, preserve recognized resources, and fall back to `createDefaultArkState()` only when no recoverable state remains. `save` serializes a cloned state and never derived caches.

- [ ] **Step 4: Implement runtime adapter**

`ArkRuntime` selects `globalThis.localStorage` when available and a process-memory store otherwise. It owns one `ArkService`, saves after successful mutation, broadcasts one copied state/derived pair to subscribers, and provides `settleBattle(settlement)` as the only battle writeback entry.

- [ ] **Step 5: Run persistence tests**

Run: `node --test tests/unit/shelter/ArkRepository.test.mjs tests/unit/shelter/ArkService.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit persistence**

```powershell
git add -- assets/script/game/shelter/model/ArkRepository.ts assets/script/game/shelter/ArkRuntime.ts tests/unit/shelter/ArkRepository.test.mjs
git commit -m "feat: persist versioned ark state"
```

### Task 5: Dedicated interactive construction page

**Files:**
- Create: `assets/script/game/shelter/ArkBuildViewComp.ts`
- Modify: `assets/script/game/common/ui/UIRuntime.ts:1-40`
- Modify: `assets/script/game/common/config/GameEvent.ts`
- Create: `tests/integration/ui/ArkBuildBindings.test.mjs`
- Modify: `tests/integration/ui/UIViewBindings.test.mjs`

**Interfaces:**
- Consumes: `arkRuntime`, `ArkService` command results, `GamePage`, `UIBuilder`, `UI_THEME`.
- Produces: Cocos component `ArkBuildViewComp` registered exclusively for `UIID.ArkBuild`.

- [ ] **Step 1: Write failing static integration checks**

```js
test("ArkBuild uses its dedicated page and real Ark runtime", () => {
    const runtime = readFileSync("assets/script/game/common/ui/UIRuntime.ts", "utf8");
    const page = readFileSync("assets/script/game/shelter/ArkBuildViewComp.ts", "utf8");
    assert.match(runtime, /register\(UIID\.ArkBuild, ArkBuildViewComp\)/);
    assert.match(page, /arkRuntime/);
    assert.match(page, /install\(/);
    assert.match(page, /switchLayout\(/);
    assert.doesNotMatch(page, /FEATURE_DEMO_VIEW_MODELS/);
});
```

- [ ] **Step 2: Verify failure**

Run: `node --test tests/integration/ui/ArkBuildBindings.test.mjs`

Expected: FAIL because `ArkBuildViewComp.ts` does not exist.

- [ ] **Step 3: Build page shell and live render model**

Reuse the current header, category rail, central seven-slot layout and right detail panel proportions. Render live category filters, module inventory, selected module/slot, three layout buttons, derived power/noise/core metrics and a context-sensitive primary action. Selection is tap-first: module then slot then confirmation; no drag precision is required.

- [ ] **Step 4: Wire every command and visible error**

Bind install/remove/move, priority cycling, repair queue/process, evolution apply/remove, and layout switching. Convert every `ArkErrorCode` to a Chinese message passed to `uiNavigation.toast`. Refresh from the state emitted by `arkRuntime` after successful commands, and unsubscribe in `onDestroy`.

- [ ] **Step 5: Register Ark events and page component**

Add `ArkStateChanged`, `ArkPowerChanged`, `ArkNoiseChanged`, `ArkModuleDamaged`, and `ArkBattleSettled` to `GameEvent`. Replace only the `UIID.ArkBuild` registration with `ArkBuildViewComp`; leave all other feature pages on `FeaturePageViewComp`.

- [ ] **Step 6: Run UI integration tests**

Run: `node --test tests/integration/ui/ArkBuildBindings.test.mjs tests/integration/ui/UIViewBindings.test.mjs tests/integration/ui/UIConfigRegistry.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit the construction page**

```powershell
git add -- assets/script/game/shelter/ArkBuildViewComp.ts assets/script/game/common/ui/UIRuntime.ts assets/script/game/common/config/GameEvent.ts tests/integration/ui/ArkBuildBindings.test.mjs tests/integration/ui/UIViewBindings.test.mjs
git commit -m "feat: make ark construction interactive"
```

### Task 6: Bind Hall status and resources to live Ark state

**Files:**
- Modify: `assets/script/game/hall/HallViewComp.ts:1-180`
- Modify: `tests/integration/ui/UIViewBindings.test.mjs`

**Interfaces:**
- Consumes: `arkRuntime.service.snapshot()` and `.derived()`.
- Produces: Hall resource rail and Ark status based on persisted values rather than `HALL_DEMO_VIEW_MODEL.ark/resources`.

- [ ] **Step 1: Add a failing binding assertion**

Assert that `HallViewComp.ts` imports `arkRuntime`, subscribes to it, and does not read `HALL_DEMO_VIEW_MODEL.ark` or `HALL_DEMO_VIEW_MODEL.resources`.

- [ ] **Step 2: Verify failure**

Run: `node --test tests/integration/ui/UIViewBindings.test.mjs`

Expected: FAIL on the new Ark runtime assertions.

- [ ] **Step 3: Render live values and refresh safely**

Keep chapter/day/threat demo text unchanged. Replace resource values with `scrap`, `alloy`, and `energyCell`; replace core, power and installed-module counts with Ark state/derived values. Store label/progress references and update their values on subscription rather than rebuilding the Hall tree. Dispose the subscription during destruction.

- [ ] **Step 4: Run Hall/UI tests**

Run: `node --test tests/integration/ui/UIViewBindings.test.mjs tests/unit/ui/HallLayout.test.mjs tests/integration/ui/UIVisualComposition.test.mjs`

Expected: PASS.

- [ ] **Step 5: Commit live Hall binding**

```powershell
git add -- assets/script/game/hall/HallViewComp.ts tests/integration/ui/UIViewBindings.test.mjs
git commit -m "feat: show live ark status in hall"
```

### Task 7: Battle snapshot and real module combat behavior

**Files:**
- Modify: `assets/script/game/shelter/model/ArkRules.ts`
- Create: `tests/unit/shelter/ArkBattleSnapshot.test.mjs`
- Modify: `assets/script/game/battle/BattleSimulation.ts`
- Modify: `tests/unit/battle/BattleSimulation.test.mjs`

**Interfaces:**
- Consumes: `ArkBattleSnapshot` from `buildArkBattleSnapshot(state)`.
- Produces: optional `BattleSimulation(map, arkSnapshot?)`, `arkModules`, `tryEmergencyPower(instanceId)`, `tryRemoteRepair(instanceId)`, and `createArkSettlement()`.

- [ ] **Step 1: Write failing snapshot determinism test**

Create two snapshots from the same state and assert deep equality, frozen top-level/entry objects, only active-layout modules included, powered flags match derived state, and noise tier/multiplier are present.

- [ ] **Step 2: Implement immutable snapshot creation**

Map installed instances to plain combat entries with instance ID, definition ID, slot ID, current/max durability, powered/operational flags, attack stats, defense, radius, repair rate, ability ID and visual marker. Freeze nested arrays and entries. Noise multipliers are `0.85`, `1`, `1.25`, and `1.5`; reward multipliers are `1`, `1`, `1.2`, and `1.5`.

- [ ] **Step 3: Write failing battle module tests**

```js
test("powered Ark turret damages enemies and a zero-power turret does not", () => {
    const powered = new BattleSimulation(createHospitalDistrictMap(), snapshotWithTurret(true));
    const offline = new BattleSimulation(createHospitalDistrictMap(), snapshotWithTurret(false));
    const poweredHealth = powered.enemies[0].vitality.currentHealth;
    const offlineHealth = offline.enemies[0].vitality.currentHealth;
    advance(powered, 4);
    advance(offline, 4);
    assert.ok(powered.enemies[0].vitality.currentHealth < poweredHealth);
    assert.equal(offline.enemies[0].vitality.currentHealth, offlineHealth);
});
```

Also test that enemies can damage an Ark defense, zero durability remains in `arkModules`, emergency power consumes one charge, remote repair consumes energy, and settlement reports final durability once.

- [ ] **Step 4: Integrate modules without disturbing existing player combat**

Keep the one-argument constructor valid. Add allied turret update after player auto-attack, include defensive Ark targets in enemy target selection, and use existing `resolveDamage`/`VitalityRuntime`. Do not replace map barriers or current projectile behavior. Scale the horde spawn budget by snapshot noise through a deterministic extra-spawn queue rather than mutating global Horde definitions.

- [ ] **Step 5: Implement settlement**

`createArkSettlement()` returns a unique battle ID, final module durability records, resource deltas already multiplied by reward tier, consumed energy cells, and final core durability. It must not mutate Ark saved state itself.

- [ ] **Step 6: Run domain and battle tests**

Run: `node --test tests/unit/shelter/ArkBattleSnapshot.test.mjs tests/unit/battle/BattleSimulation.test.mjs`

Expected: PASS, including all pre-existing battle tests.

- [ ] **Step 7: Commit battle domain integration**

```powershell
git add -- assets/script/game/shelter/model/ArkRules.ts assets/script/game/battle/BattleSimulation.ts tests/unit/shelter/ArkBattleSnapshot.test.mjs tests/unit/battle/BattleSimulation.test.mjs
git commit -m "feat: apply ark modules in battle simulation"
```

### Task 8: Battle HUD visuals, emergency controls and settlement writeback

**Files:**
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Modify: `tests/integration/ui/BattleFlowBindings.test.mjs`

**Interfaces:**
- Consumes: `arkRuntime.createBattleSnapshot()`, Task 7 simulation APIs, `arkRuntime.settleBattle()`.
- Produces: visible allied module nodes, module durability/status, emergency power and remote repair controls, exactly-once settlement before leaving battle.

- [ ] **Step 1: Add failing static flow assertions**

Assert that `BattleHUDViewComp` constructs the simulation with an Ark snapshot, renders `ArkModule:` nodes, calls `tryEmergencyPower`, calls `tryRemoteRepair`, and calls `arkRuntime.settleBattle` from the confirmed return/cleanup path.

- [ ] **Step 2: Verify failure**

Run: `node --test tests/integration/ui/BattleFlowBindings.test.mjs`

Expected: FAIL on the new Ark integration assertions.

- [ ] **Step 3: Render and synchronize module visuals**

Create compact programmatic nodes for each `simulation.arkModules` entry using category colors and the snapshot visual marker. Show durability bars and offline/damaged labels. Update positions and state alongside existing actor/vitality synchronization without assuming only one structure exists.

- [ ] **Step 4: Add emergency controls**

Show two short-press buttons only when an eligible module exists: emergency transfer selects the first offline important/core module, and remote repair selects the lowest durability installed module. Surface rejected operations through `uiNavigation.toast`.

- [ ] **Step 5: Settle exactly once**

Before confirmed return to Hall, call `arkRuntime.settleBattle(this.simulation.createArkSettlement())`. Guard with `battleSettled` so repeated callbacks and `onDestroy` cannot apply the same settlement twice. Dispatch `GameEvent.ArkBattleSettled` after success.

- [ ] **Step 6: Run battle flow/UI regression tests**

Run: `node --test tests/integration/ui/BattleFlowBindings.test.mjs tests/unit/ui/BattleHUDLayout.test.mjs tests/integration/ui/UIVisualComposition.test.mjs`

Expected: PASS.

- [ ] **Step 7: Commit battle presentation**

```powershell
git add -- assets/script/game/battle/BattleHUDViewComp.ts tests/integration/ui/BattleFlowBindings.test.mjs
git commit -m "feat: expose ark modules during battle"
```

### Task 9: Full verification and Cocos compatibility

**Files:**
- Modify only files required by concrete test/type failures from Tasks 1-8.

**Interfaces:**
- Consumes: the completed Ark construction loop.
- Produces: verified test, type-check and repository status evidence.

- [ ] **Step 1: Run the complete automated suite**

Run: `node --test tests/unit/**/*.test.mjs tests/integration/**/*.test.mjs`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run the Cocos TypeScript check**

Run: `npx tsc -p tsconfig.json --noEmit`

Expected: zero TypeScript errors from Ark files and no new errors in modified integration files. If the generated `temp/tsconfig.cocos.json` is absent, open the project once in Cocos Creator 3.8.8 to regenerate it, then rerun the exact command.

- [ ] **Step 3: Run whitespace and focused diff checks**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only known pre-existing user changes plus intended Ark implementation changes remain.

- [ ] **Step 4: Perform Creator preview acceptance**

Verify: open Ark Build; install, move and remove a module; exhaust power; switch all three layouts; queue and execute repair; apply/remove evolution; restart preview; start battle; observe a turret attack and a defense take damage; use emergency power and repair; return to Hall; reopen Ark Build and confirm durability/resources persisted.

- [ ] **Step 5: Commit verification-only fixes if any were required**

Review `git diff --name-only`, stage each file that was changed specifically to resolve Step 1-3 failures with `git add -- path/to/file`, then run `git commit -m "fix: complete ark gameplay verification"`. If no verification fixes were needed, do not create an empty commit.

