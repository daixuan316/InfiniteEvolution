# 情报目标与探索引导纵向闭环 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将静态情报占位页改为“选择真实地图目标—大厅校验—战斗追踪—抵达反馈”的可玩闭环。

**Architecture:** `IntelCatalog` 从现有医院城区定义稳定目标、事件和尸潮预报，`IntelRuntime` 只保存当前会话目标。专用 `IntelPageViewComp` 负责四个标签与目标选择；大厅读取会话状态并把 `targetId` 传给 `BattleHUDViewComp`，战斗页解析目标并在 HUD 与地图中追踪。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Oops Framework、Node.js `node:test`

## Global Constraints

- 保留工作区中所有既有未提交改动，尤其是战斗交互、尸潮、布局和事件改动；所有补丁基于最新文件追加，不回退或覆盖已有实现。
- 正常流程未选择目标不得进入战斗；开发直开战斗页时安全回退到 `hospital`。
- 隐藏缓存事件不得暴露具体坐标。
- 抵达目标只产生一次反馈和事件，不自动发放奖励。
- 不引入新依赖，不实现跨启动存档、随机情报刷新、情报货币或完整任务结算。
- 所有纯规则生产代码先写失败测试并观察预期失败。
- 当前工作区存在他人改动，不自动提交包含既有改动的共享文件；每个任务以测试通过和 `git diff --check` 作为检查点。

---

## File Structure

新增文件：

- `assets/script/game/intel/model/IntelCatalog.ts`：目标、事件、尸潮预报以及距离/抵达纯函数。
- `assets/script/game/intel/model/IntelRuntime.ts`：当前会话的目标选择状态。
- `assets/script/game/intel/IntelPageViewComp.ts`：专用情报页面和四标签交互。
- `tests/unit/intel/IntelCatalog.test.mjs`：目录与地图一致性、距离和抵达边界。
- `tests/unit/intel/IntelRuntime.test.mjs`：合法选择、非法选择和清理行为。

修改文件：

- `assets/script/game/common/config/GameEvent.ts`：追加目标变化和抵达事件。
- `assets/script/game/common/ui/UIRuntime.ts`：将 `UIID.Intel` 注册到专用页面。
- `assets/script/game/ui/FeaturePageViewComp.ts`：移除 Intel 通用视觉配置。
- `assets/script/game/common/ui/UIDemoData.ts`：移除 Intel 演示数据。
- `assets/script/game/hall/HallViewComp.ts`：目标摘要和出发前置校验。
- `assets/script/game/battle/BattleHUDViewComp.ts`：目标参数、文案、距离、地图高亮和一次性抵达。
- `tests/integration/ui/UIViewBindings.test.mjs`：专用页面、标签和按钮绑定。
- `tests/integration/ui/UIVisualComposition.test.mjs`：情报页面结构与大厅目标摘要。
- `tests/integration/ui/BattleFlowBindings.test.mjs`：目标参数和抵达事件绑定。
- `package.json`：新增不覆盖现有 glob 的 `test:intel` 命令。

---

### Task 1: 情报目录与地图一致性

**Files:**
- Create: `tests/unit/intel/IntelCatalog.test.mjs`
- Create: `assets/script/game/intel/model/IntelCatalog.ts`

**Interfaces:**
- Consumes: `createHospitalDistrictMap(): BattleMapDefinition`、`GridPoint`、`WorldPoint`。
- Produces: `IntelTargetId`、`IntelTargetDefinition`、`INTEL_TARGETS`、`INTEL_EVENTS`、`NEXT_HORDE_FORECAST`、`findIntelTarget(id)`、`intelTargetDistanceMeters(target, map)`、`intelTargetWorldPoint(target, map)`、`isIntelTargetReached(target, player, map, radius?)`。

- [ ] **Step 1: Write the failing catalog test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { createHospitalDistrictMap } from "../../../assets/script/game/battle/BattleMapModel.ts";
import {
  INTEL_EVENTS, INTEL_TARGETS, findIntelTarget,
  intelTargetDistanceMeters, intelTargetWorldPoint, isIntelTargetReached,
} from "../../../assets/script/game/intel/model/IntelCatalog.ts";

