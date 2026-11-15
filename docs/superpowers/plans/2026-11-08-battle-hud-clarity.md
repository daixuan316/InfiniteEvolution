# Battle HUD Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalance the battle HUD so survival information and active threats are immediately readable while objectives and teaching hints appear only on demand.

**Architecture:** Keep `BattleSimulation` as the only combat-state source and keep Cocos node ownership in `BattleHUDViewComp`. Add an engine-independent presentation module for objective-toast timing and enemy-health-bar visibility, extend the pure layout module for HUD information regions, then bind those rules to the existing programmatic Cocos UI.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript ES modules, Oops Framework navigation, Node.js built-in test runner.

## Global Constraints

- Reuse the current HUD art and programmatic UI; do not add or regenerate art assets.
- Do not change health, shield, damage, movement, skill, enemy AI, navigation, or battle-map rules.
- Preserve the current joystick and action-button positions and effective touch areas.
- The objective toast stays fully visible for 3.5 seconds and fades for 0.5 seconds, for about 4 seconds total.
- Pausing the battle or opening the full map pauses objective-toast time.
- Ordinary enemy health bars show only when damaged, attacking, or near the player; dead-enemy bars remain hidden.
- Player health and shield continue to read directly from `BattleSimulation` vitality state.
- Support the 1334×750 reference canvas and the existing shorter safe-frame test case.

---

## File Structure

- Create `assets/script/game/battle/BattleHUDPresentation.ts`: pure toast timer and enemy-health-bar visibility rules, with no `cc` imports.
- Create `assets/script/game/battle/BattleHUDPresentation.ts.meta`: Cocos Creator metadata matching the neighboring TypeScript asset format.
- Modify `assets/script/game/battle/BattleHUDLayout.ts`: add pure information-region rectangles while preserving touch-control coordinates.
- Modify `assets/script/game/battle/BattleHUDViewComp.ts`: build the compact HUD, bind presentation rules, and synchronize opacity/visibility.
- Create `tests/unit/ui/BattleHUDPresentation.test.mjs`: deterministic rule tests.
- Modify `tests/unit/ui/BattleHUDLayout.test.mjs`: safe-frame, overlap, and compact-layout assertions.
- Modify `tests/integration/ui/UIViewBindings.test.mjs`: source-level wiring checks for the objective entry and presentation controller.

### Task 1: Pure Objective Toast and Enemy Health-Bar Rules

**Files:**
- Create: `assets/script/game/battle/BattleHUDPresentation.ts`
- Create: `assets/script/game/battle/BattleHUDPresentation.ts.meta`
- Create: `tests/unit/ui/BattleHUDPresentation.test.mjs`

**Interfaces:**
- Produces: `ObjectiveToastController` with `show()`, `hide()`, `toggle()`, `update(deltaTime, paused)`, `visible`, and `opacity`.
- Produces: `shouldShowEnemyHealthBar(input: EnemyHealthBarInput): boolean`.
- Consumes: no Cocos runtime APIs.

- [ ] **Step 1: Write failing objective-toast tests**

Create `tests/unit/ui/BattleHUDPresentation.test.mjs` with deterministic boundary checks:

```js
import assert from "node:assert/strict";
import test from "node:test";

import {
    ObjectiveToastController,
    shouldShowEnemyHealthBar,
} from "../../../assets/script/game/battle/BattleHUDPresentation.ts";

test("objective toast holds, fades, and hides after four seconds", () => {
    const toast = new ObjectiveToastController();
    toast.show();
    toast.update(3.49, false);
    assert.equal(toast.visible, true);
    assert.equal(toast.opacity, 255);

    toast.update(0.26, false);
    assert.equal(toast.visible, true);
    assert.ok(toast.opacity > 0 && toast.opacity < 255);

    toast.update(0.25, false);
    assert.equal(toast.visible, false);
    assert.equal(toast.opacity, 0);
});

test("objective toast toggles and pauses its clock", () => {
    const toast = new ObjectiveToastController();
    toast.show();
    toast.update(3.75, true);
    assert.equal(toast.opacity, 255);
    toast.toggle();
    assert.equal(toast.visible, false);
    toast.toggle();
    assert.equal(toast.visible, true);
    assert.equal(toast.opacity, 255);
});
```

- [ ] **Step 2: Write failing enemy visibility tests**

Append explicit cases for death, damage, attack, distance, and large-enemy distance:

