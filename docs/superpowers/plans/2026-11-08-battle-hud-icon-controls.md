# Battle HUD Icon Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the unimplemented skill control from the battle HUD and present every remaining battle action as a high-recognition icon without button text.

**Architecture:** Keep the existing Cocos programmatic HUD and touch bindings in `BattleHUDViewComp`. Centralize semantic battle icon paths in `UIIconAssets.ts`, bundle only the three existing source-library icons missing at runtime, and verify both asset availability and source wiring with Node tests.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript ES modules, Oops Framework UI helpers, Node.js built-in test runner.

## Global Constraints

- Do not implement, bind, load, or display any skill behavior, skill button, skill label, or skill icon.
- Reuse the existing icon library; do not generate or redesign art.
- Sprint uses `attributes-crafting/06-speed`, dodge uses `hud-combat/08-dodge`, and objective uses `map-actions/07-objective-pin`.
- Pause, map, return-Ark, health, shield, pollution, and day-timer continue using their existing runtime icons.
- Functional battle controls are icon-only; do not use text, emoji, or glyph fallbacks inside their buttons.
- Preserve sprint and dodge layout coordinates and effective touch sizes.
- Preserve existing sprint, dodge, map, pause, objective, and return-Ark behavior.
- Do not modify combat values, simulation rules, enemy AI, navigation rules, or unrelated worktree changes.

---

## File Structure

- Modify `assets/script/game/common/ui/UIIconAssets.ts`: add stable semantic icon paths for the battle HUD.
- Add `assets/bundle/gui/ui-icons/hud-combat/08-dodge.png` and `.meta`: runtime dodge icon copied from the existing design library.
- Add `assets/bundle/gui/ui-icons/attributes-crafting.meta`, `attributes-crafting/06-speed.png`, and `.meta`: runtime sprint icon.
- Add `assets/bundle/gui/ui-icons/map-actions.meta`, `map-actions/07-objective-pin.png`, and `.meta`: runtime objective icon.
- Modify `assets/script/game/battle/BattleHUDViewComp.ts`: remove the skill node and use icon-only controls.
- Modify `tests/unit/ui/UIIconAssets.test.mjs`: assert the semantic map and every referenced runtime PNG/meta pair.
- Modify `tests/integration/ui/UIViewBindings.test.mjs`: assert icon-only wiring and the complete absence of skill-control construction.

### Task 1: Register and Bundle Battle HUD Icons

**Files:**
- Modify: `assets/script/game/common/ui/UIIconAssets.ts`
- Add: `assets/bundle/gui/ui-icons/hud-combat/08-dodge.png`
- Add: `assets/bundle/gui/ui-icons/hud-combat/08-dodge.png.meta`
- Add: `assets/bundle/gui/ui-icons/attributes-crafting.meta`
- Add: `assets/bundle/gui/ui-icons/attributes-crafting/06-speed.png`
- Add: `assets/bundle/gui/ui-icons/attributes-crafting/06-speed.png.meta`
- Add: `assets/bundle/gui/ui-icons/map-actions.meta`
- Add: `assets/bundle/gui/ui-icons/map-actions/07-objective-pin.png`
- Add: `assets/bundle/gui/ui-icons/map-actions/07-objective-pin.png.meta`
- Test: `tests/unit/ui/UIIconAssets.test.mjs`

**Interfaces:**
- Produces: `BATTLE_HUD_ICON_ASSETS`, a readonly semantic-path map consumed by `BattleHUDViewComp`.
- Consumes: existing PNGs under `docs/design/assets/ui-icons/icons` and the runtime path convention `assets/bundle/gui/ui-icons/<path>.png`.

- [ ] **Step 1: Write the failing icon-registry test**

Extend `tests/unit/ui/UIIconAssets.test.mjs`:

