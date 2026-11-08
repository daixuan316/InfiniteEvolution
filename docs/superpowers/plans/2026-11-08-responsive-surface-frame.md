# Responsive Surface Frame Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace stretched large-panel decorations with fixed-aspect frame pieces that remain visually correct on the hall's wide top bar and tall side panels.

**Architecture:** A pure TypeScript layout module owns source rectangles, scale selection, and target placement for the large-panel frame pieces. `UIBuilder.surface` retains its public API and delegates large panels to an asynchronous compositor that places fixed-aspect sprites over the existing programmatic cut-corner panel; all other surface kinds keep the existing nine-slice path.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Cocos `SpriteFrame`/`Sprite`/`UITransform`, Node.js built-in test runner.

## Global Constraints

- Preserve the existing `UIBuilder.surface(parent, name, size, position, kind, tint)` public API.
- Reuse `assets/bundle/gui/ui-p0/texture/common/01-panel-large.png`; do not replace or modify the source artwork.
- Never stretch the amber side modules or yellow-black caution plate non-uniformly.
- Retain the programmatic `UIBuilder.panel` fill and border when texture loading fails.
- Do not change hall labels, information hierarchy, or gameplay data.

---

## File Map

- Create `assets/script/game/common/ui/SurfaceFrameLayout.ts`: pure frame-piece source metadata, scale calculation, and placement.
- Create `tests/unit/ui/SurfaceFrameLayout.test.mjs`: geometry regression tests for wide, tall, compact, and invalid targets.
- Modify `assets/script/game/common/ui/UIBuilder.ts`: load the large-panel texture once and render fixed-aspect frame pieces.
- Modify `tests/integration/ui/UIVisualComposition.test.mjs`: verify that large surfaces use the compositor while other surfaces keep nine-slice rendering.

### Task 1: Pure Large-Surface Frame Layout

**Files:**
- Create: `assets/script/game/common/ui/SurfaceFrameLayout.ts`
- Create: `tests/unit/ui/SurfaceFrameLayout.test.mjs`

**Interfaces:**
- Produces: `surfaceFramePieces(width: number, height: number): readonly SurfaceFramePiece[]`
- Produces: `SurfaceFramePiece` with `name`, `source`, `x`, `y`, `width`, and `height` numeric fields.
- Produces: `shouldComposeLargeSurface(width: number, height: number): boolean`.

- [ ] **Step 1: Write failing geometry tests**

```js
import assert from "node:assert/strict";
import test from "node:test";

import { shouldComposeLargeSurface, surfaceFramePieces } from "../../../assets/script/game/common/ui/SurfaceFrameLayout.ts";

test("keeps authored decorations at fixed size on tall large panels", () => {
    const pieces = surfaceFramePieces(258, 500);
    const left = pieces.find((piece) => piece.name === "left-module");
    const right = pieces.find((piece) => piece.name === "right-module");
    assert.deepEqual({ width: left.width, height: left.height }, { width: 51, height: 71 });
    assert.deepEqual({ width: right.width, height: right.height }, { width: 41, height: 71 });
});

test("uniformly scales decorations on shallow wide panels", () => {
    const pieces = surfaceFramePieces(1278, 82);
    const top = pieces.find((piece) => piece.name === "top-badge");
    const scaleX = top.width / top.source.width;
    const scaleY = top.height / top.source.height;
    assert.ok(Math.abs(scaleX - scaleY) < 0.0001);
    assert.ok(scaleX < 1);
});

test("rejects invalid or too-small composite targets", () => {
    assert.equal(shouldComposeLargeSurface(1278, 82), true);
    assert.equal(shouldComposeLargeSurface(258, 500), true);
    assert.equal(shouldComposeLargeSurface(100, 50), false);
    assert.deepEqual(surfaceFramePieces(Number.NaN, 500), []);
});
```

- [ ] **Step 2: Run the new unit test and verify RED**

Run: `node --test tests/unit/ui/SurfaceFrameLayout.test.mjs`