test("intel targets map one-to-one to playable hospital district POIs", () => {
  const map = createHospitalDistrictMap();
  assert.deepEqual(INTEL_TARGETS.map(x => x.id), ["hospital", "depot", "signal"]);
  assert.equal(new Set(INTEL_TARGETS.map(x => x.id)).size, INTEL_TARGETS.length);
  for (const target of INTEL_TARGETS) {
    const poi = map.pointsOfInterest.find(x => x.id === target.id);
    assert.ok(poi);
    assert.deepEqual(target.cell, poi.cell);
    assert.equal(map.isWalkable(target.cell), true);
    assert.ok(target.rewardLabels.length > 0);
    assert.ok(target.estimatedMinutes > 0);
  }
});

test("target distance and arrival use the same map world point", () => {
  const map = createHospitalDistrictMap();
  const target = findIntelTarget("depot");
  assert.ok(target);
  const point = intelTargetWorldPoint(target, map);
  assert.ok(intelTargetDistanceMeters(target, map) > 0);
  assert.equal(isIntelTargetReached(target, point, map), true);
  assert.equal(isIntelTargetReached(target, { x: point.x + 181, y: point.y }, map), false);
});

test("hidden cache event never exposes a map cell", () => {
  const hidden = INTEL_EVENTS.find(x => x.id === "hidden-cache");
  assert.ok(hidden);
  assert.equal("cell" in hidden, false);
  assert.equal(hidden.status, "undetected");
});
```

- [ ] **Step 2: Run the catalog test and verify RED**

Run: `node --test tests/unit/intel/IntelCatalog.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `IntelCatalog.ts`.

- [ ] **Step 3: Implement the minimal catalog**

```ts
import type { BattleMapDefinition, GridPoint, WorldPoint } from "../../battle/BattleMapModel";

export type IntelTargetId = "hospital" | "depot" | "signal";
export type IntelRisk = "low" | "medium" | "high";

export interface IntelTargetDefinition {
  readonly id: IntelTargetId;
  readonly locationName: string;
  readonly objectiveTitle: string;
  readonly summary: string;
  readonly risk: IntelRisk;
  readonly rewardLabels: readonly string[];
  readonly estimatedMinutes: number;
  readonly cell: GridPoint;
}

export const INTEL_TARGETS: readonly IntelTargetDefinition[] = [
  { id: "hospital", locationName: "战地医院", objectiveTitle: "搜索医疗补给", summary: "清理医院外围并调查医疗终端。", risk: "medium", rewardLabels: ["医疗物资", "医疗终端"], estimatedMinutes: 3, cell: { x: 14, y: 12 } },
  { id: "depot", locationName: "物资仓库", objectiveTitle: "回收建造材料", summary: "突破仓库防线并回收补给箱。", risk: "high", rewardLabels: ["废料", "零件", "补给箱"], estimatedMinutes: 4, cell: { x: 24, y: 19 } },
  { id: "signal", locationName: "信号塔", objectiveTitle: "调查异常信号", summary: "抵达信号塔并确认求救信号来源。", risk: "high", rewardLabels: ["弹药", "零件", "情报"], estimatedMinutes: 5, cell: { x: 34, y: 3 } },
];

export const INTEL_EVENTS = [
  { id: "rescue-beacon", title: "求救信标", status: "known", detail: "现场可能存在幸存者与感染者。" },
  { id: "radar-terminal", title: "雷达终端", status: "known", detail: "调查后可揭示隐藏缓存。" },
  { id: "hidden-cache", title: "隐藏缓存点", status: "undetected", detail: "待雷达侦测，坐标未知。" },
] as const;

export const NEXT_HORDE_FORECAST = { threat: "中等", enemies: ["奔袭者", "巨力怪"], advice: "准备减速火力与高耐久路障。" } as const;
export function findIntelTarget(id: unknown): IntelTargetDefinition | null { return INTEL_TARGETS.find(x => x.id === id) ?? null; }
export function intelTargetWorldPoint(target: IntelTargetDefinition, map: BattleMapDefinition): WorldPoint { return map.cellToWorld(target.cell); }
export function intelTargetDistanceMeters(target: IntelTargetDefinition, map: BattleMapDefinition): number {
  const start = map.cellToWorld(map.start); const end = intelTargetWorldPoint(target, map);
  return Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 4);
}
export function isIntelTargetReached(target: IntelTargetDefinition, player: WorldPoint, map: BattleMapDefinition, radius = 180): boolean {
  const point = intelTargetWorldPoint(target, map); return Math.hypot(point.x - player.x, point.y - player.y) <= radius;
}
```

