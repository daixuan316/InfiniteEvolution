# Hall UI Visual Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Hall 主界面的车库背景、方舟插画、像素面板、按钮和图标在 Cocos Creator 3.8.8 中正确显示，同时保持现有七个入口与导航行为不变。

**Architecture:** 保留 `HallViewComp` 的数据与交互结构，由 `UIBuilder` 统一把无后缀的 PNG 逻辑路径解析为 Cocos Texture2D 子资源路径，并把装饰 Sprite 固定在标签与图标下层。Hall 只调整透明度、层级、尺寸和中央构图，所有动态文字与数值继续由原生节点渲染。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Oops Framework、Node.js `node:test`、PNG Texture2D

## Global Constraints

- 设计分辨率固定为 1334×750 横屏。
- 支持 1334×750、1600×900、1800×900 和 1950×900。
- 不引入新的运行时依赖。
- 不修改 UIID、导航栈、演示数据结构或其他功能页行为。
- 不覆盖工作区中与本任务无关的现有修改。
- 纹理失败时保留程序绘制底板，不能破坏点击区域。

---

## File Structure

- Create: `tests/unit/ui/TextureAssetPath.test.mjs` — 验证 Texture2D 子资源路径规范化。
- Create: `tests/unit/ui/HallLayout.test.mjs` — 验证方舟插画在不同内容区域内保持等比缩放。
- Create: `assets/script/game/common/ui/TextureAssetPath.ts` — 纯函数形式的 Cocos 纹理子资源路径契约。
- Create: `assets/script/game/hall/HallLayout.ts` — Hall 视觉元素的纯尺寸计算。
- Modify: `tests/integration/ui/UIVisualComposition.test.mjs` — 保留 Hall 素材引用与视觉构成的集成约束。
- Modify: `assets/script/game/common/ui/UIBuilder.ts` — 统一纹理路径解析和装饰 Sprite 层级。
- Modify: `assets/script/game/hall/HallViewComp.ts` — 调整 Hall 的透明面板、方舟构图、状态卡和底栏视觉。
- Create: `docs/design/assets/hall-ui/hall-ui-1334x750.png` — 最终预览验收截图（仅在可用的 Creator 预览环境中生成）。

### Task 1: Texture Loading Contract

**Files:**
- Create: `tests/unit/ui/TextureAssetPath.test.mjs`
- Create: `assets/script/game/common/ui/TextureAssetPath.ts`
- Modify: `assets/script/game/common/ui/UIBuilder.ts`

**Interfaces:**
- Consumes: `oops.res.load(bundle, path, Texture2D)`。
- Produces: `textureAssetPath(assetPath: string): string`；`sprite()` 使用 `<png logical path>/texture` 加载 Texture2D。

- [ ] **Step 1: Write the failing integration assertions**

创建纯函数单元测试：

```js
import assert from "node:assert/strict";
import test from "node:test";
import { textureAssetPath } from "../../../assets/script/game/common/ui/TextureAssetPath.ts";

test("adds the Cocos Texture2D subresource suffix once", () => {
    assert.equal(textureAssetPath("gui/hall/texture/ark-garage"), "gui/hall/texture/ark-garage/texture");
    assert.equal(textureAssetPath("gui/hall/texture/ark-garage/texture"), "gui/hall/texture/ark-garage/texture");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/unit/ui/TextureAssetPath.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because `TextureAssetPath.ts` does not exist.

- [ ] **Step 3: Implement the minimal loader fix**

创建 `TextureAssetPath.ts`：

```ts
export function textureAssetPath(assetPath: string): string {
    return assetPath.endsWith("/texture") ? assetPath : `${assetPath}/texture`;
}
```

在 `UIBuilder.sprite()` 中加载规范化路径，并在挂到父节点后把纹理节点放到最底层：

```ts
parent.addChild(node);
node.setSiblingIndex(0);

const texture = await oops.res.load("bundle", textureAssetPath(assetPath), Texture2D);
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/unit/ui/TextureAssetPath.test.mjs tests/integration/ui/UIVisualComposition.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit the loader contract**

```powershell
git add -- tests/unit/ui/TextureAssetPath.test.mjs assets/script/game/common/ui/TextureAssetPath.ts assets/script/game/common/ui/UIBuilder.ts
git commit -m "fix: load Hall UI texture subassets"
```

### Task 2: Hall Visual Composition

