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

- Modify: `tests/integration/ui/UIVisualComposition.test.mjs` — 锁定 Texture2D 子资源路径、渲染层级和 Hall 素材引用。
- Modify: `assets/script/game/common/ui/UIBuilder.ts` — 统一纹理路径解析和装饰 Sprite 层级。
- Modify: `assets/script/game/hall/HallViewComp.ts` — 调整 Hall 的透明面板、方舟构图、状态卡和底栏视觉。
- Create: `docs/design/assets/hall-ui/hall-ui-1334x750.png` — 最终预览验收截图（仅在可用的 Creator 预览环境中生成）。

### Task 1: Texture Loading Contract

**Files:**
- Modify: `tests/integration/ui/UIVisualComposition.test.mjs`
- Modify: `assets/script/game/common/ui/UIBuilder.ts`

**Interfaces:**
- Consumes: `oops.res.load(bundle, path, Texture2D)`。
- Produces: `UIBuilder.texturePath(assetPath: string): string` 私有路径规范化逻辑；`sprite()` 使用 `<png logical path>/texture` 加载 Texture2D。

- [ ] **Step 1: Write the failing integration assertions**

在 `UI builder exposes texture-backed surfaces and HUD plates` 测试中增加：

```js
assert.match(source, /static texturePath\(/);
assert.match(source, /assetPath\.endsWith\("\\/texture"\)/);
assert.match(source, /oops\.res\.load\("bundle", this\.texturePath\(assetPath\), Texture2D\)/);
assert.match(source, /node\.setSiblingIndex\(0\)/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/integration/ui/UIVisualComposition.test.mjs`

Expected: FAIL because `texturePath()` and explicit back-layer placement do not exist.

- [ ] **Step 3: Implement the minimal loader fix**

在 `UIBuilder.sprite()` 中加载规范化路径，并在挂到父节点后把纹理节点放到最底层：

```ts
parent.addChild(node);
node.setSiblingIndex(0);

const texture = await oops.res.load("bundle", this.texturePath(assetPath), Texture2D);
```

添加私有方法：

```ts
private static texturePath(assetPath: string): string {
    return assetPath.endsWith("/texture") ? assetPath : `${assetPath}/texture`;
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/integration/ui/UIVisualComposition.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit the loader contract**

```powershell
git add -- tests/integration/ui/UIVisualComposition.test.mjs assets/script/game/common/ui/UIBuilder.ts
git commit -m "fix: load Hall UI texture subassets"
```

### Task 2: Hall Visual Composition

**Files:**
- Modify: `tests/integration/ui/UIVisualComposition.test.mjs`
- Modify: `assets/script/game/hall/HallViewComp.ts`

**Interfaces:**
- Consumes: `UIBuilder.backdrop()`、`surface()`、`sprite()`、`navButton()` 和现有 `HALL_DEMO_VIEW_MODEL`。
- Produces: `HallBackdropShade`、`ArkHeroGlow`、`ArkHeroArt` 三个稳定视觉节点名；七个按钮名保持不变。

- [ ] **Step 1: Add failing Hall composition assertions**

在 Hall 组合测试中增加：

```js
assert.match(source, /HallBackdropShade/);
assert.match(source, /ArkHeroGlow/);
assert.match(source, /ArkHeroArt/);
assert.match(source, /new Color\(2, 9, 18, 118\)/);
assert.doesNotMatch(source, /new Color\(2, 9, 18, 78\)/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/integration/ui/UIVisualComposition.test.mjs`

Expected: FAIL because the named visual composition has not been added.

- [ ] **Step 3: Refine the Hall composition**

在 `HallViewComp.render()` 中把场景遮罩命名为 `HallBackdropShade` 并使用 `new Color(2, 9, 18, 118)`。在 `renderArkOverview()` 中创建 `ArkHeroGlow` 透明青色衬底，把方舟纹理节点名重命名为 `ArkHeroArt`，将插画限制在中央内容区并保持等比尺寸。左右状态面板继续使用 `surface(..., "large")`；底栏按钮保持六个次按钮加一个橙色主按钮。

- [ ] **Step 4: Keep navigation behavior unchanged**

确认以下绑定仍存在且只绑定一次：

```ts
this.bindTouch(button, () => { void uiNavigation.push(route.id); });
this.bindTouch(depart, () => { void this.depart(); });
```

- [ ] **Step 5: Run Hall and navigation integration tests**

Run: `node --test tests/integration/ui/UIVisualComposition.test.mjs tests/integration/ui/UIViewBindings.test.mjs`

Expected: all tests PASS.

- [ ] **Step 6: Commit Hall composition**

```powershell
git add -- tests/integration/ui/UIVisualComposition.test.mjs assets/script/game/hall/HallViewComp.ts
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