```js
import { BATTLE_HUD_ICON_ASSETS, FEATURE_ICON_ASSETS } from "../../../assets/script/game/common/ui/UIIconAssets.ts";

test("every battle HUD icon resolves to a bundled PNG and Cocos meta", () => {
    assert.deepEqual(BATTLE_HUD_ICON_ASSETS, {
        health: "hud-combat/01-health",
        shield: "hud-combat/02-shield",
        pollution: "hud-combat/04-pollution",
        dayTimer: "hud-combat/05-day-timer",
        minimap: "hud-combat/06-minimap",
        returnArk: "hud-combat/07-ark-return",
        dodge: "hud-combat/08-dodge",
        sprint: "attributes-crafting/06-speed",
        objective: "map-actions/07-objective-pin",
        pause: "system-nav/10-pause",
        map: "system-nav/01-map",
    });
    for (const assetPath of Object.values(BATTLE_HUD_ICON_ASSETS)) {
        assert.equal(existsSync(`assets/bundle/gui/ui-icons/${assetPath}.png`), true, assetPath);
        assert.equal(existsSync(`assets/bundle/gui/ui-icons/${assetPath}.png.meta`), true, `${assetPath}.meta`);
    }
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `node --test tests/unit/ui/UIIconAssets.test.mjs`

Expected: FAIL because `BATTLE_HUD_ICON_ASSETS` and three runtime icons do not exist.

- [ ] **Step 3: Add the semantic battle icon registry**

Append to `UIIconAssets.ts`:

```ts
export const BATTLE_HUD_ICON_ASSETS = {
    health: "hud-combat/01-health",
    shield: "hud-combat/02-shield",
    pollution: "hud-combat/04-pollution",
    dayTimer: "hud-combat/05-day-timer",
    minimap: "hud-combat/06-minimap",
    returnArk: "hud-combat/07-ark-return",
    dodge: "hud-combat/08-dodge",
    sprint: "attributes-crafting/06-speed",
    objective: "map-actions/07-objective-pin",
    pause: "system-nav/10-pause",
    map: "system-nav/01-map",
} as const;
```

- [ ] **Step 4: Copy the three approved library PNGs into the runtime bundle**

Copy these exact files without transforming pixels:

```text
docs/design/assets/ui-icons/icons/hud-combat/08-dodge.png
  -> assets/bundle/gui/ui-icons/hud-combat/08-dodge.png
docs/design/assets/ui-icons/icons/attributes-crafting/06-speed.png
  -> assets/bundle/gui/ui-icons/attributes-crafting/06-speed.png
docs/design/assets/ui-icons/icons/map-actions/07-objective-pin.png
  -> assets/bundle/gui/ui-icons/map-actions/07-objective-pin.png
```

Create Cocos directory metadata for the two new directories and image metadata for all three files. Give each asset a distinct UUID, use the existing `image`/`texture` importer schema, keep `hasAlpha: true`, and set `minfilter` and `magfilter` to `nearest` for pixel-art sampling.

- [ ] **Step 5: Run the focused test**

Run: `node --test tests/unit/ui/UIIconAssets.test.mjs`

Expected: both feature-icon and battle-icon tests PASS.

- [ ] **Step 6: Commit the registry and runtime assets**

```bash
git add assets/script/game/common/ui/UIIconAssets.ts tests/unit/ui/UIIconAssets.test.mjs assets/bundle/gui/ui-icons/hud-combat/08-dodge.png assets/bundle/gui/ui-icons/hud-combat/08-dodge.png.meta assets/bundle/gui/ui-icons/attributes-crafting.meta assets/bundle/gui/ui-icons/attributes-crafting assets/bundle/gui/ui-icons/map-actions.meta assets/bundle/gui/ui-icons/map-actions
git commit -m "feat: bundle battle HUD action icons"
```

### Task 2: Replace Battle Control Text with Icons and Remove Skill UI

**Files:**
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Test: `tests/integration/ui/UIViewBindings.test.mjs`

**Interfaces:**
- Consumes: `BATTLE_HUD_ICON_ASSETS` from Task 1.
- Preserves: `battleControlLayout(frame).primaryAction` and `.dodgeAction`, sprint touch start/end/cancel, dodge touch activation, map opening, pause opening, objective toggling, and return confirmation.
- Produces: no skill-control node or event binding.

- [ ] **Step 1: Write failing source-wiring checks**

Append to `tests/integration/ui/UIViewBindings.test.mjs`:

```js
test("Battle HUD uses icon-only controls and does not construct a skill control", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /BATTLE_HUD_ICON_ASSETS\.sprint/);
    assert.match(source, /BATTLE_HUD_ICON_ASSETS\.dodge/);
    assert.match(source, /BATTLE_HUD_ICON_ASSETS\.objective/);
    assert.match(source, /BATTLE_HUD_ICON_ASSETS\.pause/);
    assert.match(source, /BATTLE_HUD_ICON_ASSETS\.returnArk/);
    assert.doesNotMatch(source, /"SkillAction"|"SkillGlyph"|"技能"/);
    assert.doesNotMatch(source, /"ActionGlyph"|"DodgeGlyph"|"疾跑"|"翻滚"/);
});
```

- [ ] **Step 2: Run the integration test and verify failure**

Run: `node --test tests/integration/ui/UIViewBindings.test.mjs`

Expected: FAIL because the view still creates text labels and a `SkillAction` node.

- [ ] **Step 3: Import and use semantic icon paths**

Import `BATTLE_HUD_ICON_ASSETS` from `../common/ui/UIIconAssets`. In `renderPlayerStatus`, use `health`, add the existing `shield` and `pollution` icons beside their value rows, and remove no live values. In `renderDayTimer`, use `dayTimer`. In `renderMinimap`, add `minimap` to the visible map plate and use `pause` for the pause entry. In `renderObjective`, add `objective` to the objective surface and use `returnArk` for the return entry. In `renderTouchControls`, use `sprint` and `dodge`.

- [ ] **Step 4: Remove the skill control and make sprint/dodge icon-only**

In `renderTouchControls(frame)`, preserve the existing action plates and touch bindings, but replace labels with icons and delete all `controls.skillAction` construction:

```ts
const action = UIBuilder.hudPlate(
    this.node,
    "PrimaryAction",
    "touch-tutorial/03-action-button-large",
    new Size(primary.width, primary.height),
    new Vec3(primary.centerX, primary.centerY),
);
void UIBuilder.icon(action, BATTLE_HUD_ICON_ASSETS.sprint, 84, Vec3.ZERO);
action.on(Node.EventType.TOUCH_START, this.onSprintStart, this);
action.on(Node.EventType.TOUCH_END, this.onSprintEnd, this);
action.on(Node.EventType.TOUCH_CANCEL, this.onSprintEnd, this);