Expected: FAIL because `SurfaceFrameLayout.ts` does not exist.

- [ ] **Step 3: Implement frame metadata and placement**

Create the pure module with these authored texture regions:

```ts
export interface SurfaceFrameRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SurfaceFramePiece extends SurfaceFrameRect {
    name: "top-left" | "top-badge" | "top-right" | "left-module" | "right-module" | "bottom-left" | "bottom-caution" | "bottom-right";
    source: SurfaceFrameRect;
}

type SurfaceFrameEdge = "top-left" | "top" | "top-right" | "left" | "right" | "bottom-left" | "bottom" | "bottom-right";

interface AuthoredSurfaceFramePiece {
    name: SurfaceFramePiece["name"];
    source: SurfaceFrameRect;
    edge: SurfaceFrameEdge;
}

const PIECES = [
    { name: "top-left", source: { x: 10, y: 81, width: 57, height: 43 }, edge: "top-left" },
    { name: "top-badge", source: { x: 90, y: 81, width: 89, height: 43 }, edge: "top" },
    { name: "top-right", source: { x: 199, y: 81, width: 57, height: 43 }, edge: "top-right" },
    { name: "left-module", source: { x: 10, y: 110, width: 51, height: 71 }, edge: "left" },
    { name: "right-module", source: { x: 215, y: 110, width: 41, height: 71 }, edge: "right" },
    { name: "bottom-left", source: { x: 10, y: 208, width: 60, height: 48 }, edge: "bottom-left" },
    { name: "bottom-caution", source: { x: 81, y: 211, width: 105, height: 45 }, edge: "bottom" },
    { name: "bottom-right", source: { x: 196, y: 208, width: 60, height: 48 }, edge: "bottom-right" },
] as const;

export function shouldComposeLargeSurface(width: number, height: number): boolean {
    return Number.isFinite(width) && Number.isFinite(height) && width >= 160 && height >= 64;
}

export function surfaceFramePieces(width: number, height: number): readonly SurfaceFramePiece[] {
    if (!shouldComposeLargeSurface(width, height)) return [];
    const scale = Math.min(1, width / 246, height / 96);
    return PIECES.map((piece) => {
        const pieceWidth = Math.round(piece.source.width * scale);
        const pieceHeight = Math.round(piece.source.height * scale);
        let x = 0;
        let y = 0;

        if (piece.edge.includes("left")) x = Math.round(-width / 2 + pieceWidth / 2);
        if (piece.edge.includes("right")) x = Math.round(width / 2 - pieceWidth / 2);
        if (piece.edge === "left") x = Math.round(-width / 2 + pieceWidth / 2);
        if (piece.edge === "right") x = Math.round(width / 2 - pieceWidth / 2);
        if (piece.edge.includes("top")) y = Math.round(height / 2 - pieceHeight / 2);
        if (piece.edge.includes("bottom")) y = Math.round(-height / 2 + pieceHeight / 2);

        return {
            name: piece.name,
            source: piece.source,
            x,
            y,
            width: pieceWidth,
            height: pieceHeight,
        };
    });
}
```

- [ ] **Step 4: Run the unit test and verify GREEN**

Run: `node --test tests/unit/ui/SurfaceFrameLayout.test.mjs`

Expected: all `SurfaceFrameLayout` tests PASS.

- [ ] **Step 5: Run the existing UI unit tests**

Run: `node --test tests/unit/ui/*.test.mjs`

Expected: all UI unit tests PASS.

- [ ] **Step 6: Commit the pure layout slice**

```bash
git add assets/script/game/common/ui/SurfaceFrameLayout.ts tests/unit/ui/SurfaceFrameLayout.test.mjs
git commit -m "feat: calculate responsive surface frame pieces"
```

### Task 2: Cocos Large-Surface Frame Compositor

**Files:**
- Modify: `assets/script/game/common/ui/UIBuilder.ts`
- Modify: `tests/integration/ui/UIVisualComposition.test.mjs`

