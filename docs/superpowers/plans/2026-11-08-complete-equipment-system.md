# Complete Equipment System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the equipment/workshop demo shells with a persistent, data-driven equipment system whose nine weapon classes, armor, affixes, resonances, progression, loadouts, and combat memory visibly affect battle.

**Architecture:** Keep all rules in Cocos-free TypeScript domain files. A single `EquipmentRuntime` owns the serializable campaign state and exposes atomic commands; Cocos views render presenters and submit commands, while `BattleSimulation` receives an immutable combat snapshot and returns memory deltas at settlement.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Oops Framework, Node.js built-in `node:test`, existing `UIBuilder`, local `oops.storage` adapter.

## Global Constraints

- Preserve Cocos Creator 3.8.8, Oops Framework, 1334×750 landscape layout, and Douyin mini-game compatibility.
- Domain files must not import `cc`; persistent records must contain stable IDs and serializable data only.
- Keep the existing dirty battle/map/horde changes intact. Never stage or commit a pre-existing dirty file unless the combined diff has been reviewed line by line.
- Use test-first red/green/refactor for every production behavior; verify the expected failure before implementation.
- Equipment uses no durability. Ordinary ammunition is infinite, but magazines, reload, firing interval, and heat still apply.
- Nine initial weapon classes are required: assault rifle, SMG, shotgun, sniper, LMG, grenade launcher, flame, arc, and bio.
- Three loadouts, eight physical slots, six resonance families, six memory counters, two evolution choices, and versioned save recovery are required.

---

## File Structure

- `assets/script/game/equipment/model/EquipmentTypes.ts` — serializable equipment and combat snapshot contracts.
- `assets/script/game/equipment/config/EquipmentCatalog.ts` — validated definitions for equipment, affixes, resonances, evolution routes, and recipes.
- `assets/script/game/equipment/config/StarterEquipment.ts` — deterministic starter state and nine initial weapon instances.
- `assets/script/game/equipment/model/EquipmentInventory.ts` — capacity, instance lookup, materials, and protection checks.
- `assets/script/game/equipment/model/LoadoutCollection.ts` — three loadouts, equip/unequip, active loadout, and primary weapon order.
- `assets/script/game/equipment/model/EquipmentResolver.ts` — stat, affix, resonance, and evolution aggregation.
- `assets/script/game/equipment/model/CombatMemory.ts` — memory event recording and evolution eligibility.
- `assets/script/game/equipment/model/EquipmentEconomyService.ts` — atomic craft, strengthen, synchronize, reroll, and salvage commands.
- `assets/script/game/equipment/model/WeaponRuntime.ts` — Cocos-free magazine/reload/heat/swap and weapon-mechanic state.
- `assets/script/game/equipment/EquipmentRuntime.ts` — application façade, transactional state replacement, listeners, and persistence calls.
- `assets/script/game/save/model/CampaignEquipmentSave.ts` — save schema, migration, and validation.
- `assets/script/game/save/SaveRepository.ts` — current/previous/temp snapshot repository.
- `assets/script/game/save/OopsStorageAdapter.ts` — framework storage adapter.
- `assets/script/game/equipment/view/EquipmentPresenter.ts` — equipment page ViewModel and command mapping.
- `assets/script/game/equipment/view/EquipmentViewComp.ts` — real equipment and warehouse page.
- `assets/script/game/equipment/view/WorkshopPresenter.ts` — workshop ViewModel and command mapping.
- `assets/script/game/equipment/view/WorkshopViewComp.ts` — craft/strengthen/synchronize/reroll/salvage page.
- Existing `BagModule.ts`, `RoleModule.ts`, `EvolveModule.ts`, `SaveModule.ts` become narrow adapters over `EquipmentRuntime`.
- Existing `BattleSimulation.ts`, `BattleHUDLayout.ts`, `BattleHUDViewComp.ts`, `GameEvent.ts`, and `UIRuntime.ts` receive integration changes only.
- New unit tests live in `tests/unit/equipment/`; save tests in `tests/unit/save/`; integration assertions remain under `tests/integration/ui/`.