- [ ] **Step 4: Run the catalog test and verify GREEN**

Run: `node --test tests/unit/intel/IntelCatalog.test.mjs`

Expected: 3 tests PASS.

- [ ] **Step 5: Check the task diff**

Run: `git diff --check -- assets/script/game/intel/model/IntelCatalog.ts tests/unit/intel/IntelCatalog.test.mjs`

Expected: no output.

---

### Task 2: 当前会话目标状态

**Files:**
- Create: `tests/unit/intel/IntelRuntime.test.mjs`
- Create: `assets/script/game/intel/model/IntelRuntime.ts`

**Interfaces:**
- Consumes: `findIntelTarget(id)` and `IntelTargetDefinition` from Task 1.
- Produces: `IntelRuntime.selectTarget(id): boolean`、`selectedTargetId`、`selectedTarget`、`clear()`、shared `intelRuntime`.

- [ ] **Step 1: Write the failing runtime test**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { IntelRuntime } from "../../../assets/script/game/intel/model/IntelRuntime.ts";

test("runtime accepts known targets and resolves the full definition", () => {
  const runtime = new IntelRuntime();
  assert.equal(runtime.selectTarget("depot"), true);
  assert.equal(runtime.selectedTargetId, "depot");
  assert.equal(runtime.selectedTarget?.locationName, "物资仓库");
});

test("unknown targets do not overwrite the current selection", () => {
  const runtime = new IntelRuntime();
  runtime.selectTarget("hospital");
  assert.equal(runtime.selectTarget("missing"), false);
  assert.equal(runtime.selectedTargetId, "hospital");
  runtime.clear();
  assert.equal(runtime.selectedTarget, null);
});
```

- [ ] **Step 2: Run the runtime test and verify RED**

Run: `node --test tests/unit/intel/IntelRuntime.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `IntelRuntime.ts`.

- [ ] **Step 3: Implement the runtime**

```ts
import { findIntelTarget, type IntelTargetDefinition, type IntelTargetId } from "./IntelCatalog";

export class IntelRuntime {
  private targetId: IntelTargetId | null = null;
  get selectedTargetId(): IntelTargetId | null { return this.targetId; }
  get selectedTarget(): IntelTargetDefinition | null { return findIntelTarget(this.targetId); }
  selectTarget(id: unknown): boolean {
    const target = findIntelTarget(id); if (!target) return false;
    this.targetId = target.id; return true;
  }
  clear(): void { this.targetId = null; }
}
export const intelRuntime = new IntelRuntime();
```

- [ ] **Step 4: Run both Intel rule suites**

Run: `node --test tests/unit/intel/*.test.mjs`

Expected: 5 tests PASS.

- [ ] **Step 5: Check the task diff**

Run: `git diff --check -- assets/script/game/intel/model tests/unit/intel`

Expected: no output.

---

### Task 3: 专用情报页与四标签交互

