# UI Navigation Framework Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Cocos Creator 3.8.8 + Oops Framework 项目中完成方舟主界面、六个功能入口、战斗 HUD、暂停与返回确认的可交互闭环，并建立可扩展的 UI 页面栈和生命周期框架。

**Architecture:** 以 Oops GUI 负责资源加载和层级，以纯 TypeScript `NavigationStack` 维护可测试的逻辑状态，`UINavigationService` 负责切换事务、缓存和失败恢复。页面通过独立 UIID/Prefab 注册，首阶段使用共享 UI 构建器和集中式演示 ViewModel，避免页面互相引用。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Oops Framework、Node.js 24 内置测试运行器、Cocos Prefab/Asset Bundle

## Global Constraints

- 设计分辨率固定为 1334×750 横屏。
- 支持 16:9、18:9、19.5:9 和 20:9，关键交互必须位于安全区。
- 继续使用 `assets/bundle` 作为默认资源包。
- 页面必须拥有稳定 UIID 和独立 Prefab 路径。
- 概念效果图只作为参考，不能整张作为交互背景。
- 首阶段不实现实际装备、制造、建设、研究、成员、情报和战斗规则。
- 不引入新的运行时第三方依赖；纯导航逻辑用 Node.js 24 原生 `node:test` 验证。

---

## File Structure

- Create: `assets/script/game/common/ui/NavigationStack.ts` — 纯逻辑页面栈与覆盖层状态。
- Create: `assets/script/game/common/ui/UINavigationService.ts` — Oops GUI 导航事务与失败恢复。
- Create: `assets/script/game/common/ui/UIPageBootstrap.ts` — UIID 到页面组件的绑定入口。
- Create: `assets/script/game/common/ui/GamePage.ts` — 页面生命周期基类。
- Create: `assets/script/game/common/ui/UIBuilder.ts` — 原生节点、面板、按钮、标签和进度条构建工具。
- Create: `assets/script/game/common/ui/UITheme.ts` — 颜色、字号、间距和触控尺寸常量。
- Create: `assets/script/game/common/ui/UIRoute.ts` — 稳定路由与显示元数据。
- Create: `assets/script/game/common/ui/UIDemoData.ts` — 首阶段集中式演示 ViewModel。
- Modify: `assets/script/game/common/config/GameUIConfig.ts` — 增加页面/覆盖层 UIID 与 Prefab 配置。
- Modify: `assets/script/game/common/config/GameEvent.ts` — 增加导航与 HUD 意图事件。
- Modify: `assets/script/game/initialize/view/LoadingViewComp.ts` — 通过统一导航进入 Hall。
- Replace: `assets/script/game/hall/HallViewComp.ts` — 正式 Hall 交互布局。
- Create: `assets/script/game/ui/FeaturePageViewComp.ts` — 六个功能页的首阶段共享实现。
- Create: `assets/script/game/battle/BattleHUDViewComp.ts` — 战斗 HUD 占位交互。
- Create: `assets/script/game/ui/PauseOverlayViewComp.ts` — 暂停覆盖层。
- Create: `assets/script/game/ui/ConfirmDialogViewComp.ts` — 返回确认弹窗。
- Create: `assets/bundle/gui/{equipment,workshop,ark-build,research,crew,intel,battle-hud,pause,confirm}/*.prefab` — 独立页面资源根。
- Create: `assets/bundle/gui/ui-icons/` — 运行时使用的精选系统、资源与 HUD 图标。
- Test: `tests/unit/ui/NavigationStack.test.mjs` — 页面栈与返回优先级。
- Test: `tests/integration/ui/UIRouteAssets.test.mjs` — UI 配置、Prefab 与运行时图标完整性。
- Modify: `package.json` — 增加 `test:ui` 脚本。

### Task 1: Pure Navigation State

**Files:**
- Create: `assets/script/game/common/ui/NavigationStack.ts`
- Test: `tests/unit/ui/NavigationStack.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `type RouteKey = string | number`。
- Produces: `interface NavigationEntry { route: RouteKey; params?: Readonly<Record<string, unknown>> }`。
- Produces: `NavigationStack.reset(root)`、`push(entry)`、`replace(entry)`、`pop()`、`openOverlay(entry)`、`closeOverlay()`、`back()`、`current`、`topOverlay`、`snapshot()`。

- [ ] **Step 1: Write the failing stack tests**

```js
import assert from "node:assert/strict";
import test from "node:test";
import { NavigationStack } from "../../../assets/script/game/common/ui/NavigationStack.ts";

