# 工坊耗时制造队列 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现可选择配方、原子扣料、三槽并行计时、跨重启离线推进和自动入库的可玩工坊页面。

**Architecture:** 规则代码放在 `bag/workshop` 下，不导入 Cocos；`WorkshopService` 持有库存与队列，并通过可注入仓库原子保存快照。Cocos 运行时只负责绑定 `sys.localStorage`、派发 Oops 事件和渲染专用 `WorkshopViewComp`。

**Tech Stack:** TypeScript、Node.js 24 `node:test`、Cocos Creator 3.8.8、Oops Framework、`sys.localStorage`。

## Global Constraints

- 制造队列固定为三个并行槽。
- 队列跨页面和跨重启持续，使用 Unix 毫秒结束时间补算离线进度。
- 制造开始前同时验证解锁、材料、槽位和产物容量；失败不得改变库存。
- 新存档初始材料只发放一次：废料 120、机械零件 45、合金 60、电子元件 30、医疗物资 20。
- 六个首章配方及其耗时严格使用设计规格中的数值。
- 不实现强化、改装、拆解、装备穿戴或战斗掉落接入。
- 只改动本功能文件；保留工作区已有的战斗、怪物、世界和 `GameEvent` 改动。

---

## File Structure

- Create: `assets/script/game/bag/workshop/WorkshopTypes.ts` — 快照、配方、任务和结果类型。
- Create: `assets/script/game/bag/workshop/WorkshopCatalog.ts` — 物品定义、六个配方、初始材料。
- Create: `assets/script/game/bag/workshop/Inventory.ts` — 堆叠、容量、增减与快照规则。
- Create: `assets/script/game/bag/workshop/WorkshopService.ts` — 原子入队、三槽计时、离线同步与修复。
- Create: `assets/script/game/bag/workshop/WorkshopRepository.ts` — 仓库接口、内存仓库和本地存储适配器。
- Create: `assets/script/game/bag/WorkshopRuntime.ts` — Cocos/Oops 单例绑定和事件派发。
- Modify: `assets/script/game/bag/BagModule.ts` — 向后续系统暴露同一库存和制造服务。
- Create: `assets/script/game/ui/WorkshopViewComp.ts` — 专用可交互工坊页面。
- Modify: `assets/script/game/common/ui/UIRuntime.ts` — 将 Workshop 路由改绑专用组件。
- Modify: `assets/script/game/common/config/GameEvent.ts` — 追加三个工坊事件，保留已有尸潮事件。
- Modify: `package.json` — 新增工坊测试脚本并纳入 UI 测试。
- Create: `tests/unit/bag/Inventory.test.mjs` — 库存行为测试。
- Create: `tests/unit/bag/WorkshopService.test.mjs` — 队列、离线和持久化测试。
- Create: `tests/integration/ui/WorkshopBindings.test.mjs` — 页面绑定和 UI 合约测试。
- Modify: `tests/integration/ui/UIViewBindings.test.mjs` — Workshop 的专用控制器期望。

### Task 1: 库存与配方目录

**Files:**
- Create: `assets/script/game/bag/workshop/WorkshopTypes.ts`
- Create: `assets/script/game/bag/workshop/WorkshopCatalog.ts`
- Create: `assets/script/game/bag/workshop/Inventory.ts`
- Test: `tests/unit/bag/Inventory.test.mjs`

**Interfaces:**
- Produces: `ItemDefinition`, `WorkshopRecipe`, `InventorySnapshot`, `Inventory.count(id)`, `Inventory.add(id, amount)`, `Inventory.remove(id, amount)`, `Inventory.canFit(additions)`, `Inventory.toSnapshot()`。
- Produces: `ITEM_DEFINITIONS`, `WORKSHOP_RECIPES`, `STARTER_INVENTORY`。

- [ ] **Step 1: Write the failing inventory tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { Inventory } from "../../../assets/script/game/bag/workshop/Inventory.ts";
import { ITEM_DEFINITIONS } from "../../../assets/script/game/bag/workshop/WorkshopCatalog.ts";

test("inventory stacks materials and counts occupied slots", () => {
    const inventory = new Inventory(3, ITEM_DEFINITIONS);
    assert.equal(inventory.add("scrap", 100), true);
    assert.equal(inventory.usedSlots, 2);
    assert.equal(inventory.count("scrap"), 100);
});

test("failed additions and removals leave the inventory unchanged", () => {
    const inventory = new Inventory(1, ITEM_DEFINITIONS, { scrap: 99 });
    assert.equal(inventory.add("assault_rifle", 1), false);
    assert.equal(inventory.remove("scrap", 100), false);
    assert.deepEqual(inventory.toSnapshot(), { scrap: 99 });
});