**Interfaces:**
- Consumes: `shouldComposeLargeSurface(width, height)` and `surfaceFramePieces(width, height)` from Task 1.
- Preserves: `UIBuilder.surface(parent, name, size, position, kind, tint): Node`.
- Adds private implementation: `UIBuilder.compositeLargeSurfaceFrame(parent, assetPath, size, tint): Promise<void>`.

- [ ] **Step 1: Add failing integration assertions**

Add assertions to the existing UI builder composition test:

```js
assert.match(source, /surfaceFramePieces\(size\.width, size\.height\)/);
assert.match(source, /compositeLargeSurfaceFrame/);
assert.match(source, /kind === "large"/);
assert.match(source, /new Rect\(piece\.source\.x, piece\.source\.y, piece\.source\.width, piece\.source\.height\)/);
assert.match(source, /sprite\.type = Sprite\.Type\.SIMPLE/);
```

Also assert that the non-large branch still calls the current sliced renderer:

```js
assert.match(source, /this\.sprite\(node, `\$\{this\.COMMON_TEXTURE\}\/\$\{asset\}`, size, Vec3\.ZERO, true, tint\)/);
```

- [ ] **Step 2: Run the integration test and verify RED**

Run: `node --test tests/integration/ui/UIVisualComposition.test.mjs`

Expected: FAIL because the compositor references are absent.

- [ ] **Step 3: Implement the large-surface compositor**

Update `UIBuilder.surface`:

```ts
if (kind === "large" && shouldComposeLargeSurface(size.width, size.height)) {
    void this.compositeLargeSurfaceFrame(node, `${this.COMMON_TEXTURE}/${asset}`, size, tint);
} else {
    void this.sprite(node, `${this.COMMON_TEXTURE}/${asset}`, size, Vec3.ZERO, true, tint);
}
```

Implement `compositeLargeSurfaceFrame` so it:

1. Creates a `SurfaceFrame` node with a matching `UITransform` and adds it before the asynchronous load, keeping it behind labels and controls created later.
2. Loads the texture through `oops.res.load("bundle", textureAssetPath(assetPath), Texture2D)` exactly once.
3. Exits and destroys the frame root when loading fails or the parent/frame root is invalid.
4. Iterates `surfaceFramePieces(size.width, size.height)` and creates one child `Sprite` per piece.
5. Resets each `SpriteFrame` with the piece's source rectangle and original source size.
6. Uses `Sprite.SizeMode.CUSTOM` and `Sprite.Type.SIMPLE`, sets the uniformly scaled target size and position, and applies `tint`.

The existing programmatic panel remains underneath the decoration pieces and supplies the neutral stretchable fill and rails.

- [ ] **Step 4: Run the targeted integration test and verify GREEN**

Run: `node --test tests/integration/ui/UIVisualComposition.test.mjs`

Expected: all visual-composition tests PASS.

- [ ] **Step 5: Run the complete UI suite**

Run: `npm run test:ui`

Expected: all unit and integration UI tests PASS with no warnings.

- [ ] **Step 6: Run the TypeScript project check available in the repository**

Run: `npx tsc --noEmit -p tsconfig.json`

Expected: exit code `0`. If the project has pre-existing type errors, record them separately and run the narrowest available Cocos script compilation check for the changed files.

- [ ] **Step 7: Visually verify target geometries**

Open the hall at the reference resolution and confirm:

- `TopStatus` around `1278 × 82`: the bottom caution plate is centered and not elongated.
- `ArkStatus` and `ThreatSummary` around `258 × 500`: amber modules retain their authored height.
- Large dialog/feature surfaces: corners and center decorations remain fixed-aspect and content remains above the frame.
- One wider aspect ratio: no decoration stretches and no frame piece overlaps labels.

- [ ] **Step 8: Commit the renderer**

```bash
git add assets/script/game/common/ui/UIBuilder.ts tests/integration/ui/UIVisualComposition.test.mjs
git commit -m "fix: preserve large panel frame decorations"
```