test("push and pop preserve the Hall root", () => {
  const stack = new NavigationStack();
  stack.reset({ route: "Hall" });
  stack.push({ route: "Equipment" });
  assert.equal(stack.current?.route, "Equipment");
  assert.equal(stack.pop()?.route, "Hall");
  assert.equal(stack.pop()?.route, "Hall");
});

test("back closes the top overlay before popping a page", () => {
  const stack = new NavigationStack();
  stack.reset({ route: "Hall" });
  stack.push({ route: "BattleHUD" });
  stack.openOverlay({ route: "Pause" });
  assert.deepEqual(stack.back(), { kind: "overlay", entry: { route: "Pause" } });
  assert.equal(stack.current?.route, "BattleHUD");
});

test("replace removes the previous full-screen route", () => {
  const stack = new NavigationStack();
  stack.reset({ route: "Hall" });
  stack.replace({ route: "BattleHUD" });
  assert.deepEqual(stack.snapshot().pages.map((item) => item.route), ["BattleHUD"]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/unit/ui/NavigationStack.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `NavigationStack.ts`.

- [ ] **Step 3: Implement the minimal state machine**

```ts
export type RouteKey = string | number;
export interface NavigationEntry {
    route: RouteKey;
    params?: Readonly<Record<string, unknown>>;
}
export type BackResult =
    | { kind: "overlay"; entry: NavigationEntry }
    | { kind: "page"; entry: NavigationEntry }
    | { kind: "root"; entry: NavigationEntry | null };

export class NavigationStack {
    private pages: NavigationEntry[] = [];
    private overlays: NavigationEntry[] = [];
    get current() { return this.pages.at(-1) ?? null; }
    get topOverlay() { return this.overlays.at(-1) ?? null; }
    reset(root: NavigationEntry) { this.pages = [root]; this.overlays = []; }
    push(entry: NavigationEntry) { if (this.current?.route !== entry.route) this.pages.push(entry); }
    replace(entry: NavigationEntry) { this.pages = [entry]; this.overlays = []; }
    pop() { if (this.pages.length > 1) this.pages.pop(); return this.current; }
    openOverlay(entry: NavigationEntry) { if (this.topOverlay?.route !== entry.route) this.overlays.push(entry); }
    closeOverlay() { return this.overlays.pop() ?? null; }
    back(): BackResult {
        const overlay = this.closeOverlay();
        if (overlay) return { kind: "overlay", entry: overlay };
        if (this.pages.length > 1) { this.pages.pop(); return { kind: "page", entry: this.current! }; }
        return { kind: "root", entry: this.current };
    }
    snapshot() { return { pages: [...this.pages], overlays: [...this.overlays] }; }
}
```

- [ ] **Step 4: Add the repeatable package command and run GREEN**

Add to `package.json`:

```json
"scripts": {
  "test:ui": "node --test tests/unit/ui/*.test.mjs tests/integration/ui/*.test.mjs"
}
```

Run: `node --test tests/unit/ui/NavigationStack.test.mjs`

Expected: 3 tests pass.

- [ ] **Step 5: Commit the pure navigation state**

```powershell
git add -- package.json assets/script/game/common/ui/NavigationStack.ts tests/unit/ui/NavigationStack.test.mjs
git commit -m "feat: add testable UI navigation state"
```

### Task 2: Route Registry and Oops Navigation Service

**Files:**
- Create: `assets/script/game/common/ui/UIRoute.ts`
- Create: `assets/script/game/common/ui/UINavigationService.ts`
- Create: `assets/script/game/common/ui/GamePage.ts`
- Create: `assets/script/game/common/ui/UIPageBootstrap.ts`
- Modify: `assets/script/game/common/config/GameUIConfig.ts`
- Modify: `assets/script/game/common/config/GameEvent.ts`
- Modify: `assets/script/game/initialize/view/LoadingViewComp.ts`

**Interfaces:**
- Consumes: `NavigationStack` from Task 1。
- Produces: `uiNavigation.enterRoot(UIID.Hall)`、`push(uiid, params?)`、`replace(uiid, params?)`、`openOverlay(uiid, params?)`、`closeOverlay(uiid)`、`back()`、`resetToHall()`。
- Produces: stable UIIDs `Equipment`、`Workshop`、`ArkBuild`、`Research`、`Crew`、`Intel`、`BattleHUD`、`PauseOverlay`、`ConfirmDialog`。
- Produces: `UIPageBootstrap.attach(uiid, node, params)`。

- [ ] **Step 1: Extend UIID and UIConfigData**

Add full-screen pages on `LayerType.UI`, pause on `LayerType.PopUp`, confirm on `LayerType.Dialog`. Configure Hall and six feature pages with `destroy: false`; configure BattleHUD and overlays with `destroy: true`.

```ts
Equipment,
Workshop,
ArkBuild,
Research,
Crew,
Intel,
BattleHUD,
PauseOverlay,
ConfirmDialog,
```

- [ ] **Step 2: Define route metadata and page lifecycle**

`UIRoute.ts` must export one `UI_ROUTE_META` record containing title, description, icon path and whether the route is an overlay. `GamePage.ts` must expose `configure(params)` and remove every registered callback from `onDisable`/`onDestroy`.

- [ ] **Step 3: Implement transactional navigation**

`UINavigationService` must open and bootstrap the target before removing the previous full-screen page, use `try/finally` to release `transitioning`, ignore duplicate requests, and emit a toast on failure.

```ts
async push(uiid: UIID, params: PageParams = {}): Promise<boolean> {
    if (this.transitioning || this.stack.current?.route === uiid) return false;
    this.transitioning = true;
    const previous = this.stack.current?.route as UIID | undefined;
    try {
        const node = await oops.gui.open(uiid, { ...params, uiid });
        UIPageBootstrap.attach(uiid, node, params);
        this.stack.push({ route: uiid, params });
        if (previous !== undefined) oops.gui.remove(previous);
        return true;
    } catch (error) {
        console.error("UI navigation failed", uiid, error);
        oops.gui.toast("界面加载失败，请重试");
        return false;
    } finally {
        this.transitioning = false;
    }
}
```

- [ ] **Step 4: Route Loading through the service**

Replace the direct `oops.gui.open(UIID.Hall)` call in `LoadingViewComp.reset()` with `uiNavigation.enterRoot(UIID.Hall)` and remove the special-case `HallViewComp` attachment.

- [ ] **Step 5: Run static import and configuration checks**

Run: `node --test tests/unit/ui/NavigationStack.test.mjs`

Expected: 3 tests pass and Node reports no syntax errors in the pure state module.

- [ ] **Step 6: Commit the navigation integration**

```powershell
git add -- assets/script/game/common/config assets/script/game/common/ui assets/script/game/initialize/view/LoadingViewComp.ts
git commit -m "feat: integrate UI navigation with Oops GUI"
```

### Task 3: Shared Theme, Demo Data, and Runtime Assets

**Files:**
- Create: `assets/script/game/common/ui/UITheme.ts`
- Create: `assets/script/game/common/ui/UIBuilder.ts`
- Create: `assets/script/game/common/ui/UIDemoData.ts`
- Create: `assets/bundle/gui/ui-icons/system-nav/*.png`
- Create: `assets/bundle/gui/ui-icons/resources-items/*.png`
- Create: `assets/bundle/gui/ui-icons/hud-combat/*.png`
- Test: `tests/integration/ui/UIRouteAssets.test.mjs`

**Interfaces:**
- Produces: `UI_THEME` with navy/cyan/orange/magenta/status colors and 72 design-unit minimum touch target.
- Produces: `UIBuilder.fullScreenRoot()`、`panel()`、`label()`、`button()`、`progressBar()`、`spacer()`。
- Produces: `HALL_DEMO_VIEW_MODEL` and `FEATURE_DEMO_VIEW_MODELS` keyed by feature UIID.

- [ ] **Step 1: Write the failing asset/config test**

```js
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const config = readFileSync("assets/script/game/common/config/GameUIConfig.ts", "utf8");
const required = ["equipment", "workshop", "ark-build", "research", "crew", "intel", "battle-hud", "pause", "confirm"];

test("every first-stage route has a prefab", () => {
  for (const name of required) {
    assert.match(config, new RegExp(`gui/${name}/${name}`));
    assert.equal(existsSync(`assets/bundle/gui/${name}/${name}.prefab`), true, name);
  }
});

test("runtime UI icons are present", () => {
  for (const path of [
    "assets/bundle/gui/ui-icons/system-nav/01-map.png",
    "assets/bundle/gui/ui-icons/system-nav/03-workshop.png",
    "assets/bundle/gui/ui-icons/system-nav/10-pause.png",
    "assets/bundle/gui/ui-icons/hud-combat/01-health.png",
    "assets/bundle/gui/ui-icons/hud-combat/07-ark-return.png"
  ]) assert.equal(existsSync(path), true, path);
});
```

- [ ] **Step 2: Run the integration test and verify RED**

Run: `node --test tests/integration/ui/UIRouteAssets.test.mjs`

Expected: FAIL because the new Prefabs and runtime icon copies do not exist.

- [ ] **Step 3: Define theme and UI builder**

Implement reusable native Cocos nodes with integer positions, safe-area margins, named nodes and explicit touch targets. Buttons must use `UITransform` size at least 72×72 and must unregister `TOUCH_END` listeners on destruction.

- [ ] **Step 4: Add centralized demo ViewModels**

Use exact fields for Hall (`chapter`, `day`, `phase`, `resources`, `ark`, `threat`) and feature pages (`title`, `summary`, `metrics`, `nextAction`). No page may declare its own duplicated demo values.

- [ ] **Step 5: Copy the selected icon assets into the runtime bundle**

Copy only the icons required by Hall, feature pages, pause, confirm and BattleHUD from `docs/design/assets/ui-icons/icons/` into `assets/bundle/gui/ui-icons/`, preserving group names and stable filenames.

- [ ] **Step 6: Import the new assets with Cocos Creator 3.8.8**

Run the installed editor against the project once so Creator generates `.meta` files:

```powershell
& 'C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe' --project 'E:\project\game\InfiniteEvolutionDoomsdaySurvival\NewProject'
```

Expected: the project opens and the Asset Database finishes importing without red error entries.

- [ ] **Step 7: Commit theme, data, assets, and tests**

```powershell
git add -- assets/script/game/common/ui assets/bundle/gui/ui-icons tests/integration/ui/UIRouteAssets.test.mjs
git commit -m "feat: add shared UI theme and runtime assets"
```

### Task 4: Hall and Six Feature Pages

**Files:**
- Replace: `assets/script/game/hall/HallViewComp.ts`
- Create: `assets/script/game/ui/FeaturePageViewComp.ts`
- Create: `assets/bundle/gui/equipment/equipment.prefab`
- Create: `assets/bundle/gui/workshop/workshop.prefab`
- Create: `assets/bundle/gui/ark-build/ark-build.prefab`
- Create: `assets/bundle/gui/research/research.prefab`
- Create: `assets/bundle/gui/crew/crew.prefab`
- Create: `assets/bundle/gui/intel/intel.prefab`
- Modify: `assets/bundle/gui/hall/hall.prefab`

**Interfaces:**
- Consumes: `uiNavigation.push()`、`uiNavigation.replace()`、`HALL_DEMO_VIEW_MODEL`、`FEATURE_DEMO_VIEW_MODELS`、`UIBuilder`。
- Produces: Hall buttons named `BtnEquipment`、`BtnWorkshop`、`BtnArkBuild`、`BtnResearch`、`BtnCrew`、`BtnIntel`、`BtnDepart`。
- Produces: feature-page back button named `BtnBack` calling `uiNavigation.back()`。

- [ ] **Step 1: Rebuild Hall with the shared visual system**

Create top status bar, left Ark summary, central Ark overview panel, right threat summary, bottom six-entry navigation row and orange Depart button. Use `Widget`/computed safe margins rather than hard-coding to one device width.

- [ ] **Step 2: Wire the seven Hall actions**

Each feature button calls `uiNavigation.push(targetUIID)` once. Depart calls `uiNavigation.replace(UIID.BattleHUD)` and dispatches `GameEvent.EnterBattle` only after navigation succeeds.

- [ ] **Step 3: Implement the shared feature page component**

`FeaturePageViewComp.configure({ uiid })` resolves its route metadata and ViewModel, renders title/summary/status cards, and binds `BtnBack` to `uiNavigation.back()`.

- [ ] **Step 4: Create the six independent Prefab roots**

Each root must contain a full-screen `UITransform` and `Widget`, use the exact route filename from `GameUIConfig.ts`, and remain visually empty until `UIPageBootstrap` attaches/configures the page component.

- [ ] **Step 5: Run route/asset integration tests**

Run: `node --test tests/integration/ui/UIRouteAssets.test.mjs`

Expected: the Prefab and icon tests pass.

- [ ] **Step 6: Commit Hall and feature navigation**

```powershell
git add -- assets/script/game/hall assets/script/game/ui/FeaturePageViewComp.ts assets/bundle/gui/hall assets/bundle/gui/equipment assets/bundle/gui/workshop assets/bundle/gui/ark-build assets/bundle/gui/research assets/bundle/gui/crew assets/bundle/gui/intel
git commit -m "feat: build Hall and feature page navigation"
```

### Task 5: Battle HUD, Pause, and Return Confirmation

**Files:**
- Create: `assets/script/game/battle/BattleHUDViewComp.ts`
- Create: `assets/script/game/ui/PauseOverlayViewComp.ts`
- Create: `assets/script/game/ui/ConfirmDialogViewComp.ts`
- Create: `assets/bundle/gui/battle-hud/battle-hud.prefab`
- Create: `assets/bundle/gui/pause/pause.prefab`
- Create: `assets/bundle/gui/confirm/confirm.prefab`
- Modify: `assets/script/game/common/ui/UIPageBootstrap.ts`

**Interfaces:**
- Consumes: `uiNavigation.openOverlay()`、`closeOverlay()`、`resetToHall()`。
- Produces: `BattleHUDViewComp` buttons `BtnPause` and `BtnReturnArk`。
- Produces: `ConfirmDialogParams { title: string; message: string; confirmText: string; cancelText: string; onConfirm(): void }`。

- [ ] **Step 1: Build the Battle HUD interaction shell**

Render health/shield/pollution bars, daylight progress, objective text, minimap plate, pause button and return-Ark button over a dark world placeholder. Keep HUD controls inside safe margins and use the existing P0 HUD frames.

- [ ] **Step 2: Implement pause overlay behavior**

Pause opens once, blocks underlying touch, and offers Continue and Return to Ark. Continue closes only `PauseOverlay` and leaves BattleHUD unchanged.

- [ ] **Step 3: Implement confirmation results**

Cancel closes only `ConfirmDialog`. Confirm closes both overlays, dispatches `GameEvent.LeaveBattle`, and calls `uiNavigation.resetToHall()`.

- [ ] **Step 4: Complete UIPageBootstrap mappings**

Map Hall, six feature UIIDs, BattleHUD, PauseOverlay and ConfirmDialog to their component constructors. Repeated attachment must return the existing component and call `configure` exactly once per open.

- [ ] **Step 5: Exercise back-priority unit tests**

Run: `node --test tests/unit/ui/NavigationStack.test.mjs`

Expected: overlays close before pages and the root remains stable.

- [ ] **Step 6: Commit the Battle HUD loop**

```powershell
git add -- assets/script/game/battle/BattleHUDViewComp.ts assets/script/game/ui assets/script/game/common/ui/UIPageBootstrap.ts assets/bundle/gui/battle-hud assets/bundle/gui/pause assets/bundle/gui/confirm
git commit -m "feat: add Battle HUD pause and return flow"
```

### Task 6: Import, Verification, and Acceptance Record

**Files:**
- Modify: generated `.meta` files under new UI script/resource paths.
- Create: `tests/e2e/ui-navigation-checklist.md`
- Modify: `README.md`

**Interfaces:**
- Validates every interface produced by Tasks 1–5.

- [ ] **Step 1: Run all automated UI checks**

Run: `npm run test:ui`

Expected: all navigation and asset tests pass with zero failures.

- [ ] **Step 2: Open the project in Cocos Creator 3.8.8**

Wait for Asset Database import completion, then run `main.scene` in browser preview. Expected startup path: Loading → Hall with no red console errors.

- [ ] **Step 3: Verify the complete interaction matrix**

Enter and return from Equipment, Workshop, ArkBuild, Research, Crew and Intel. Enter BattleHUD, pause/resume, cancel return, then confirm return. Repeat rapid taps and verify there is never more than one instance of the target page.

- [ ] **Step 4: Verify lifecycle repetition**

Repeat every feature page enter/exit 20 times and Hall/BattleHUD round trip 20 times. Expected: no duplicate listener, destroyed-node or invalid-parent errors.

- [ ] **Step 5: Verify aspect ratios**

Preview at 1334×750, 1600×900, 1800×900 and 1950×900. Record that top status, bottom navigation, back, pause and confirm buttons remain inside the visible safe region.

- [ ] **Step 6: Record manual acceptance and update README**

Write actual pass/fail evidence and tested resolutions to `tests/e2e/ui-navigation-checklist.md`. Update README startup flow from the old Hall/Battle placeholders to the new UI navigation loop.

- [ ] **Step 7: Inspect the scoped diff and commit verification artifacts**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; unrelated pre-existing files remain untouched.

```powershell
git add -- README.md tests/e2e/ui-navigation-checklist.md assets/**/*.meta
git commit -m "test: verify UI navigation loop"
```

## Plan Completion Gate

The implementation is complete only when `npm run test:ui` passes, Creator preview reaches Hall without errors, all six feature pages round-trip correctly, BattleHUD pause/cancel/confirm behavior matches the navigation stack, rapid taps do not duplicate pages, 20-cycle lifecycle checks pass, and four target aspect ratios keep critical controls inside the safe region.