### Task 1: Domain contracts and validated nine-weapon catalog

**Files:**
- Create: `assets/script/game/equipment/model/EquipmentTypes.ts`
- Create: `assets/script/game/equipment/config/EquipmentCatalog.ts`
- Create: `assets/script/game/equipment/config/StarterEquipment.ts`
- Test: `tests/unit/equipment/EquipmentCatalog.test.mjs`

**Interfaces:**
- Produces: `EquipmentSlot`, `WeaponClass`, `EquipmentInstance`, `EquipmentState`, `WeaponCombatSnapshot`, `RoleCombatSnapshot`, `EQUIPMENT_CATALOG`, `validateEquipmentCatalog()`, `createStarterEquipmentState()`.

- [ ] **Step 1: Write the failing catalog test**

```js
test("catalog ships all nine distinct weapon classes and valid references", () => {
    assert.deepEqual(
        EQUIPMENT_CATALOG.weapons.map((item) => item.weaponClass).sort(),
        ["arc", "assault", "bio", "flame", "grenade", "lmg", "shotgun", "smg", "sniper"],
    );
    assert.deepEqual(validateEquipmentCatalog(EQUIPMENT_CATALOG), []);
});

test("starter state has unique instances, three loadouts, and every slot category", () => {
    const state = createStarterEquipmentState();
    assert.equal(new Set(state.instances.map((item) => item.instanceId)).size, state.instances.length);
    assert.equal(state.loadouts.length, 3);
    assert.equal(state.materials.scrap > 0, true);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/unit/equipment/EquipmentCatalog.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `EquipmentCatalog.ts`.

- [ ] **Step 3: Define exact serializable contracts**

```ts
export type EquipmentSlot = "primary1" | "primary2" | "helmet" | "armor" | "gloves" | "boots" | "tactical" | "organ";
export type WeaponClass = "assault" | "smg" | "shotgun" | "sniper" | "lmg" | "grenade" | "flame" | "arc" | "bio";
export type EquipmentQuality = "common" | "fine" | "rare" | "epic" | "legendary" | "mutated";
export type ResonanceTag = "thunder" | "sentinel" | "machine" | "mutation" | "wasteland" | "heavy";
export type MemoryKind = "closeHit" | "weakpointHit" | "swapChain" | "arkDefenseKill" | "statusProc" | "highPollutionUse";