**Files:**
- Create: `assets/script/game/intel/IntelPageViewComp.ts`
- Modify: `assets/script/game/common/config/GameEvent.ts`
- Modify: `assets/script/game/common/ui/UIRuntime.ts`
- Modify: `assets/script/game/ui/FeaturePageViewComp.ts`
- Modify: `assets/script/game/common/ui/UIDemoData.ts`
- Modify: `tests/integration/ui/UIViewBindings.test.mjs`
- Modify: `tests/integration/ui/UIVisualComposition.test.mjs`

**Interfaces:**
- Consumes: `INTEL_TARGETS`、`INTEL_EVENTS`、`NEXT_HORDE_FORECAST`、`intelRuntime`、`uiNavigation.back()`、`UIBuilder`.
- Produces: `IntelPageViewComp` and `GameEvent.IntelTargetChanged`.

- [ ] **Step 1: Add failing source-binding tests**

```js
test("Intel uses a dedicated interactive page", () => {
  const runtime = read("assets/script/game/common/ui/UIRuntime.ts");
  const page = read("assets/script/game/intel/IntelPageViewComp.ts");
  assert.match(runtime, /register\(UIID\.Intel, IntelPageViewComp\)/);
  for (const name of ["TabMap", "TabMission", "TabEvent", "TabHorde", "BtnSetTarget"]) assert.match(page, new RegExp(name));
  assert.match(page, /intelRuntime\.selectTarget/);
  assert.match(page, /GameEvent\.IntelTargetChanged/);
});
```

- [ ] **Step 2: Run UI integration tests and verify RED**

Run: `node --test tests/integration/ui/UIViewBindings.test.mjs tests/integration/ui/UIVisualComposition.test.mjs`

Expected: FAIL because `IntelPageViewComp.ts` does not exist and Intel is still registered to `FeaturePageViewComp`.

- [ ] **Step 3: Implement the dedicated page**

Implement `IntelPageViewComp` with local state:

```ts
type IntelTab = "map" | "mission" | "event" | "horde";
private activeTab: IntelTab = "map";
private previewTargetId: IntelTargetId | null = intelRuntime.selectedTargetId;
private contentRoot: Node | null = null;
```

`render()` creates the existing header and three-column frame. Each tab button calls `selectTab(tab)`, which updates `activeTab` and rerenders only `contentRoot`. Map and mission cards call `previewTarget(id)`. `BtnSetTarget` exists only for map/mission detail, rejects null preview with `oops.gui.toast("请先选择探索目标")`, otherwise calls `intelRuntime.selectTarget`, dispatches `GameEvent.IntelTargetChanged`, and awaits `uiNavigation.back()`.

Event cards render `INTEL_EVENTS`; horde renders `NEXT_HORDE_FORECAST`. The hidden-cache card displays only `detail`, never a cell. Use stable node names from the failing test.

- [ ] **Step 4: Register the page and remove duplicate demo sources**

Append to `GameEvent`:

```ts
IntelTargetChanged = "IntelTargetChanged",
IntelTargetReached = "IntelTargetReached",
```

Import/register `IntelPageViewComp` in `UIRuntime.ts`. Remove only the `[UIID.Intel]` entries from `FEATURE_VISUALS` and `FEATURE_DEMO_VIEW_MODELS`; preserve every other feature page.

- [ ] **Step 5: Run the UI binding tests and Intel rule tests**

Run: `node --test tests/unit/intel/*.test.mjs tests/integration/ui/UIViewBindings.test.mjs tests/integration/ui/UIVisualComposition.test.mjs`

Expected: all PASS.

- [ ] **Step 6: Check the shared-file diff**

Run: `git diff --check -- assets/script/game/intel assets/script/game/common/config/GameEvent.ts assets/script/game/common/ui/UIRuntime.ts assets/script/game/ui/FeaturePageViewComp.ts assets/script/game/common/ui/UIDemoData.ts tests/integration/ui`

Expected: no output; pre-existing horde events remain present.

---

### Task 4: 大厅目标摘要与出发门槛

**Files:**
- Modify: `assets/script/game/hall/HallViewComp.ts`
- Modify: `tests/integration/ui/UIViewBindings.test.mjs`
- Modify: `tests/integration/ui/UIVisualComposition.test.mjs`

