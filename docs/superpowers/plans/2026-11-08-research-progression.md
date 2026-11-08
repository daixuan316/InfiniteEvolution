# Research Progression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the inert research demo with a persistent four-branch, three-slot timed research system whose completed nodes modify real battle stats.

**Architecture:** Pure TypeScript files own immutable research definitions, versioned mutable state, queue reconciliation, and modifier aggregation. A thin Oops storage service supplies persistence, a dedicated Cocos `ResearchViewComp` renders and submits commands, and `BattleSimulation` receives already-aggregated player modifiers through its constructor.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript ES modules, Oops Framework storage, Node `node:test` + strict assertions.

## Global Constraints

- Preserve all unrelated dirty-worktree changes; stage only files belonging to each task.
- Use stable string node IDs in saves; never persist Cocos nodes, components, or engine objects.
- The queue has one active worker and three total slots; prerequisites must be completed before enqueue.
- Default new-save research points are exactly `8`.
- Offline progress uses absolute millisecond completion timestamps and protects against clock rollback with `lastObservedAtMs`.
- Initial research durations remain between `20` and `90` seconds for prototype verification.
- Completed research may change only player max health, max shield, attack damage, and movement speed in this phase.
- Research business logic must remain importable by Node tests without importing `cc` or Oops Framework.

---

## File Map

- Create `assets/script/game/research/model/ResearchTypes.ts`: shared definitions, state, results, and modifier types.
- Create `assets/script/game/research/model/ResearchCatalog.ts`: the 12-node content catalog plus graph validation.
- Create `assets/script/game/research/model/ResearchRuntime.ts`: save normalization, queue commands, reconciliation, queries, and effect aggregation.
- Create `assets/script/game/research/ResearchService.ts`: lazy Oops storage adapter and process-wide research runtime facade.
- Create `assets/script/game/research/ResearchViewComp.ts`: dedicated Cocos research page and countdown rendering.
- Create matching Cocos `.meta` files and the `research/` plus `research/model/` directory `.meta` files.
- Modify `assets/script/game/common/ui/UIRuntime.ts`: register the dedicated research component.
- Modify `assets/script/game/battle/BattleSimulation.ts`: accept and apply `BattlePlayerModifiers`.
- Modify `assets/script/game/battle/BattleHUDViewComp.ts`: reconcile research and pass modifiers into a new battle simulation.
- Create `tests/unit/research/ResearchCatalog.test.mjs`: catalog validation and initial-content tests.
- Create `tests/unit/research/ResearchRuntime.test.mjs`: command atomicity, queue, offline, rollback, save recovery, and aggregation tests.
- Modify `tests/unit/battle/BattleSimulation.test.mjs`: verify default and modified player stats.
- Create `tests/integration/ui/ResearchFlowBindings.test.mjs`: verify the page registration, storage boundary, and non-empty button binding.
- Modify `package.json`: include `tests/unit/research/*.test.mjs` in the battle and UI suites.

---

### Task 1: Research catalog and graph validation

**Files:**
- Create: `assets/script/game/research/model/ResearchTypes.ts`
- Create: `assets/script/game/research/model/ResearchCatalog.ts`
- Create: `tests/unit/research/ResearchCatalog.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `ResearchBranch`, `ResearchEffect`, `ResearchDefinition`, `BattlePlayerModifiers`, `RESEARCH_DEFINITIONS`, `validateResearchCatalog(definitions)`, `researchById(id)`.
- Consumes: no engine APIs.

- [ ] **Step 1: Write failing catalog tests**

```js
import { RESEARCH_DEFINITIONS, validateResearchCatalog } from "../../../assets/script/game/research/model/ResearchCatalog.ts";

test("initial catalog exposes four branches and twelve valid nodes", () => {
    assert.equal(RESEARCH_DEFINITIONS.length, 12);
    assert.deepEqual(new Set(RESEARCH_DEFINITIONS.map((node) => node.branch)), new Set(["mechanical", "survival", "biochemical", "hybrid"]));
    assert.doesNotThrow(() => validateResearchCatalog(RESEARCH_DEFINITIONS));
});