export interface EquipmentInstance {
    instanceId: string;
    templateId: string;
    level: number;
    strengthen: number;
    quality: EquipmentQuality;
    affixIds: string[];
    tags: ResonanceTag[];
    favorite: boolean;
    locked: boolean;
    rerollCount: number;
    rerollSlot: number | null;
    evolutionId: string | null;
    evolutionResetCount: number;
    memory: Record<MemoryKind, number>;
}
```

Define catalog records with numeric weapon fields (`damage`, `interval`, `range`, `magazine`, `reload`, `heatPerShot`, `coolingPerSecond`, `projectileSpeed`) and typed mechanic fields (`pellets`, `penetration`, `splashRadius`, `chainTargets`, `status`, `pollutionCost`).

- [ ] **Step 4: Add deterministic first-party content**

Create one weapon definition per class, six armor/accessory definitions covering `helmet`, `armor`, `gloves`, `boots`, `tactical`, and `organ`, constrained affixes in five categories, six 2/3-piece resonance definitions, eighteen weapon evolution routes (two per weapon), and recipes referencing stable IDs. `validateEquipmentCatalog()` must report duplicate IDs, invalid slots, missing affixes/evolutions, and non-positive combat values.

- [ ] **Step 5: Run catalog tests and existing combat tests**

Run: `node --test tests/unit/equipment/EquipmentCatalog.test.mjs tests/unit/combat/*.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit only new clean files**

```powershell
git add -- assets/script/game/equipment/model/EquipmentTypes.ts assets/script/game/equipment/config tests/unit/equipment/EquipmentCatalog.test.mjs
git commit -m "feat: define complete equipment catalog"
```

### Task 2: Inventory and three loadouts

**Files:**
- Create: `assets/script/game/equipment/model/EquipmentInventory.ts`
- Create: `assets/script/game/equipment/model/LoadoutCollection.ts`
- Test: `tests/unit/equipment/EquipmentInventory.test.mjs`
- Test: `tests/unit/equipment/LoadoutCollection.test.mjs`

**Interfaces:**
- Consumes: `EquipmentInstance`, `EquipmentSlot`, `EquipmentState`, catalog template lookups.
- Produces: `EquipmentInventory.add/remove/addMaterial/spendMaterials`, `LoadoutCollection.equip/unequip/select/rename/swapPrimary`, `EquipmentCommandResult<T>`.

- [ ] **Step 1: Write failing inventory tests**

```js
test("inventory rejects overflow and material spending is atomic", () => {
    const inventory = new EquipmentInventory({ capacity: 1, instances: [], materials: { scrap: 10 } });
    assert.equal(inventory.add(instance("a", "weapon_assault")).ok, true);
    assert.deepEqual(inventory.add(instance("b", "weapon_smg")), { ok: false, error: "inventory-full" });
    assert.deepEqual(inventory.spendMaterials({ scrap: 11 }), { ok: false, error: "insufficient-materials" });
    assert.equal(inventory.materialCount("scrap"), 10);
});
```

- [ ] **Step 2: Verify inventory RED, then implement and verify GREEN**

Run RED/GREEN: `node --test tests/unit/equipment/EquipmentInventory.test.mjs`

The removal API must accept a protection callback and return `protected-instance` without mutation.

- [ ] **Step 3: Write failing loadout tests**

```js
test("loadouts enforce slots, allow cross-loadout reuse, and swap primaries", () => {
    const loadouts = new LoadoutCollection(threeEmptyLoadouts());
    assert.equal(loadouts.equip("loadout-1", "primary1", assault).ok, true);
    assert.equal(loadouts.equip("loadout-2", "primary1", assault).ok, true);
    assert.equal(loadouts.equip("loadout-1", "helmet", assault).error, "slot-mismatch");
    loadouts.equip("loadout-1", "primary2", smg);
    loadouts.swapPrimary("loadout-1");
    assert.equal(loadouts.get("loadout-1").slots.primary1, smg.instanceId);
});
```

- [ ] **Step 4: Verify loadout RED, implement exact rules, and verify GREEN**

Run: `node --test tests/unit/equipment/LoadoutCollection.test.mjs`

`select(id)` rejects unknown IDs; `rename(id, name)` trims and limits names to 12 Unicode code points; missing inventory references resolve to `null` plus warnings rather than throwing.

- [ ] **Step 5: Run all equipment tests and commit new files**

Run: `node --test tests/unit/equipment/*.test.mjs`

Commit: `git commit -m "feat: manage inventory and equipment loadouts"` with only Task 2 files staged.

### Task 3: Affixes, resonance, evolution, and combat snapshot resolution

**Files:**
- Create: `assets/script/game/equipment/model/EquipmentResolver.ts`
- Create: `assets/script/game/equipment/model/CombatMemory.ts`
- Test: `tests/unit/equipment/EquipmentResolver.test.mjs`
- Test: `tests/unit/equipment/CombatMemory.test.mjs`

**Interfaces:**
- Consumes: active loadout, inventory instances, catalog definitions, `MemoryKind`.
- Produces: `resolveRoleCombatSnapshot(state, catalog)`, `resolveResonances(instances, catalog)`, `recordMemory()`, `availableEvolutionIds()`.

- [ ] **Step 1: Write failing snapshot and resonance tests**

```js
test("resolver applies equipment stats, same-pool bonuses, and resonance once", () => {
    const snapshot = resolveRoleCombatSnapshot(fixtureStateWithThunderSet(), EQUIPMENT_CATALOG);
    assert.equal(snapshot.maxHealth, 540);
    assert.equal(snapshot.weapons.length, 2);
    assert.equal(snapshot.resonances.find((item) => item.tag === "thunder").tier, 3);
    assert.equal(snapshot.weapons[0].chainTargets, 2);
});
```

Use hand-calculated fixture values. The test must fail if additive bonuses are multiplied independently or one instance counts the same tag twice.

- [ ] **Step 2: Verify RED, implement deterministic aggregation, verify GREEN**

Run: `node --test tests/unit/equipment/EquipmentResolver.test.mjs`

Aggregation order is base role → template/level → strengthen → fixed trait → additive affix pools → resonance → evolution. Clamp intervals, cooldowns, magazine sizes, and health to positive values.

- [ ] **Step 3: Write failing memory/evolution tests**

```js
test("epic weapon unlocks exactly its two configured paths at threshold", () => {
    let item = epicWeapon();
    item = recordMemory(item, { kind: "weakpointHit", amount: 25 });
    assert.deepEqual(availableEvolutionIds(item, EQUIPMENT_CATALOG), ["assault_hunter", "assault_vanguard"]);
});

test("common weapon does not accumulate evolution memory", () => {
    assert.deepEqual(recordMemory(commonWeapon(), { kind: "closeHit", amount: 10 }).memory, commonWeapon().memory);
});
```

- [ ] **Step 4: Verify RED, implement memory and route selection rules, verify GREEN**

Run: `node --test tests/unit/equipment/CombatMemory.test.mjs`

Evolution selection rejects unavailable routes. Reset cost is `1 + evolutionResetCount * 2` evolution samples and clears only `evolutionId`, not earned memory.

- [ ] **Step 5: Run all equipment tests and commit**

Commit message: `feat: resolve equipment builds and evolution`.

### Task 4: Atomic equipment economy

**Files:**
- Create: `assets/script/game/equipment/model/EquipmentEconomyService.ts`
- Test: `tests/unit/equipment/EquipmentEconomyService.test.mjs`

**Interfaces:**
- Consumes: mutable transaction copy of `EquipmentState`, `EquipmentCatalog`, injected `RandomSource`.
- Produces: `craft`, `strengthen`, `synchronize`, `rerollAffix`, `salvageOne`, `salvageMany`, each returning `{ ok: true, state, value } | { ok: false, error }`.

- [ ] **Step 1: Write failing transaction tests**

```js
test("failed craft and strengthen leave resources and instances unchanged", () => {
    const before = fixtureState({ scrap: 0 });
    const service = new EquipmentEconomyService(EQUIPMENT_CATALOG, fixedRandom([0.2]));
    assert.equal(service.craft(before, "recipe_assault").ok, false);
    assert.deepEqual(before, fixtureState({ scrap: 0 }));
});

test("bulk salvage skips every protected category", () => {
    const result = service.salvageMany(stateWithEquippedFavoriteLockedEvolvedLegendaryAndCommon(), allIds);
    assert.deepEqual(result.value.salvagedIds, ["common-free"]);
});
```

- [ ] **Step 2: Verify RED and implement clone-validate-commit transactions**

Run: `node --test tests/unit/equipment/EquipmentEconomyService.test.mjs`

Craft validates recipe unlock, materials, and capacity before generating an instance. Strengthen increases only `strengthen` and consumes scrap/parts. Synchronize raises `level` to the allowed stage. Reroll changes exactly `rerollSlot` and increments `rerollCount`. Salvage emits deterministic material returns and refuses protected single-item salvage unless an explicit confirmation flag is true where allowed.

- [ ] **Step 3: Add boundary tests**

Cover role-level cap, chapter cap, invalid affix category, full inventory, missing instance, NaN material values, duplicate bulk IDs, and legendary/mutated confirmation.

- [ ] **Step 4: Run full equipment suite and commit**

Run: `node --test tests/unit/equipment/*.test.mjs`

Commit message: `feat: add atomic equipment progression economy`.

### Task 5: Versioned save repository and application runtime

**Files:**
- Create: `assets/script/game/save/model/CampaignEquipmentSave.ts`
- Create: `assets/script/game/save/SaveRepository.ts`
- Create: `assets/script/game/save/OopsStorageAdapter.ts`
- Create: `assets/script/game/equipment/EquipmentRuntime.ts`
- Modify: `assets/script/game/save/SaveModule.ts`
- Modify: `assets/script/game/bag/BagModule.ts`
- Modify: `assets/script/game/role/RoleModule.ts`
- Modify: `assets/script/game/evolve/EvolveModule.ts`
- Test: `tests/unit/save/EquipmentSave.test.mjs`
- Test: `tests/unit/equipment/EquipmentRuntime.test.mjs`

**Interfaces:**
- Produces: `SAVE_SCHEMA_VERSION`, `migrateCampaignSave`, `SaveRepository.load/commit`, singleton `equipmentRuntime`, narrow module command façades.

- [ ] **Step 1: Write failing migration/recovery tests**

```js
test("migration preserves valid old equipment and repairs dangling loadout ids", () => {
    const migrated = migrateCampaignSave(versionZeroFixture(), EQUIPMENT_CATALOG);
    assert.equal(migrated.schemaVersion, SAVE_SCHEMA_VERSION);
    assert.equal(migrated.equipment.instances.some((item) => item.instanceId === "kept"), true);
    assert.equal(migrated.equipment.loadouts[0].slots.helmet, null);
});

test("repository falls back to previous when current is corrupt", () => {
    const store = new MemoryStore({ "campaign:current": "{", "campaign:previous": validSaveText() });
    assert.equal(new SaveRepository(store, "campaign").load().source, "previous");
});
```

- [ ] **Step 2: Verify RED, implement schema/migration/repository, verify GREEN**

Run: `node --test tests/unit/save/EquipmentSave.test.mjs`

Commit writes `temp`, parses and validates it, copies current to previous, promotes temp, and removes temp. `load()` tries current then previous then starter state and returns diagnostics without deleting corrupt text.

- [ ] **Step 3: Write failing runtime tests**

```js
test("runtime saves successful commands and rolls memory back when storage fails", () => {
    const runtime = new EquipmentRuntime(catalog, state, rejectingRepository());
    const before = runtime.snapshot();
    assert.deepEqual(runtime.equip("loadout-1", "helmet", "helmet-1"), { ok: false, error: "save-failed" });
    assert.deepEqual(runtime.snapshot(), before);
});
```

- [ ] **Step 4: Verify RED, implement runtime and narrow adapters, verify GREEN**

`EquipmentRuntime` clones state, applies one command, validates, commits, replaces state only after commit succeeds, then emits one immutable snapshot to listeners. `BagModule` exposes inventory/economy commands, `RoleModule` exposes loadout/snapshot commands, and `EvolveModule` exposes memory/evolution commands.

- [ ] **Step 5: Run save/equipment tests and commit clean files**

Run: `node --test tests/unit/save/*.test.mjs tests/unit/equipment/*.test.mjs`

Do not include unrelated dirty files in this commit.

### Task 6: Weapon runtime for all nine classes

**Files:**
- Create: `assets/script/game/equipment/model/WeaponRuntime.ts`
- Test: `tests/unit/equipment/WeaponRuntime.test.mjs`

**Interfaces:**
- Consumes: two `WeaponCombatSnapshot` records and deterministic `RandomSource`.
- Produces: `DualWeaponRuntime.update`, `tryFire`, `swap`, `active`, `events`, `memoryDeltas`.

- [ ] **Step 1: Write failing magazine/reload/heat/swap tests**

```js
test("each weapon preserves magazine and heat while inactive and cools in background", () => {
    const runtime = new DualWeaponRuntime([hotFlame(), assault()], fixedRandom([0.1]));
    runtime.tryFire(target());
    const heat = runtime.active.heat;
    runtime.swap();
    runtime.update(1);
    runtime.swap();
    assert.ok(runtime.active.heat < heat);
});
```

- [ ] **Step 2: Verify RED and implement shared cadence state**

`tryFire` returns typed shot intents rather than touching battle targets. Empty magazines begin reload; overheated weapons block until cooled below the resume threshold; swapping keeps independent cooldown/reload/heat.

- [ ] **Step 3: Add one behavior test per weapon class**

Assert literal shot intents: assault single projectile, SMG mobile bonus, shotgun pellet count, sniper penetration/weakpoint, LMG suppression stack, grenade splash/minimum range, flame burn/heat, arc chain count/shock, bio infection/pollution cost.

- [ ] **Step 4: Implement the minimal intent generation and verify GREEN**

Run: `node --test tests/unit/equipment/WeaponRuntime.test.mjs`

- [ ] **Step 5: Commit**

Commit message: `feat: simulate nine equipment weapon classes`.

### Task 7: Integrate equipment into battle without losing existing horde/map work

**Files:**
- Modify: `assets/script/game/battle/BattleSimulation.ts`
- Modify: `tests/unit/battle/BattleSimulation.test.mjs`
- Modify: `assets/script/game/combat/Vitality.ts` only if a tested max-stat initialization gap requires it
- Test: `tests/unit/battle/EquipmentBattleIntegration.test.mjs`

**Interfaces:**
- Consumes: `RoleCombatSnapshot`, `DualWeaponRuntime`.
- Produces: optional `BattleSimulation(map, snapshot?, random?)`, `switchWeapon()`, `weaponStatus`, `drainEquipmentMemoryDeltas()`.

- [ ] **Step 1: Characterize current battle defaults before changing them**

Add a test proving `new BattleSimulation(map)` retains current 420 health, 180 shield, 270 speed, 20 defense, 35 damage, 0.35 interval, and 320 range via the default snapshot. Run it and verify PASS before refactoring.

- [ ] **Step 2: Write failing equipped-stat test**

```js
test("battle actor and active weapon use the supplied equipment snapshot", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap(), combatSnapshot({ maxHealth: 600, defense: 44, moveSpeed: 333, weaponDamage: 80 }));
    assert.equal(simulation.player.vitality.maxHealth, 600);
    assert.equal(simulation.player.defense, 44);
    assert.equal(simulation.player.speed, 333);
    assert.equal(simulation.weaponStatus.damage, 80);
});
```

- [ ] **Step 3: Verify RED, then replace hardcoded player combat constants with snapshot reads**

Preserve all current map interactions, horde phases, structure targeting, projectile feedback, and user-authored dirty changes. Review `git diff -- BattleSimulation.ts` before and after each patch.

- [ ] **Step 4: Write failing mechanic integration tests**

Cover shotgun multi-hit, sniper penetration, grenade splash, burn ticks, arc chain, bio infection, reload gap, heat lockout, and weapon swap persistence against real `VitalityRuntime` targets. Each expected damage total must be hand-derived.

- [ ] **Step 5: Implement shot-intent resolution through `DamageResolver` and verify GREEN**

All direct, splash, chain, penetration, and damage-over-time hits call the existing resolved damage path. Emit hit events with the actual applied shield/health split. Accumulate memory deltas by the source equipment instance ID.

- [ ] **Step 6: Run battle and equipment regression suites**

Run: `npm run test:battle` and `node --test tests/unit/equipment/*.test.mjs tests/unit/battle/EquipmentBattleIntegration.test.mjs`

Expected: zero failures.

- [ ] **Step 7: Hold overlapping dirty integration files for final review**

Do not commit `BattleSimulation.ts` if its pre-task diff cannot be separated from existing user changes. Record the combined diff for Task 10 review.

### Task 8: Real equipment and workshop pages

**Files:**
- Create: `assets/script/game/equipment/view/EquipmentPresenter.ts`
- Create: `assets/script/game/equipment/view/EquipmentViewComp.ts`
- Create: `assets/script/game/equipment/view/WorkshopPresenter.ts`
- Create: `assets/script/game/equipment/view/WorkshopViewComp.ts`
- Modify: `assets/script/game/common/ui/UIRuntime.ts`
- Modify: `assets/script/game/common/ui/UIDemoData.ts`
- Test: `tests/unit/equipment/EquipmentPresenter.test.mjs`
- Test: `tests/unit/equipment/WorkshopPresenter.test.mjs`
- Modify: `tests/integration/ui/UIViewBindings.test.mjs`

**Interfaces:**
- Consumes: `EquipmentRuntime`, existing `UIBuilder`, `GamePage`, `uiNavigation`.
- Produces: immutable page ViewModels and dedicated route components for Equipment and Workshop.

- [ ] **Step 1: Write failing presenter tests**

```js
test("equipment presenter compares the selected item with its active-slot item", () => {
    const model = new EquipmentPresenter(runtimeFixture()).select("candidate-assault").view();
    assert.equal(model.selected.instanceId, "candidate-assault");
    assert.deepEqual(model.comparison.damage, { current: 35, candidate: 48, delta: 13 });
    assert.equal(model.actions.equip.enabled, true);
});
```

Workshop tests cover cost preview, disabled reason, protected salvage warning, and post-command refresh.

- [ ] **Step 2: Verify RED, implement presenters, verify GREEN**

Run: `node --test tests/unit/equipment/*Presenter.test.mjs`

- [ ] **Step 3: Add dedicated Cocos pages**

Build the four-column equipment layout with existing `UIBuilder.surface`, `slot`, `label`, `navButton`, and icon helpers. Required interactive node names: `BtnBack`, `TabWeapons`, `TabArmor`, `TabTactical`, `TabOrgan`, `BtnLoadout1..3`, `BtnEquip`, `BtnUnequip`, `BtnFavorite`, `BtnLock`, `BtnEvolve`, `BtnSalvage`, and inventory cards prefixed `EquipmentCard-`.

Workshop required names: `TabCraft`, `TabStrengthen`, `TabSynchronize`, `TabReroll`, `TabSalvage`, `BtnConfirmWorkshop`, and `BtnConfirmProtectedSalvage`.

- [ ] **Step 4: Replace only Equipment/Workshop registrations**

```ts
UIPageBootstrap.register(UIID.Equipment, EquipmentViewComp);
UIPageBootstrap.register(UIID.Workshop, WorkshopViewComp);
```

Leave ArkBuild, Research, Crew, and Intel on `FeaturePageViewComp`. Remove only Equipment/Workshop demo records and copy after their real pages are registered.

- [ ] **Step 5: Verify UI binding tests**

Run: `npm run test:ui`

Expected: routes still open/close, the two real pages do not contain the old “规则将在后续接入” copy, and all required node names are present in source bindings.

### Task 9: Battle HUD weapon controls and memory settlement

**Files:**
- Modify: `assets/script/game/battle/BattleHUDLayout.ts`
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Modify: `assets/script/game/common/config/GameEvent.ts`
- Test: `tests/unit/ui/BattleHUDLayout.test.mjs`
- Modify: `tests/integration/ui/BattleFlowBindings.test.mjs`

**Interfaces:**
- Consumes: `BattleSimulation.weaponStatus/switchWeapon/drainEquipmentMemoryDeltas`, `equipmentRuntime`.
- Produces: weapon status layout, `BtnWeaponSwap`, one-time settlement on leave/complete.

- [ ] **Step 1: Write failing HUD layout/binding tests**

```js
test("weapon status remains inside the right safe frame", () => {
    const layout = battleHUDLayout(1334, 750);
    assert.ok(layout.weaponStatus.right <= layout.safe.right);
    assert.ok(layout.weaponSwap.bottom >= layout.safe.bottom);
});
```

Integration source test must require `BtnWeaponSwap`, `switchWeapon`, magazine/heat rendering, and a single settlement guard.

- [ ] **Step 2: Verify RED, implement layout and bindings, verify GREEN**

Display active/backup names, magazine or heat, reload/overheat state, and swap cooldown feedback. Reuse existing HUD textures and icons; no new remote assets.

- [ ] **Step 3: Implement idempotent settlement**

On normal leave or `NightCompleted`, call `drainEquipmentMemoryDeltas()` once and pass the result to `equipmentRuntime.recordBattleMemory(batchId, deltas)`. Persist processed `batchId` values for the current run so repeated UI callbacks cannot double count.

- [ ] **Step 4: Run UI, battle, and equipment tests**

Run: `npm run test:ui`, `npm run test:battle`, and `node --test tests/unit/equipment/*.test.mjs`.

### Task 10: Creator metadata, final regression, and manual acceptance

**Files:**
- Create: `.meta` files for every new TypeScript file and new equipment directories using Cocos importer version `4.0.24` and unique UUIDs.
- Review: all files changed by Tasks 1–9.

**Interfaces:**
- Consumes: complete equipment system.
- Produces: importable Cocos Creator project and verification evidence.

- [ ] **Step 1: Generate/validate metadata**

Open the project once in Cocos Creator 3.8.8 to generate missing metadata, or add matching metadata records and then verify that Creator imports each new script without UUID collisions.

- [ ] **Step 2: Run the complete automated suite**

Run:

```powershell
npm run test:battle
npm run test:ui
node --test tests/unit/equipment/*.test.mjs tests/unit/save/*.test.mjs tests/unit/combat/*.test.mjs tests/unit/monster/*.test.mjs tests/unit/shelter/*.test.mjs tests/unit/world/*.test.mjs
npx tsc -p tsconfig.json --noEmit
```

Expected: all test processes exit 0 and TypeScript reports zero errors.

- [ ] **Step 3: Inspect the final diff for ownership and scope**

Run `git diff --check`, `git status --short`, and per-file diffs for every pre-existing dirty file. Confirm that current horde, map exploration, hit feedback, and layout changes remain present. Do not stage unrelated files.

- [ ] **Step 4: Creator manual acceptance**

In Creator preview: open Equipment, equip two weapons and six non-weapon pieces, switch all three loadouts, favorite/lock an item, and verify comparison/resonance changes. In Workshop, craft, strengthen, synchronize, reroll, and test protected and successful salvage. Enter battle, observe both weapon rhythms and swap persistence, verify armor/health/speed changes, trigger memory progress, leave battle, select an evolution, restart preview, and confirm all state remains.

- [ ] **Step 5: Final verification report**

Report exact commands, passing counts, Creator checks completed, and any manual check unavailable in the current environment. Link the design, plan, principal runtime file, and primary tests.

## Plan Self-Review

- Spec coverage: every design section maps to Tasks 1–10, including nine weapons, eight slots, three loadouts, six resonances, economy, evolution, save recovery, real pages, HUD, battle, and persistence.
- Placeholder scan: no deferred implementation or unspecified “appropriate” handling remains.
- Type consistency: all later tasks consume the contracts named in Task 1; `EquipmentRuntime` is the sole mutable application façade; battle consumes `RoleCombatSnapshot` and returns memory deltas.
- Scope: unrelated shop, talent tree, quest loot, and new art remain excluded as required by the approved design.