**Interfaces:**
- Consumes: shared `intelRuntime`, `UIID.Intel`, `UIID.BattleHUD`, and navigation params.
- Produces: target summary nodes and guarded `depart()`.

- [ ] **Step 1: Add failing hall-flow assertions**

```js
test("Hall requires an Intel target before exploration", () => {
  const source = read("assets/script/game/hall/HallViewComp.ts");
  assert.match(source, /intelRuntime\.selectedTarget/);
  assert.match(source, /push\(UIID\.Intel\)/);
  assert.match(source, /replace\(UIID\.BattleHUD, \{ targetId: target\.id \}\)/);
  for (const name of ["IntelTargetSummary", "IntelTargetName", "IntelTargetRisk"]) assert.match(source, new RegExp(name));
});
```

- [ ] **Step 2: Run the hall tests and verify RED**

Run: `node --test tests/integration/ui/UIViewBindings.test.mjs tests/integration/ui/UIVisualComposition.test.mjs`

Expected: FAIL because the hall does not read `intelRuntime` or pass `targetId`.

- [ ] **Step 3: Render the target summary**

In `renderArkOverview`, create `IntelTargetSummary`. If no target, render “尚未选择探索目标” and “前往情报页规划路线”; otherwise render `target.locationName`, risk label and joined reward labels. Because Hall is recreated when navigating back, no persistent message subscription is required.

- [ ] **Step 4: Guard departure and pass the target**

```ts
private async depart(): Promise<void> {
  const target = intelRuntime.selectedTarget;
  if (!target) {
    oops.gui.toast("请先在情报中选择探索目标");
    await uiNavigation.push(UIID.Intel);
    return;
  }
  if (await uiNavigation.replace(UIID.BattleHUD, { targetId: target.id })) {
    oops.message.dispatchEvent(GameEvent.EnterBattle, target.id);
  }
}
```

- [ ] **Step 5: Run hall and navigation regression tests**

Run: `node --test tests/unit/ui/UINavigationService.test.mjs tests/integration/ui/UIViewBindings.test.mjs tests/integration/ui/UIVisualComposition.test.mjs`

Expected: all PASS.

- [ ] **Step 6: Check the task diff**

Run: `git diff --check -- assets/script/game/hall/HallViewComp.ts tests/integration/ui`

Expected: no output.

---

### Task 5: 战斗目标追踪、地图高亮与一次性抵达

**Files:**
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Modify: `tests/integration/ui/BattleFlowBindings.test.mjs`

**Interfaces:**
- Consumes: page `params.targetId`, `findIntelTarget`, `intelTargetWorldPoint`, `isIntelTargetReached`, and `GameEvent.IntelTargetReached`.
- Produces: selected target objective text, target distance, minimap/full-map highlight, and one-shot arrival state.

- [ ] **Step 1: Add failing battle binding assertions**

```js
test("Battle HUD consumes and tracks the selected Intel target", () => {
  const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
  assert.match(source, /findIntelTarget\(this\.params\.targetId\)/);
  assert.match(source, /\?\? findIntelTarget\("hospital"\)/);
  assert.match(source, /isIntelTargetReached/);
  assert.match(source, /GameEvent\.IntelTargetReached/);
  assert.match(source, /TargetMarker/);
  assert.match(source, /targetReached/);
});
```

- [ ] **Step 2: Run the battle binding test and verify RED**

Run: `node --test tests/integration/ui/BattleFlowBindings.test.mjs`

Expected: FAIL because `BattleHUDViewComp` does not consume `targetId`.

- [ ] **Step 3: Resolve the target after page configuration**

Add fields:

```ts
private target!: IntelTargetDefinition;
private objectiveLabel!: Label;
private targetReached = false;
private targetNoticeShown = false;
```

At the start of `onLoad`, before `render()`:

```ts
this.target = findIntelTarget(this.params.targetId) ?? findIntelTarget("hospital")!;
```