test("catalog rejects duplicate ids, missing prerequisites, and cycles", () => {
    assert.throws(() => validateResearchCatalog([baseNode, { ...baseNode }]), /duplicate/i);
    assert.throws(() => validateResearchCatalog([{ ...baseNode, prerequisites: ["missing"] }]), /prerequisite/i);
    assert.throws(() => validateResearchCatalog([
        { ...baseNode, id: "a", prerequisites: ["b"] },
        { ...baseNode, id: "b", prerequisites: ["a"] },
    ]), /cycle/i);
});
```

- [ ] **Step 2: Run the catalog test and confirm RED**

Run: `node --test tests/unit/research/ResearchCatalog.test.mjs`

Expected: FAIL because `ResearchCatalog.ts` does not exist.

- [ ] **Step 3: Implement types, all 12 literal definitions, and DFS validation**

The implementation must reject duplicate IDs, non-positive/non-finite costs and durations, invalid effect values, unknown prerequisites, self-dependencies, and cycles. `researchById` returns `ResearchDefinition | undefined` from a module-private `Map`.

- [ ] **Step 4: Add research tests to package scripts and verify GREEN**

Set both scripts to include `tests/unit/research/*.test.mjs`, then run:

`node --test tests/unit/research/ResearchCatalog.test.mjs`

Expected: all catalog tests PASS.

- [ ] **Step 5: Commit catalog slice**

```powershell
git add -- assets/script/game/research/model tests/unit/research/ResearchCatalog.test.mjs package.json
git commit -m "feat: define research progression catalog"
```

### Task 2: Persistent queue runtime and offline reconciliation

**Files:**
- Modify: `assets/script/game/research/model/ResearchTypes.ts`
- Create: `assets/script/game/research/model/ResearchRuntime.ts`
- Create: `tests/unit/research/ResearchRuntime.test.mjs`

**Interfaces:**
- Consumes: `ResearchDefinition`, `ResearchEffect`, and `BattlePlayerModifiers` from Task 1.
- Produces: `ResearchSaveV1`, `ResearchQueueEntry`, `ResearchNodeStatus`, `ResearchStorage`, `StartResearchResult`, and class `ResearchRuntime` with `snapshot(now)`, `startResearch(nodeId, now)`, `reconcile(now)`, `nodeStatus(nodeId, now)`, `modifiers(now)`, and `bioLoad(now)`.

- [ ] **Step 1: Write failing command and atomicity tests**

Use an in-memory `ResearchStorage` seeded with literal saves. Tests must assert that a successful start deducts the exact cost once, a second start reports `queued`, unmet prerequisites report `prerequisite`, insufficient points report `points`, and the fourth queue entry reports `queue-full`. Capture the full pre-command snapshot and assert deep equality after every rejected command.

- [ ] **Step 2: Run the focused runtime test and confirm RED**

Run: `node --test tests/unit/research/ResearchRuntime.test.mjs --test-name-pattern="start|reject"`

Expected: FAIL because `ResearchRuntime.ts` does not exist.

- [ ] **Step 3: Implement normalized loading and atomic `startResearch`**

`ResearchRuntime` accepts `(definitions, storage, defaultPoints = 8)`. Load lazily on first command/query. Compute a new candidate state, persist it, then publish it to the runtime; do not mutate points or queue before every validation passes.

- [ ] **Step 4: Run command tests and confirm GREEN**

Run: `node --test tests/unit/research/ResearchRuntime.test.mjs --test-name-pattern="start|reject"`

Expected: focused tests PASS.

- [ ] **Step 5: Write failing sequential queue, offline, and clock rollback tests**

Use fixed timestamps such as `1_000_000`. Assert that later queue entries finish after the previous `finishAtMs`, `reconcile` completes every elapsed head entry in order, and calling with an earlier time neither changes `finishAtMs` nor removes/completes extra entries.

- [ ] **Step 6: Run timing tests and confirm RED**

Run: `node --test tests/unit/research/ResearchRuntime.test.mjs --test-name-pattern="queue|offline|rollback"`

Expected: FAIL because reconciliation behavior is missing.

- [ ] **Step 7: Implement reconciliation and version-1 save normalization**

Use `effectiveNow = Math.max(finiteNow, state.lastObservedAtMs)`. Remove all expired queue heads, append their IDs once to `completed`, retain future entries unchanged, update `lastObservedAtMs`, and persist only when state changes. Normalization drops unknown, duplicate, completed, or fourth-and-later queue items and clamps points to a non-negative integer.

- [ ] **Step 8: Write failing modifier and bio-load tests**

Seed only `completed` IDs and assert exact literal outputs, including multiplication (`1.15 * 1.10`) and exclusion of queued nodes.

- [ ] **Step 9: Implement `modifiers`, `bioLoad`, status, and snapshot queries**

Return defaults `{ maxHealthAdd: 0, maxShieldAdd: 0, attackDamageMultiplier: 1, moveSpeedMultiplier: 1 }`; aggregate only completed nodes.

- [ ] **Step 10: Run all research tests and confirm GREEN**

Run: `node --test tests/unit/research/*.test.mjs`

Expected: all research tests PASS with no warnings.

- [ ] **Step 11: Commit runtime slice**

```powershell
git add -- assets/script/game/research/model tests/unit/research
git commit -m "feat: add persistent timed research queue"
```

### Task 3: Apply research modifiers to real battle stats

**Files:**
- Modify: `assets/script/game/battle/BattleSimulation.ts`
- Modify: `tests/unit/battle/BattleSimulation.test.mjs`

**Interfaces:**
- Consumes: `BattlePlayerModifiers` from `ResearchTypes.ts`.
- Produces: `new BattleSimulation(map, modifiers?)`; public `playerAttackDamage` reflects the configured final damage.

- [ ] **Step 1: Write failing battle modifier test**

```js
test("research modifiers change only player combat stats", () => {
    const base = new BattleSimulation(createHospitalDistrictMap());
    const upgraded = new BattleSimulation(createHospitalDistrictMap(), {
        maxHealthAdd: 80,
        maxShieldAdd: 50,
        attackDamageMultiplier: 1.15,
        moveSpeedMultiplier: 1.08,
    });

    assert.equal(upgraded.player.vitality.maxHealth, 500);
    assert.equal(upgraded.player.vitality.maxShield, 230);
    assert.equal(upgraded.playerAttackDamage, 35 * 1.15);
    assert.equal(upgraded.player.speed, 270 * 1.08);
    assert.equal(upgraded.enemies[0].vitality.maxHealth, base.enemies[0].vitality.maxHealth);
    assert.equal(upgraded.structures[0].vitality.maxHealth, base.structures[0].vitality.maxHealth);
});
```

- [ ] **Step 2: Run the battle test and confirm RED**

Run: `node --test tests/unit/battle/BattleSimulation.test.mjs --test-name-pattern="research modifiers"`

Expected: FAIL because the constructor ignores a second argument.

- [ ] **Step 3: Implement optional modifier application**

Add `DEFAULT_BATTLE_PLAYER_MODIFIERS`, sanitize non-finite input back to defaults, calculate final readonly damage once, and apply additions/multipliers only when constructing the player.

- [ ] **Step 4: Run the complete battle test file and confirm GREEN**

Run: `node --test tests/unit/battle/BattleSimulation.test.mjs`

Expected: all battle simulation tests PASS.

- [ ] **Step 5: Commit battle integration slice**

```powershell
git add -- assets/script/game/battle/BattleSimulation.ts tests/unit/battle/BattleSimulation.test.mjs
git commit -m "feat: apply research bonuses in battle"
```

### Task 4: Oops storage facade and battle-page wiring

**Files:**
- Create: `assets/script/game/research/ResearchService.ts`
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Create: `tests/integration/ui/ResearchFlowBindings.test.mjs`

**Interfaces:**
- Consumes: `ResearchRuntime`, `RESEARCH_DEFINITIONS`, `oops.storage`, and `BattleSimulation(map, modifiers)`.
- Produces: singleton `researchRuntime`; storage key `research.progression.v1`.

- [ ] **Step 1: Write failing source-boundary integration checks**

The checks read production source and require `ResearchService` to implement `ResearchStorage`, use only key `research.progression.v1`, and require `BattleHUDViewComp` to call `researchRuntime.modifiers(Date.now())` when creating `BattleSimulation`.

- [ ] **Step 2: Run the integration check and confirm RED**

Run: `node --test tests/integration/ui/ResearchFlowBindings.test.mjs`

Expected: FAIL because the service and wiring are absent.

- [ ] **Step 3: Implement lazy storage facade and battle creation**

The adapter's `load` catches JSON/storage errors, logs a diagnostic, and returns `undefined`; `save` passes the versioned object to `oops.storage.set`. Reconcile implicitly through `modifiers(Date.now())` before each new battle.

- [ ] **Step 4: Run binding and battle tests and confirm GREEN**

Run: `node --test tests/integration/ui/ResearchFlowBindings.test.mjs tests/unit/battle/BattleSimulation.test.mjs`

Expected: all selected tests PASS.

- [ ] **Step 5: Commit service slice**

```powershell
git add -- assets/script/game/research/ResearchService.ts assets/script/game/battle/BattleHUDViewComp.ts tests/integration/ui/ResearchFlowBindings.test.mjs
git commit -m "feat: persist research and load battle bonuses"
```

### Task 5: Dedicated interactive research page

**Files:**
- Create: `assets/script/game/research/ResearchViewComp.ts`
- Modify: `assets/script/game/common/ui/UIRuntime.ts`
- Modify: `tests/integration/ui/ResearchFlowBindings.test.mjs`
- Create: Cocos `.meta` files for every new research directory and TypeScript file.

**Interfaces:**
- Consumes: `researchRuntime`, `RESEARCH_DEFINITIONS`, `GamePage`, `UIBuilder`, `uiNavigation`, and `UI_THEME`.
- Produces: `@ccclass("ResearchViewComp")`; runtime registration `UIPageBootstrap.register(UIID.Research, ResearchViewComp)`.

- [ ] **Step 1: Extend integration checks for dedicated page behavior**

Require four literal branch IDs/labels, exactly three queue-slot render iterations, `startResearch(this.selectedNodeId, Date.now())` inside a non-empty primary action handler, countdown formatting, and `UIRuntime` registration to `ResearchViewComp` rather than `FeaturePageViewComp`.

- [ ] **Step 2: Run the UI binding check and confirm RED**

Run: `node --test tests/integration/ui/ResearchFlowBindings.test.mjs`

Expected: FAIL because `ResearchViewComp.ts` does not exist and registration remains generic.

- [ ] **Step 3: Implement the dedicated page shell and branch selection**

Build the backdrop/header using the existing feature-page dimensions. Keep `BtnBack`, render the four category buttons, and rebuild only the research page's own child nodes when selection or state changes.

- [ ] **Step 4: Implement node cards, details, command feedback, and queue slots**

Render status-specific colors/text for `locked`, `available`, `queued`, `researching`, and `completed`. Map every `StartResearchResult.reason` to a concise Chinese message. The button is bound through `GamePage.bindTouch`; no direct `Node.on` remains untracked.

- [ ] **Step 5: Implement second-boundary refresh and completion refresh**

Store the last rendered integer second and a queue/completion signature. In `update`, call `snapshot(Date.now())` only when the displayed second changes, and rebuild when the signature changes. Do not schedule timers.

- [ ] **Step 6: Register the component and add Cocos metadata**

Replace only the Research registration. Generate unique UUIDs for new `.meta` files using PowerShell `[guid]::NewGuid().ToString()` and follow the existing `typescript`/directory meta schemas.

- [ ] **Step 7: Run UI and research tests and confirm GREEN**

Run: `node --test tests/integration/ui/ResearchFlowBindings.test.mjs tests/unit/research/*.test.mjs`

Expected: all selected tests PASS.

- [ ] **Step 8: Commit page slice**

```powershell
git add -- assets/script/game/research assets/script/game/common/ui/UIRuntime.ts tests/integration/ui/ResearchFlowBindings.test.mjs
git commit -m "feat: build interactive research progression page"
```

### Task 6: Full verification and manual Cocos smoke checklist

**Files:**
- Modify only if verification exposes an in-scope defect.

**Interfaces:**
- Consumes all previous tasks.
- Produces fresh verification evidence.

- [ ] **Step 1: Type-check the project**

Run: `npx tsc --noEmit`

Expected: exit `0` with no TypeScript errors.

- [ ] **Step 2: Run the full battle suite**

Run: `npm run test:battle`

Expected: exit `0`, zero failing tests.

- [ ] **Step 3: Run the full UI suite**

Run: `npm run test:ui`

Expected: exit `0`, zero failing tests.

- [ ] **Step 4: Inspect the final scoped diff**

Run: `git diff --check HEAD~4..HEAD` and `git status --short`

Expected: no whitespace errors; pre-existing unrelated modifications remain unstaged and unchanged.

- [ ] **Step 5: Manual Creator smoke test when the editor is available**

Open `main`, enter Research, enqueue a 20-second node, return to Hall, reopen Research, close/reopen the preview, wait through completion, then enter Battle and verify the affected displayed stat. Record explicitly if Creator execution is unavailable; automated evidence does not substitute for this manual engine check.