```js
test("enemy health bars appear only for active combat information", () => {
    const base = { state: "active", healthRatio: 1, attacking: false, distance: 900, large: false };
    assert.equal(shouldShowEnemyHealthBar(base), false);
    assert.equal(shouldShowEnemyHealthBar({ ...base, healthRatio: 0.99 }), true);
    assert.equal(shouldShowEnemyHealthBar({ ...base, attacking: true }), true);
    assert.equal(shouldShowEnemyHealthBar({ ...base, distance: 379 }), true);
    assert.equal(shouldShowEnemyHealthBar({ ...base, large: true, distance: 519 }), true);
    assert.equal(shouldShowEnemyHealthBar({ ...base, state: "dead", healthRatio: 0 }), false);
});
```

- [ ] **Step 3: Run the focused test to verify it fails**

Run: `node --test tests/unit/ui/BattleHUDPresentation.test.mjs`

Expected: FAIL because `BattleHUDPresentation.ts` does not exist.

- [ ] **Step 4: Implement the pure presentation module**

Create the module with fixed, named timing and distance thresholds:

```ts
export interface EnemyHealthBarInput {
    state: string;
    healthRatio: number;
    attacking: boolean;
    distance: number;
    large: boolean;
}

const TOAST_HOLD_SECONDS = 3.5;
const TOAST_FADE_SECONDS = 0.5;
const ORDINARY_ENGAGEMENT_DISTANCE = 380;
const LARGE_ENGAGEMENT_DISTANCE = 520;

export class ObjectiveToastController {
    private remaining = 0;

    get visible(): boolean {
        return this.remaining > 0;
    }

    get opacity(): number {
        if (this.remaining <= 0) return 0;
        if (this.remaining >= TOAST_FADE_SECONDS) return 255;
        return Math.round(255 * this.remaining / TOAST_FADE_SECONDS);
    }

    show(): void {
        this.remaining = TOAST_HOLD_SECONDS + TOAST_FADE_SECONDS;
    }

    hide(): void {
        this.remaining = 0;
    }

    toggle(): void {
        if (this.visible) this.hide();
        else this.show();
    }

    update(deltaTime: number, paused: boolean): void {
        if (paused || !Number.isFinite(deltaTime) || deltaTime <= 0) return;
        this.remaining = Math.max(0, this.remaining - deltaTime);
    }
}

export function shouldShowEnemyHealthBar(input: EnemyHealthBarInput): boolean {
    if (input.state === "dead") return false;
    if (input.healthRatio < 0.999 || input.attacking) return true;
    const threshold = input.large ? LARGE_ENGAGEMENT_DISTANCE : ORDINARY_ENGAGEMENT_DISTANCE;
    return Number.isFinite(input.distance) && input.distance <= threshold;
}
```

Create `BattleHUDPresentation.ts.meta` with a distinct asset UUID:

```json
{
  "ver": "4.0.24",
  "importer": "typescript",
  "imported": true,
  "uuid": "b2fcfa71-64db-48c7-96b9-5f84e3e6a219",
  "files": [],
  "subMetas": {},
  "userData": {}
}
```

- [ ] **Step 5: Run the focused tests**

Run: `node --test tests/unit/ui/BattleHUDPresentation.test.mjs`

Expected: 3 tests PASS.

- [ ] **Step 6: Commit the pure presentation rules**

```bash
git add assets/script/game/battle/BattleHUDPresentation.ts assets/script/game/battle/BattleHUDPresentation.ts.meta tests/unit/ui/BattleHUDPresentation.test.mjs
git commit -m "feat: add battle HUD presentation rules"
```

### Task 2: Compact Safe-Frame Layout

**Files:**
- Modify: `assets/script/game/battle/BattleHUDLayout.ts`
- Modify: `tests/unit/ui/BattleHUDLayout.test.mjs`

**Interfaces:**
- Produces: `battleInfoLayout(frame: BattleSafeEdges): BattleInfoLayout`.
- Preserves: `battleControlLayout(frame)` and `rectanglesOverlap(a, b)`.
- Consumed by: Task 3 `BattleHUDViewComp` rendering methods.

- [ ] **Step 1: Add failing layout tests**

Update the import and add safe-frame assertions:

```js
import {
    battleControlLayout,
    battleInfoLayout,
    rectanglesOverlap,
} from "../../../assets/script/game/battle/BattleHUDLayout.ts";

for (const frame of [
    { left: -639, right: 639, top: 347, bottom: -347 },
    { left: -639, right: 639, top: 295, bottom: -295 },
]) {
    test(`compact HUD regions stay inside the safe frame at height ${frame.top - frame.bottom}`, () => {
        const info = battleInfoLayout(frame);
        for (const rect of Object.values(info)) {
            assert.ok(rect.left >= frame.left);
            assert.ok(rect.right <= frame.right);
            assert.ok(rect.bottom >= frame.bottom);
            assert.ok(rect.top <= frame.top);
        }
        assert.equal(rectanglesOverlap(info.dayTimer, info.objectiveButton), false);
        assert.equal(rectanglesOverlap(info.minimap, info.returnArk), false);
        assert.ok(info.playerStatus.width <= 320);
        assert.ok(info.minimap.width <= 168);
    });
}
```

- [ ] **Step 2: Run the layout test to verify it fails**

Run: `node --test tests/unit/ui/BattleHUDLayout.test.mjs`

Expected: FAIL because `battleInfoLayout` is not exported.

- [ ] **Step 3: Add information-layout types and coordinates**

Add this interface and function beside the existing control layout:

```ts
export interface BattleInfoLayout {
    playerStatus: LayoutRect;
    dayTimer: LayoutRect;
    objectiveButton: LayoutRect;
    minimap: LayoutRect;
    returnArk: LayoutRect;
    objectiveToast: LayoutRect;
}

export function battleInfoLayout(frame: BattleSafeEdges): BattleInfoLayout {
    return {
        playerStatus: centeredRect(frame.left + 160, frame.top - 69, 320, 138),
        dayTimer: centeredRect(0, frame.top - 46, 280, 92),
        objectiveButton: centeredRect(188, frame.top - 46, 74, 44),
        minimap: centeredRect(frame.right - 84, frame.top - 84, 168, 168),
        returnArk: centeredRect(frame.right - 62, frame.top - 201, 124, 52),
        objectiveToast: centeredRect(0, frame.bottom + 44, 500, 58),
    };
}
```

Change `battleControlLayout(frame).returnArk` to use the same compact 124×52 rectangle at `frame.right - 62, frame.top - 201`, so existing callers and overlap tests stay consistent until Task 3 migrates rendering to `battleInfoLayout`.

- [ ] **Step 4: Run layout tests**

Run: `node --test tests/unit/ui/BattleHUDLayout.test.mjs`

Expected: all tests PASS for both safe-frame heights.

- [ ] **Step 5: Commit the compact layout**

```bash
git add assets/script/game/battle/BattleHUDLayout.ts tests/unit/ui/BattleHUDLayout.test.mjs
git commit -m "feat: define compact battle HUD layout"
```

### Task 3: Bind the Compact Player, Timer, Map, and Objective HUD

**Files:**
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Modify: `tests/integration/ui/UIViewBindings.test.mjs`

**Interfaces:**
- Consumes: `battleInfoLayout(frame)` from Task 2.
- Consumes: `ObjectiveToastController` from Task 1.
- Preserves: current pause overlay, full map, return confirmation, joystick, sprint, skill, and dodge bindings.

- [ ] **Step 1: Add failing source-wiring checks**

Append a focused integration test:

```js
test("Battle HUD exposes a compact on-demand objective flow", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /ObjectiveToastController/);
    assert.match(source, /BtnObjective/);
    assert.match(source, /objectiveToast\.toggle\(\)/);
    assert.match(source, /UIOpacity/);
    assert.doesNotMatch(source, /当前目标 · 搜索医院物资并撤离  \|/);
});
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `node --test tests/integration/ui/UIViewBindings.test.mjs`

Expected: FAIL because the view has not imported or bound the presentation controller.

- [ ] **Step 3: Add objective and danger-state fields**

Import `battleInfoLayout` and `ObjectiveToastController`, then add these fields:

```ts
private readonly objectiveToast = new ObjectiveToastController();
private objectiveToastNode!: Node;
private objectiveToastOpacity!: UIOpacity;
private objectiveText!: Label;
private objectiveTutorialText!: Label;
private objectiveTutorialPending = true;
private lowHealthPulseTime = 0;
```

In `render()`, keep the existing construction order but call `this.objectiveToast.show()` after `renderObjective(this.frame)` so the entry toast starts at full opacity.

- [ ] **Step 4: Rebuild the player-status hierarchy**

Use `battleInfoLayout(frame).playerStatus` for the plate. Build a 320×138 plate, a 242×30 red health bar at `(22, 30)`, a 216×18 cyan shield bar at `(35, -7)`, a 30-pixel health icon at `(-136, 31)`, and a compact pollution icon/text row at `(-76, -45)`. Place `HealthText` inside the health bar so its value remains the dominant label.

Move `DownedText` out of the player plate onto `this.node` at `(0, 34)`, size 300×64, font size 34, danger color. Keep it inactive until the vitality state is `downed`.

In `update(deltaTime)`, advance `lowHealthPulseTime` by `Math.max(0, Math.min(deltaTime, 0.1))`. In `syncVitality()`, continue using the existing vitality values. Add a low-health pulse only when `0 < healthRatio <= 0.25` by assigning `Math.round(222.5 + Math.sin(this.lowHealthPulseTime * 6) * 32.5)` to `playerHealthBar.getComponent(UIOpacity)!.opacity`; otherwise reset it to 255. Add `UIOpacity` to the health bar at creation.

- [ ] **Step 5: Compact the timer, minimap, pause, and return entry**

Use the `dayTimer`, `minimap`, and `returnArk` rectangles from `battleInfoLayout(frame)`:

- timer: 280×92, time font 25, stage font 14, progress 210×14;
- minimap: 168×168, map canvas 122×72, pause button 60×54, distance font 14;
- return entry: 124×52 using `UIBuilder.navButton`, with text `撤离` and the existing ark-return icon.

Update calls to `drawDynamicMap` and map-canvas sizes from 142×82 to 122×72. Preserve full-map dimensions and behavior.

- [ ] **Step 6: Replace the permanent objective plate with a toast and button**

Build a text-only `BtnObjective` surface at the `objectiveButton` rectangle and bind it:

```ts
const objectiveButton = UIBuilder.surface(
    this.node,
    "BtnObjective",
    new Size(info.objectiveButton.width, info.objectiveButton.height),
    new Vec3(info.objectiveButton.centerX, info.objectiveButton.centerY),
    "secondary",
);
UIBuilder.label(objectiveButton, "BtnObjectiveLabel", "目标", new Size(58, 30), Vec3.ZERO, 16, UI_THEME.colors.orange);
this.bindTouch(objectiveButton, () => this.toggleObjectiveToast());
```

Create `ObjectiveToast` from `info.objectiveToast`, attach `UIOpacity`, and use two labels: `搜索医院物资并撤离` as the dominant objective and `WASD / 摇杆移动 · 点击地面寻路` as a smaller muted tutorial line. Keep the tutorial line only for the initial in-battle show; when the player reopens the toast, hide the tutorial label.

Add an explicit interaction method so later target-update code can call `showObjectiveToast(newText)` without rebuilding the node:

```ts
private showObjectiveToast(text: string): void {
    this.objectiveText.string = text;
    this.objectiveTutorialPending = false;
    this.objectiveTutorialText.node.active = false;
    this.objectiveToast.show();
}