This keeps direct battle-page development compatible without mutating `intelRuntime`.

- [ ] **Step 4: Bind objective, distance, and arrival**

Store the objective label in `renderObjective()` and render `当前目标 · ${target.objectiveTitle} · ${target.locationName}`. Replace the target-independent distance update with target distance while tracking. During `update()` call `syncIntelTarget()` after actor positions update:

```ts
private syncIntelTarget(): void {
  const point = intelTargetWorldPoint(this.target, this.map);
  const distance = Math.ceil(Math.hypot(point.x - this.simulation.player.x, point.y - this.simulation.player.y) / 4);
  this.distanceLabel.string = this.targetReached ? "目标 · 已抵达" : `目标 ${distance}m`;
  if (this.targetReached || !isIntelTargetReached(this.target, this.simulation.player, this.map)) return;
  this.targetReached = true;
  this.objectiveLabel.string = `已抵达 · ${this.target.locationName}  |  完成现场搜索后撤离`;
  oops.message.dispatchEvent(GameEvent.IntelTargetReached, this.target.id);
  this.showTargetArrivalNotice();
}
```

`showTargetArrivalNotice()` reuses the existing exploration notice panel introduced by current worktree changes, sets a unique local notice ID, and never awards resources.

- [ ] **Step 5: Draw the selected target marker**

In both static/dynamic map drawing paths, convert `intelTargetWorldPoint(this.target, this.map)` through `mapPosition`. Draw an orange ring/diamond named by the containing `TargetMarker` node on the full map, and a compact orange ring on the minimap. Keep existing POI, loot, exploration, player, enemy, route and barrier drawing intact.

- [ ] **Step 6: Run battle and Intel regressions**

Run: `node --test tests/unit/intel/*.test.mjs tests/unit/battle/*.test.mjs tests/integration/ui/BattleFlowBindings.test.mjs`

Expected: all PASS.

- [ ] **Step 7: Check the shared battle diff**

Run: `git diff --check -- assets/script/game/battle/BattleHUDViewComp.ts tests/integration/ui/BattleFlowBindings.test.mjs`

Expected: no output; existing exploration objects, horde phases, vitality UI and barrier behavior remain in the diff.

---

### Task 6: Test command and full verification

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: all test files from Tasks 1–5.
- Produces: `npm run test:intel`.

- [ ] **Step 1: Add the Intel test command without changing existing commands**

```json
"test:intel": "node --test tests/unit/intel/*.test.mjs tests/integration/ui/*.test.mjs"
```

Preserve the existing `test:battle` command including its current `tests/unit/monster/*.test.mjs` glob, and preserve `test:ui` unchanged.

- [ ] **Step 2: Run the focused feature suite**

Run: `npm run test:intel`

Expected: all Intel and UI integration tests PASS.

- [ ] **Step 3: Run battle regression**

Run: `npm run test:battle`

Expected: all combat, shelter, battle, monster and world tests PASS.

- [ ] **Step 4: Run UI regression**

Run: `npm run test:ui`

Expected: all UI and battle tests PASS.

- [ ] **Step 5: Run TypeScript compilation**

Run: `npx tsc --noEmit`

Expected: exit code 0 with no diagnostics.

- [ ] **Step 6: Verify repository hygiene**

Run: `git diff --check`

Expected: no whitespace errors. Review `git status --short` and confirm no existing user file was deleted or reverted.

## Manual Cocos Acceptance

1. 启动到大厅，未选目标点击“出发探索”，确认提示并进入情报页。
2. 依次切换地图、任务、事件和尸潮标签；隐藏缓存只显示“待雷达侦测”。
3. 从地图选择物资仓库并设为目标；大厅摘要显示物资仓库、风险和奖励。
4. 出发后目标栏、距离、迷你地图和全地图都指向物资仓库。
5. 抵达仓库只出现一次反馈，现场交互仍负责资源结算。
6. 返回大厅，改选信号塔再次出发，确认目标和标记完整切换。

