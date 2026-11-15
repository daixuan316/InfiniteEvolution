# Hall UI C3 Industrial Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Hall 主界面实现为已确认的 C3 重装工业舱风格，并保持现有七个入口和战斗跳转行为不变。

**Architecture:** 保留 `HallViewComp` 的数据与交互所有权，在 `HallLayout` 中增加可独立测试的分段状态计算。Hall 通过现有 `UIBuilder` 的切角面板、九宫格、图标和标签组合资源轨道、状态模块、警报牌与工业导航按钮，不引入新的运行时依赖或平行 UI 框架。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Oops Framework、Node.js `node:test`

## Global Constraints

- 设计分辨率固定为 1334×750 横屏。
- 验证 1334×750、1600×900、1800×900 和 1950×900。
- 不修改 UIID、导航栈、演示数据结构、七个入口节点名或战斗跳转行为。
- 不重做车库背景和方舟主体插画。
- 动态文字、数值、进度与倒计时继续由 Cocos 节点渲染。
- 不引入新的运行时依赖。
- 不覆盖当前工作区中与 Hall C3 无关的修改。

---

## File Structure

- Modify: `assets/script/game/hall/HallLayout.ts` — 提供状态值到固定数量分段灯的纯函数转换。
- Modify: `tests/unit/ui/HallLayout.test.mjs` — 验证耐久、能源和模块槽位的分段结果。
- Modify: `assets/script/game/hall/HallViewComp.ts` — 组合 C3 资源轨道、状态模块、警报牌与底部导航。
- Modify: `tests/integration/ui/UIVisualComposition.test.mjs` — 固化 C3 组件节点和真实图标引用。

### Task 1: Segmented Status Model

**Files:**
- Modify: `assets/script/game/hall/HallLayout.ts`
- Modify: `tests/unit/ui/HallLayout.test.mjs`

**Interfaces:**
- Consumes: `value: number`、`maximum: number`、`segmentCount: number`。
- Produces: `filledSegments(value: number, maximum: number, segmentCount: number): number`，返回限制在 `0...segmentCount` 的点亮分段数。

- [ ] **Step 1: Write the failing segment tests**

在 `tests/unit/ui/HallLayout.test.mjs` 导入 `filledSegments` 并加入：

```js
test("maps status values to clamped industrial segments", () => {
    assert.equal(filledSegments(920, 1000, 10), 9);
    assert.equal(filledSegments(88, 100, 10), 9);
    assert.equal(filledSegments(5, 7, 7), 5);
    assert.equal(filledSegments(-1, 100, 10), 0);
    assert.equal(filledSegments(120, 100, 10), 10);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/unit/ui/HallLayout.test.mjs`  
Expected: FAIL because `HallLayout.ts` does not export `filledSegments`.

- [ ] **Step 3: Implement the segment calculation**

在 `HallLayout.ts` 增加：

```ts
export function filledSegments(value: number, maximum: number, segmentCount: number): number {
    if (maximum <= 0 || segmentCount <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, value / maximum));
    return Math.max(0, Math.min(segmentCount, Math.round(ratio * segmentCount)));
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/unit/ui/HallLayout.test.mjs`  
Expected: 2 tests pass.

- [ ] **Step 5: Commit the segment model**

```powershell
git add -- assets/script/game/hall/HallLayout.ts tests/unit/ui/HallLayout.test.mjs
git commit -m "feat: model segmented Hall status"
```

### Task 2: C3 Hall Visual Composition

**Files:**
- Modify: `assets/script/game/hall/HallViewComp.ts`
- Modify: `tests/integration/ui/UIVisualComposition.test.mjs`

**Interfaces:**
- Consumes: `filledSegments()`、`UIBuilder.surface()`、`UIBuilder.panel()`、`UIBuilder.icon()`、`UIBuilder.label()`、现有 `HALL_DEMO_VIEW_MODEL`。
- Produces: 稳定节点 `TopResourceRail`、`ArkStatusHeader`、`CoreStatusModule`、`PowerStatusModule`、`ModuleSlotLights`、`ThreatHazardPlate`、`ThreatCountdownModule`、`Btn*EnergyRail`。

- [ ] **Step 1: Add failing C3 composition assertions**

在 `tests/integration/ui/UIVisualComposition.test.mjs` 的 Hall 测试中加入：

```js
for (const marker of [
    "TopResourceRail",
    "ArkStatusHeader",
    "CoreStatusModule",
    "PowerStatusModule",
    "ModuleSlotLights",
    "ThreatHazardPlate",
    "ThreatCountdownModule",
    "EnergyRail",
]) {
    assert.match(source, new RegExp(marker), marker);
}
assert.match(source, /filledSegments/);
assert.match(source, /hud-combat\/01-health/);
assert.match(source, /hud-combat\/02-shield/);
```

- [ ] **Step 2: Run the focused integration test and verify RED**

Run: `node --test tests/integration/ui/UIVisualComposition.test.mjs`  
Expected: FAIL because the C3 nodes are not yet present.

- [ ] **Step 3: Compose the top resource rail**

将三张独立 `ResourceCard:*` 改为一个 `TopResourceRail` surface。每个资源在轨道内使用 `ResourceCell:*`、真实资源图标、小号资源名和大号数值，并以窄青色分隔线区分。

- [ ] **Step 4: Compose segmented status modules**

在 `HallViewComp` 增加 Hall 私有组合方法：

```ts
private addSegmentedBar(parent: Node, name: string, size: Size, position: Vec3, filled: number, count: number, color: Color): Node;
private renderStatusModule(parent: Node, name: string, icon: string, label: string, value: number, maximum: number, position: Vec3, color: Color): Node;
```

`renderArkStatus()` 使用 `ArkStatusHeader`、`CoreStatusModule`、`PowerStatusModule` 和 `ModuleSlotLights`。耐久、能源各十段，模块槽位七段。

- [ ] **Step 5: Compose the threat hazard and countdown**

`renderThreat()` 使用洋红标题条、红色切角 `ThreatHazardPlate`、污染图标、警戒提示、威胁等级和敌人类型。倒计时放入 `ThreatCountdownModule`，底部增加橙色警戒分段条，动态时间仍来自 `HALL_DEMO_VIEW_MODEL.threat.countdown`。

- [ ] **Step 6: Compose industrial navigation buttons**

用 Hall 私有 `createHallNavButton()` 组合现有 surface、真实图标、图标芯片、顶部 `EnergyRail`、标签和主行动箭头。保持 `BtnEquipment`、`BtnWorkshop`、`BtnArkBuild`、`BtnResearch`、`BtnCrew`、`BtnIntel`、`BtnDepart` 节点名和原点击绑定。

- [ ] **Step 7: Run focused Hall tests**

Run: `node --test tests/unit/ui/HallLayout.test.mjs tests/integration/ui/UIVisualComposition.test.mjs tests/integration/ui/UIViewBindings.test.mjs`  
Expected: all tests pass.

- [ ] **Step 8: Run complete verification**

Run: `npm run test:ui`  
Expected: zero failed tests.

Run: `npx tsc --noEmit`  
Expected: no new TypeScript errors caused by Hall C3 files.

- [ ] **Step 9: Inspect the scoped diff**

Run: `git diff --check -- assets/script/game/hall/HallLayout.ts assets/script/game/hall/HallViewComp.ts tests/unit/ui/HallLayout.test.mjs tests/integration/ui/UIVisualComposition.test.mjs`  
Expected: no whitespace errors and no unrelated files in the scoped diff.