**Files:**
- Create: `tests/unit/ui/HallLayout.test.mjs`
- Create: `assets/script/game/hall/HallLayout.ts`
- Modify: `assets/script/game/hall/HallViewComp.ts`

**Interfaces:**
- Consumes: `UIBuilder.backdrop()`、`surface()`、`sprite()`、`navButton()` 和现有 `HALL_DEMO_VIEW_MODEL`。
- Produces: `fitSizeWithin(sourceWidth, sourceHeight, maxWidth, maxHeight): { width: number; height: number }`；七个按钮名保持不变。

- [ ] **Step 1: Add failing Hall composition assertions**

创建纯函数单元测试：

```js
import assert from "node:assert/strict";
import test from "node:test";
import { fitSizeWithin } from "../../../assets/script/game/hall/HallLayout.ts";

test("fits the ark art without changing its aspect ratio", () => {
    assert.deepEqual(fitSizeWithin(768, 512, 650, 360), { width: 540, height: 360 });
    assert.deepEqual(fitSizeWithin(768, 512, 420, 410), { width: 420, height: 280 });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/unit/ui/HallLayout.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` because `HallLayout.ts` does not exist.

- [ ] **Step 3: Refine the Hall composition**

创建 `HallLayout.ts` 中的 `fitSizeWithin()`。在 `HallViewComp.render()` 中把场景遮罩命名为 `HallBackdropShade` 并使用 `new Color(2, 9, 18, 118)`。在 `renderArkOverview()` 中创建 `ArkHeroGlow` 透明青色衬底，并使用 `fitSizeWithin(768, 512, width - 42, height - 104)` 计算方舟插画尺寸，使其始终等比位于中央内容区。左右状态面板继续使用 `surface(..., "large")`；底栏按钮保持六个次按钮加一个橙色主按钮。

- [ ] **Step 4: Keep navigation behavior unchanged**

确认以下绑定仍存在且只绑定一次：

```ts
this.bindTouch(button, () => { void uiNavigation.push(route.id); });
this.bindTouch(depart, () => { void this.depart(); });
```

- [ ] **Step 5: Run Hall and navigation integration tests**

Run: `node --test tests/unit/ui/HallLayout.test.mjs tests/integration/ui/UIVisualComposition.test.mjs tests/integration/ui/UIViewBindings.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit Hall composition**

```powershell
git add -- tests/unit/ui/HallLayout.test.mjs assets/script/game/hall/HallLayout.ts assets/script/game/hall/HallViewComp.ts
git commit -m "feat: compose textured Hall UI"
```

### Task 3: Full Verification and Visual Acceptance

**Files:**
- Verify: `assets/bundle/gui/hall/texture/ark-garage.png`
- Verify: `assets/bundle/gui/hall/texture/ark-base.png`
- Verify: `assets/bundle/gui/ui-p0/texture/common/*.png`
- Create when preview is available: `docs/design/assets/hall-ui/hall-ui-1334x750.png`

**Interfaces:**
- Consumes: project `test:ui` script and Cocos Creator browser preview.
- Produces: passing UI test suite and a 1334×750 visual acceptance image.

- [ ] **Step 1: Validate runtime assets and metadata**

Run:

```powershell
$assets = @(
  'assets/bundle/gui/hall/texture/ark-garage.png',
  'assets/bundle/gui/hall/texture/ark-base.png',
  'assets/bundle/gui/ui-p0/texture/common/01-panel-large.png',
  'assets/bundle/gui/ui-p0/texture/common/05-button-primary.png',
  'assets/bundle/gui/ui-p0/texture/common/06-button-secondary.png'
)
$assets | ForEach-Object { if (-not (Test-Path $_) -or -not (Test-Path "$_.meta")) { throw "Missing UI asset: $_" } }
```

Expected: command exits successfully.

- [ ] **Step 2: Run the complete UI suite**

Run: `npm run test:ui`

Expected: zero failed tests.

- [ ] **Step 3: Run TypeScript validation**

Run: `npx tsc --noEmit`

Expected: zero TypeScript errors caused by the changed files.

- [ ] **Step 4: Preview at 1334×750 when Creator is available**

打开 `main.scene`，运行浏览器预览并确认：车库背景、方舟、面板纹理、资源图标和底部按钮都可见；七个入口仍可点击；控制台无纹理加载红错。保存截图为 `docs/design/assets/hall-ui/hall-ui-1334x750.png`。

- [ ] **Step 5: Inspect the scoped diff**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; unrelated existing changes remain untouched.