test("capacity simulation includes queued output reservations", () => {
    const inventory = new Inventory(2, ITEM_DEFINITIONS, { scrap: 99 });
    assert.equal(inventory.canFit({ assault_rifle: 1 }), true);
    assert.equal(inventory.canFit({ assault_rifle: 1, shotgun: 1 }), false);
    assert.deepEqual(inventory.toSnapshot(), { scrap: 99 });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/bag/Inventory.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `Inventory.ts`.

- [ ] **Step 3: Implement types, exact catalog data, and Inventory**

Define these public shapes in `WorkshopTypes.ts`:

```ts
export type WorkshopCategory = "weapon" | "armor" | "module" | "supply";
export interface ItemDefinition { id: string; name: string; icon: string; maxStack: number; }
export interface RecipeInput { itemId: string; amount: number; }
export interface WorkshopRecipe {
    id: string; name: string; category: WorkshopCategory; icon: string;
    inputs: readonly RecipeInput[]; outputId: string; outputAmount: number;
    durationMs: number; requiredWorkshopLevel: number;
}
export type InventorySnapshot = Record<string, number>;
```

Populate `WorkshopCatalog.ts` with exact recipe IDs and durations:

```ts
export const STARTER_INVENTORY = { scrap: 120, mechanical_parts: 45, alloy: 60, electronics: 30, medical_supplies: 20 };
export const WORKSHOP_RECIPES = [
  { id: "assault_rifle", name: "突击步枪", category: "weapon", inputs: [{ itemId: "scrap", amount: 30 }, { itemId: "mechanical_parts", amount: 20 }, { itemId: "electronics", amount: 5 }], outputId: "assault_rifle", outputAmount: 1, durationMs: 45_000, requiredWorkshopLevel: 1 },
  { id: "shotgun", name: "霰弹枪", category: "weapon", inputs: [{ itemId: "scrap", amount: 35 }, { itemId: "mechanical_parts", amount: 25 }, { itemId: "alloy", amount: 10 }], outputId: "shotgun", outputAmount: 1, durationMs: 60_000, requiredWorkshopLevel: 1 },
  { id: "armor_plate", name: "装甲板", category: "armor", inputs: [{ itemId: "scrap", amount: 25 }, { itemId: "alloy", amount: 20 }], outputId: "armor_plate", outputAmount: 1, durationMs: 50_000, requiredWorkshopLevel: 1 },
  { id: "machine_turret", name: "机枪塔模块", category: "module", inputs: [{ itemId: "scrap", amount: 40 }, { itemId: "mechanical_parts", amount: 30 }, { itemId: "electronics", amount: 15 }, { itemId: "alloy", amount: 15 }], outputId: "machine_turret", outputAmount: 1, durationMs: 90_000, requiredWorkshopLevel: 1 },
  { id: "medkit", name: "医疗包", category: "supply", inputs: [{ itemId: "medical_supplies", amount: 8 }, { itemId: "scrap", amount: 3 }], outputId: "medkit", outputAmount: 1, durationMs: 25_000, requiredWorkshopLevel: 1 },
  { id: "energy_cell", name: "能源电池", category: "supply", inputs: [{ itemId: "scrap", amount: 8 }, { itemId: "electronics", amount: 6 }, { itemId: "alloy", amount: 4 }], outputId: "energy_cell", outputAmount: 1, durationMs: 30_000, requiredWorkshopLevel: 1 },
] as const;
```

Use max stack 99 for five materials, 10 for `medkit` and `energy_cell`, and 1 for weapon/armor/module outputs. Use existing icon paths only: `resources-items/01-scrap`, `resources-items/02-alloy`, `resources-items/04-energy-cell`, `system-nav/03-workshop`, `hud-combat/01-health`, and `system-nav/06-storage`.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/unit/bag/Inventory.test.mjs`

Expected: 3 tests PASS.

- [ ] **Step 5: Commit the inventory slice**

```powershell
git add -- assets/script/game/bag/workshop/WorkshopTypes.ts assets/script/game/bag/workshop/WorkshopCatalog.ts assets/script/game/bag/workshop/Inventory.ts tests/unit/bag/Inventory.test.mjs
git commit -m "feat: add workshop inventory and recipe catalog"
```

### Task 2: 原子制造队列与离线推进

**Files:**
- Modify: `assets/script/game/bag/workshop/WorkshopTypes.ts`
- Create: `assets/script/game/bag/workshop/WorkshopRepository.ts`
- Create: `assets/script/game/bag/workshop/WorkshopService.ts`
- Test: `tests/unit/bag/WorkshopService.test.mjs`

**Interfaces:**
- Consumes: `Inventory`, `ITEM_DEFINITIONS`, `WORKSHOP_RECIPES`, `STARTER_INVENTORY`。
- Produces: `WorkshopTask`, `WorkshopSnapshot`, `WorkshopRepository`, `MemoryWorkshopRepository`。
- Produces: `WorkshopService.enqueue(recipeId, now)`, `sync(now)`, `getTasks()`, `getRecipeAvailability(recipeId)`, `inventory`。

- [ ] **Step 1: Write failing queue tests**

Use a fixed `now = 1_000_000`, deterministic IDs `task-1`, `task-2`, and `MemoryWorkshopRepository`. Tests must assert literal material counts and task end times. Include these independent cases:

```js
test("enqueue atomically consumes materials and creates a timed task", () => {
    const service = makeService();
    const result = service.enqueue("assault_rifle", 1_000_000);
    assert.equal(result.ok, true);
    assert.equal(service.inventory.count("scrap"), 90);
    assert.equal(service.inventory.count("mechanical_parts"), 25);
    assert.equal(service.getTasks()[0].endsAt, 1_045_000);
});

test("a fourth task is rejected without consuming materials", () => {
    const service = makeService({ scrap: 500, medical_supplies: 100 });
    service.enqueue("medkit", 1_000_000);
    service.enqueue("medkit", 1_000_000);
    service.enqueue("medkit", 1_000_000);
    const before = service.inventory.toSnapshot();
    assert.deepEqual(service.enqueue("medkit", 1_000_000), { ok: false, reason: "queue-full" });
    assert.deepEqual(service.inventory.toSnapshot(), before);
});

test("offline sync grants a completed output exactly once", () => {
    const repository = new MemoryWorkshopRepository();
    const first = makeService(undefined, repository);
    first.enqueue("assault_rifle", 1_000_000);
    const restarted = makeService(undefined, repository);
    assert.deepEqual(restarted.sync(1_045_000).completedRecipeIds, ["assault_rifle"]);
    assert.equal(restarted.inventory.count("assault_rifle"), 1);
    assert.deepEqual(restarted.sync(2_000_000).completedRecipeIds, []);
    assert.equal(restarted.inventory.count("assault_rifle"), 1);
});
```

Also add cases for `materials-missing`, `output-full`, one-time starter inventory, save failure rollback, system clock rollback clamping, invalid negative snapshot quantities, and an unknown recipe task remaining `ready` without generating an item.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/bag/WorkshopService.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `WorkshopService.ts`.

- [ ] **Step 3: Implement repository and service**

Add these result contracts:

```ts
export type EnqueueFailure = "recipe-missing" | "recipe-locked" | "materials-missing" | "queue-full" | "output-full" | "save-failed";
export type EnqueueResult = { ok: true; task: WorkshopTask } | { ok: false; reason: EnqueueFailure };
export interface WorkshopTask { id: string; recipeId: string; startedAt: number; endsAt: number; status: "crafting" | "ready"; }
export interface WorkshopSnapshot { version: 1; initialized: boolean; workshopLevel: number; inventory: InventorySnapshot; tasks: WorkshopTask[]; }
export interface WorkshopRepository { load(): WorkshopSnapshot | null; save(snapshot: WorkshopSnapshot): void; }
```

`WorkshopService.enqueue` snapshots memory first, validates the queue and recipe, aggregates material requirements, calls `inventory.canFit()` with every queued output plus the new output, removes materials, appends the task, then saves. Catching a save error restores the exact pre-operation snapshot and returns `save-failed`.

`sync(now)` clamps effective time to at least each task's `startedAt` and no later than the supplied timestamp, completes due known recipes, removes successfully claimed tasks, and saves once. If saving fails, restore the pre-sync state and return no completions. Unknown recipe tasks become `ready` and remain in the queue.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `node --test tests/unit/bag/Inventory.test.mjs tests/unit/bag/WorkshopService.test.mjs`

Expected: all bag tests PASS.

- [ ] **Step 5: Commit the domain slice**

```powershell
git add -- assets/script/game/bag/workshop tests/unit/bag
git commit -m "feat: add persistent timed crafting queue"
```

### Task 3: Cocos 持久化运行时与事件

**Files:**
- Modify: `assets/script/game/bag/workshop/WorkshopRepository.ts`
- Create: `assets/script/game/bag/WorkshopRuntime.ts`
- Modify: `assets/script/game/bag/BagModule.ts`
- Modify: `assets/script/game/common/config/GameEvent.ts`
- Test: `tests/unit/bag/WorkshopRepository.test.mjs`

**Interfaces:**
- Produces: `KeyValueStore`, `LocalStorageWorkshopRepository`, `workshopRuntime`。
- Produces: `BagModule.inventory`, `BagModule.workshop`, `BagModule.addItem(id, amount)`。
- Appends: `GameEvent.InventoryChanged`, `GameEvent.WorkshopQueueChanged`, `GameEvent.CraftCompleted`。

- [ ] **Step 1: Write failing persistence tests**

Create a fake key-value store and verify:

```js
test("local repository round-trips a versioned snapshot", () => {
    const store = new MapStore();
    const repository = new LocalStorageWorkshopRepository(store);
    repository.save({ version: 1, initialized: true, workshopLevel: 1, inventory: { scrap: 7 }, tasks: [] });
    assert.deepEqual(repository.load(), { version: 1, initialized: true, workshopLevel: 1, inventory: { scrap: 7 }, tasks: [] });
});

test("corrupt JSON keeps the separate initialized marker", () => {
    const store = new MapStore({ "infinite-evolution.workshop.v1": "{bad", "infinite-evolution.workshop.initialized": "1" });
    assert.deepEqual(new LocalStorageWorkshopRepository(store).load(), {
        version: 1, initialized: true, workshopLevel: 1, inventory: {}, tasks: [],
    });
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/bag/WorkshopRepository.test.mjs`

Expected: FAIL because `LocalStorageWorkshopRepository` is not exported.

- [ ] **Step 3: Implement runtime bindings**

Define `KeyValueStore` with `getItem`, `setItem`, and `removeItem`. `LocalStorageWorkshopRepository.save` writes the JSON snapshot then sets `infinite-evolution.workshop.initialized` to `1`. Its `load` repairs invalid JSON into an empty, already-initialized snapshot when the marker exists.

Create `WorkshopRuntime` with methods `enqueue(recipeId)`, `sync()`, and `addItem(id, amount)`. After successful changes, dispatch the three new `GameEvent` values through `oops.message.dispatchEvent`. Construct the exported singleton with `sys.localStorage`, `Date.now`, and a task ID factory based on timestamp plus an incrementing counter.

Modify `BagModule` to delegate to `workshopRuntime` rather than creating a second inventory.

- [ ] **Step 4: Run tests and TypeScript validation**

Run: `node --test tests/unit/bag/*.test.mjs`

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: bag tests PASS; TypeScript exits 0.

- [ ] **Step 5: Commit the runtime slice without staging unrelated GameEvent changes**

Use `git diff -- assets/script/game/common/config/GameEvent.ts` to verify the existing `HordeWarning`, `HordeWaveChanged`, and `NightCompleted` entries remain. Then stage only the intended files:

```powershell
git add -- assets/script/game/bag assets/script/game/common/config/GameEvent.ts tests/unit/bag/WorkshopRepository.test.mjs
git commit -m "feat: persist workshop state and publish events"
```

### Task 4: 专用工坊页面

**Files:**
- Create: `assets/script/game/ui/WorkshopViewComp.ts`
- Modify: `assets/script/game/common/ui/UIRuntime.ts`
- Modify: `tests/integration/ui/UIViewBindings.test.mjs`
- Create: `tests/integration/ui/WorkshopBindings.test.mjs`

**Interfaces:**
- Consumes: `workshopRuntime`, `WORKSHOP_RECIPES`, `WorkshopCategory`, `UIBuilder`, `UI_THEME`, `uiNavigation`。
- Produces: `WorkshopViewComp` registered only for `UIID.Workshop`。

- [ ] **Step 1: Write failing UI contract tests**

```js
test("runtime registers the dedicated workshop controller", () => {
    const source = readFileSync("assets/script/game/common/ui/UIRuntime.ts", "utf8");
    assert.match(source, /UIPageBootstrap\.register\(UIID\.Workshop, WorkshopViewComp\)/);
    assert.doesNotMatch(source, /register\(UIID\.Workshop, FeaturePageViewComp\)/);
});

test("workshop exposes recipe selection, three queue slots, and a working primary action", () => {
    const source = readFileSync("assets/script/game/ui/WorkshopViewComp.ts", "utf8");
    for (const marker of ["CategoryRail", "RecipeList", "RecipePreview", "MaterialRequirements", "QueueSlot0", "QueueSlot1", "QueueSlot2", "BtnPrimaryAction"]) {
        assert.match(source, new RegExp(marker), marker);
    }
    assert.match(source, /workshopRuntime\.enqueue/);
    assert.match(source, /workshopRuntime\.sync/);
    assert.match(source, /uiNavigation\.back\(\)/);
});
```

Update the existing `UIViewBindings` controller test so Equipment, ArkBuild, Research, Crew and Intel still bind `FeaturePageViewComp`, while Workshop binds `WorkshopViewComp`.

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/integration/ui/WorkshopBindings.test.mjs tests/integration/ui/UIViewBindings.test.mjs`

Expected: FAIL because `WorkshopViewComp.ts` and its registration do not exist.

- [ ] **Step 3: Implement the dedicated view**

Render the existing three-column visual language with these exact interactive states:

- Four category buttons update `selectedCategory` and select the first recipe in that category.
- Recipe cards update `selectedRecipeId`.
- Material rows display `拥有 / 需要`; insufficient rows use `UI_THEME.colors.orange`.
- `primaryActionText()` returns `开始制造`, `材料不足`, `队列已满`, `仓库空间不足`, or `配方未解锁` from `getRecipeAvailability`.
- Touching an unavailable primary button displays an Oops toast and changes nothing.
- Touching an available button calls `workshopRuntime.enqueue(selectedRecipeId)`, then rerenders.
- Three named queue slots always render. Active slots show recipe name and `MM:SS`; ready slots show `待领取`; empty slots show `空队列`.
- `update(deltaTime)` accumulates elapsed seconds and every 0.25 seconds calls `workshopRuntime.sync()`. Rerender only when completion changes state; otherwise update the retained queue `Label` strings.
- Before a full rerender call `clearBindings()` so destroyed button bindings do not accumulate.

- [ ] **Step 4: Run UI and type checks**

Run: `node --test tests/integration/ui/WorkshopBindings.test.mjs tests/integration/ui/UIViewBindings.test.mjs tests/integration/ui/UIVisualComposition.test.mjs`

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: all selected tests PASS; TypeScript exits 0.

- [ ] **Step 5: Commit the UI slice**

```powershell
git add -- assets/script/game/ui/WorkshopViewComp.ts assets/script/game/common/ui/UIRuntime.ts tests/integration/ui/WorkshopBindings.test.mjs tests/integration/ui/UIViewBindings.test.mjs
git commit -m "feat: make workshop crafting interactive"
```

### Task 5: 项目脚本、回归与验收

**Files:**
- Modify: `package.json`
- Test: all workshop, UI, combat and world suites.

**Interfaces:**
- Produces: `npm run test:workshop` and includes workshop integration tests in `test:ui`。

- [ ] **Step 1: Add package scripts**

Set:

```json
"test:workshop": "node --test tests/unit/bag/*.test.mjs tests/integration/ui/WorkshopBindings.test.mjs",
"test:ui": "node --test tests/unit/ui/*.test.mjs tests/unit/battle/*.test.mjs tests/integration/ui/*.test.mjs"
```

Preserve the user's current `test:battle` script exactly.

- [ ] **Step 2: Run focused workshop verification**

Run: `npm run test:workshop`

Expected: all inventory, repository, service and workshop binding tests PASS with no warnings.

- [ ] **Step 3: Run full automated regression**

Run: `npm run test:ui`

Run: `npm run test:battle`

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: every command exits 0.

- [ ] **Step 4: Inspect the final diff for scope and generated metadata needs**

Run: `git status --short` and `git diff --check`.

Confirm no unrelated dirty file is staged or overwritten. Cocos will generate `.meta` files for new TypeScript files when the project is next opened; do not invent UUID-bearing metadata by hand.

- [ ] **Step 5: Commit package script only if it is not entangled with user changes**

If `package.json` contains only the existing user test-script edit plus the workshop script, preserve both and commit the file with the feature. If the user's edit is unrelated and cannot be separated safely, leave `package.json` uncommitted and report it explicitly.

```powershell
git add -- package.json
git commit -m "test: add workshop crafting regression suite"
```

## Completion Gate

- The primary action no longer binds to an empty callback.
- A new save can enqueue at least three recipes, close and reopen the page, and retain remaining time.
- Reconstructing the service from the same repository after `endsAt` grants each output once.
- All failure branches preserve materials and queued tasks.
- All focused and full automated checks pass.
- Existing user changes remain present and are not silently staged with workshop-only commits.