const dodgeRect = controls.dodgeAction;
const dodge = UIBuilder.hudPlate(
    this.node,
    "DodgeAction",
    "touch-tutorial/04-action-button-medium",
    new Size(dodgeRect.width, dodgeRect.height),
    new Vec3(dodgeRect.centerX, dodgeRect.centerY),
);
void UIBuilder.icon(dodge, BATTLE_HUD_ICON_ASSETS.dodge, 62, Vec3.ZERO);
this.bindTouch(dodge, () => { this.simulation.tryDodge(); });
```

Do not change `battleControlLayout()` coordinates or sizes in this task. Keep the existing `skillAction` rectangle in the pure layout contract because existing layout tests use it to protect safe-area spacing, but the view must not read it or create a node from it.

- [ ] **Step 5: Make the remaining functional entries icon-only**

Use `UIBuilder.icon()` rather than button labels for objective, pause, and return-Ark entries. Keep their existing plate nodes and touch handlers. For the transparent map hit area, keep the hit node and show the minimap icon on the visible map plate rather than adding text. Do not remove health, shield, pollution, day-stage, distance, objective-toast, or status values; the icon-only rule applies to functional buttons, not live HUD data.

- [ ] **Step 6: Run focused tests and type checking**

Run:

```bash
node --test tests/unit/ui/UIIconAssets.test.mjs tests/unit/ui/BattleHUDLayout.test.mjs tests/integration/ui/UIViewBindings.test.mjs
npx tsc --noEmit
```

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 7: Commit the battle view changes**

```bash
git add assets/script/game/battle/BattleHUDViewComp.ts tests/integration/ui/UIViewBindings.test.mjs
git commit -m "feat: use icon-only battle controls"
```

### Task 3: Regression and Visual Verification

**Files:**
- Verify: all files changed in Tasks 1-2.
- Verify: `docs/superpowers/specs/2026-11-08-battle-hud-clarity-design.md`.

**Interfaces:**
- Consumes: the icon registry, bundled assets, and icon-only battle view.
- Produces: a verified battle HUD with no skill presentation or interaction.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
npm run test:battle
npm run test:ui
npx tsc --noEmit
git diff --check
```

Expected: both test commands and TypeScript exit 0; `git diff --check` reports no whitespace errors.

- [ ] **Step 2: Inspect the runtime assets**

Verify the three copied PNGs are 128×128 RGBA with transparent pixels and byte-identical to their approved design-library sources. Confirm every PNG has a `.meta` and both new directories have directory metadata.

- [ ] **Step 3: Perform editor verification when Cocos Creator is available**

At the 1334×750 reference canvas and the shorter safe-frame case, verify:

1. No skill button, skill text, skill icon, or empty skill hit target is visible or interactive.
2. Sprint and dodge remain at their previous coordinates and respond across their full existing touch areas.
3. Sprint, dodge, objective, pause, map, and return-Ark icons are crisp, centered, and recognizable without text.
4. Objective, pause, map, return confirmation, sprint, and dodge behaviors remain unchanged.
5. Health, shield, pollution, day timer, distance, and objective content remain readable.

- [ ] **Step 4: Report the exact verification boundary**

Report automated commands and results. Do not claim Cocos editor visual verification unless it was actually performed.