private toggleObjectiveToast(): void {
    this.objectiveTutorialPending = false;
    this.objectiveTutorialText.node.active = false;
    this.objectiveToast.toggle();
}
```

Add `syncObjectiveToast(deltaTime)`:

```ts
private syncObjectiveToast(deltaTime: number): void {
    const clockPaused = this.paused || this.fullMapPanel?.active;
    this.objectiveToast.update(deltaTime, clockPaused);
    this.objectiveToastNode.active = this.objectiveToast.visible;
    this.objectiveToastOpacity.opacity = this.objectiveToast.opacity;
    if (!this.objectiveToast.visible && this.objectiveTutorialPending) {
        this.objectiveTutorialPending = false;
        this.objectiveTutorialText.node.active = false;
    }
}
```

Call it at the beginning of `update(deltaTime)` before the early return, so paused/full-map frames preserve visibility without advancing the timer. Set the tutorial label inactive the first time the initial toast finishes, and keep it inactive on later button-driven shows.

- [ ] **Step 7: Run focused UI tests and TypeScript checking**

Run:

```bash
node --test tests/unit/ui/BattleHUDPresentation.test.mjs tests/unit/ui/BattleHUDLayout.test.mjs tests/integration/ui/UIViewBindings.test.mjs
npx tsc --noEmit
```

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 8: Commit the compact information HUD**

```bash
git add assets/script/game/battle/BattleHUDViewComp.ts tests/integration/ui/UIViewBindings.test.mjs
git commit -m "feat: clarify battle HUD information hierarchy"
```

### Task 4: Bind Contextual Enemy Health Bars and Finish Visual Hierarchy

**Files:**
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Modify: `tests/integration/ui/UIViewBindings.test.mjs`

**Interfaces:**
- Consumes: `shouldShowEnemyHealthBar()` from Task 1.
- Consumes: live `EnemyAgent` vitality, attack state, and player/enemy positions from `BattleSimulation`.
- Preserves: actor node death visibility and existing vitality ratios.

- [ ] **Step 1: Add failing contextual-health-bar binding checks**

Extend the Battle HUD integration test:

```js
assert.match(source, /shouldShowEnemyHealthBar/);
assert.match(source, /Math\.hypot\(enemy\.x - this\.simulation\.player\.x/);
assert.match(source, /large: index === 3/);
```

- [ ] **Step 2: Run the integration test to verify it fails**

Run: `node --test tests/integration/ui/UIViewBindings.test.mjs`

Expected: FAIL because `syncVitality()` does not yet call `shouldShowEnemyHealthBar()`.

- [ ] **Step 3: Strengthen world-space bar construction**

Keep ordinary bars at 104 pixels wide and the existing large-enemy bar at 156 pixels wide, but increase ordinary height to 20 and large height to 24. Keep the dark track and stroke supplied by `UIBuilder.progressBar`; position bars high enough to clear each actor sprite. Add `UIOpacity` to each track for future transitions, but use immediate active/inactive changes in this scope.

Lower the unimplemented `SkillAction` node opacity to 165 with `UIOpacity`, while leaving its node size and touch footprint unchanged. Keep the primary and dodge actions at full opacity.

- [ ] **Step 4: Apply the contextual visibility rule during vitality sync**

Import `shouldShowEnemyHealthBar` and update the enemy loop:

```ts
const distance = Math.hypot(
    enemy.x - this.simulation.player.x,
    enemy.y - this.simulation.player.y,
);
healthBar.active = shouldShowEnemyHealthBar({
    state: enemy.vitality.state,
    healthRatio: enemy.vitality.healthRatio,
    attacking: enemy.attacking,
    distance,
    large: index === 3,
});
```

Continue setting the actor node inactive when `state === "dead"`, and continue calling `UIBuilder.setProgressBarRatio` so an active bar always reflects live vitality.

- [ ] **Step 5: Run the complete test suites and type checking**

Run:

```bash
npm run test:battle
npm run test:ui
npx tsc --noEmit
```

Expected: both npm test commands report zero failures and TypeScript exits 0.

- [ ] **Step 6: Perform editor visual and interaction verification**

Open the Cocos Creator 3.8.8 project and verify the battle page at the 1334×750 design size and a shorter safe frame:

1. Player health is the first readable item in the upper-left plate.
2. Shield and pollution remain readable without competing with health.
3. The objective toast is fully visible on entry, starts fading after 3.5 seconds, and is gone around 4 seconds.
4. Clicking `目标` reopens the objective without repeating the teaching line; clicking again closes it.
5. Pause and full-map display stop the toast clock until battle resumes.
6. Full-health distant ordinary-enemy bars are hidden; nearby, attacking, or damaged-enemy bars are visible over the hospital background.
7. Dead enemy actors and bars are hidden.
8. Minimap, pause, evacuation confirmation, joystick, sprint, skill, dodge, pathfinding, and full-map controls still respond.

- [ ] **Step 7: Commit contextual bars and final polish**

```bash
git add assets/script/game/battle/BattleHUDViewComp.ts tests/integration/ui/UIViewBindings.test.mjs
git commit -m "feat: show battle health bars contextually"
```

### Task 5: Final Regression and Documentation Check

**Files:**
- Verify: `docs/superpowers/specs/2026-11-08-battle-hud-clarity-design.md`
- Verify: all files changed in Tasks 1–4.

**Interfaces:**
- Consumes: all earlier task outputs.
- Produces: verified, review-ready battle HUD implementation.

- [ ] **Step 1: Check formatting and unintended changes**

Run:

```bash
git diff --check
git status --short
git diff --stat HEAD~4..HEAD
```

Expected: no whitespace errors; only the planned battle HUD source, metadata, tests, design, and plan files are present.

- [ ] **Step 2: Run the final verification commands once more**

Run:

```bash
npm run test:battle
npm run test:ui
npx tsc --noEmit
```

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 3: Compare implementation against every completion criterion**

Confirm from code and editor evidence that the four-tier information hierarchy is implemented, objective/tutorial content is not permanent, contextual enemy bars are readable, the objective entry is usable, combat rules are unchanged, and navigation/input flows still work.

- [ ] **Step 4: Prepare the handoff summary**

Report the compact layout changes, the exact objective timing behavior, contextual enemy-bar rules, tests executed, and any editor-only checks that could not be run in the current environment. Do not claim editor verification unless it was actually performed.
