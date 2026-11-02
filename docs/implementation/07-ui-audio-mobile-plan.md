# UI、音频、引导与移动端 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 实现事件驱动 HUD、方舟管理界面、响应式安全区、触控设置、音频提示、自适应音乐、新手引导和后台恢复。

**Architecture:** UI 组件通过 oops.message 订阅领域事件，不逐帧轮询完整状态。ScreenStack 管理覆盖界面；AudioCueService 把游戏事件映射到 oops.audio；TutorialDirector 读取配置决定当日教学门槛。

**Tech Stack:** Cocos Creator 3.8.8 UI、Oops GUI、Oops Audio、TypeScript、Vitest。

## Global Constraints

- 参考分辨率 1334×750，支持 16:9 至 20:9。
- 关键按钮不小于 72×72 设计单位。
- 关键状态不能只依赖红绿颜色。
- 所有事件订阅必须在 onDestroy 或 onRemoved 中解除。
- 音频源必须通过 Oops AudioManager，不能绕过用户音量设置。

---

## File Structure

- Create: assets/script/game/common/ui/ScreenStack.ts
- Create: assets/script/game/common/ui/SafeAreaAdapter.ts
- Create: assets/script/game/battle/view/BattleHudViewComp.ts
- Create: assets/script/game/world/view/ExploreHudViewComp.ts
- Create: assets/script/game/shelter/view/ArkViewComp.ts
- Create: assets/script/game/bag/view/InventoryViewComp.ts
- Create: assets/script/game/bag/view/EquipmentComparisonPresenter.ts
- Create: assets/script/game/common/audio/AudioCueService.ts
- Create: assets/script/game/initialize/TutorialDirector.ts
- Create: assets/bundle/config/game/TutorialSteps.json
- Modify: assets/script/game/common/config/GameUIConfig.ts
- Modify: assets/script/game/common/config/GameEvent.ts
- Create in Creator: HUD and management prefabs under assets/bundle/gui
- Test: tests/unit/ui/ScreenStack.test.ts
- Test: tests/unit/initialize/TutorialDirector.test.ts
- Test: tests/unit/audio/AudioCueService.test.ts

### Task 1: 界面栈与返回逻辑

**Files:**
- Create: assets/script/game/common/ui/ScreenStack.ts
- Test: tests/unit/ui/ScreenStack.test.ts

**Interfaces:**
- Produces: ScreenStack.push(id)、pop()、top()、clearTransient()。

- [ ] **Step 1: 写失败测试**

    it("back closes only the top overlay", () => {
      const stack = new ScreenStack("battle_hud");
      stack.push("inventory");
      stack.push("confirm_dialog");
      expect(stack.pop()).toBe("confirm_dialog");
      expect(stack.top()).toBe("inventory");
    });

    Run: yarn test tests/unit/ui/ScreenStack.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现界面栈**

    export class ScreenStack {
      private values: string[];
      constructor(base: string) { this.values = [base]; }
      push(id: string): void {
        if (this.top() !== id) this.values.push(id);
      }
      pop(): string | null {
        if (this.values.length === 1) return null;
        return this.values.pop() ?? null;
      }
      top(): string { return this.values[this.values.length - 1]; }
      clearTransient(): void { this.values.splice(1); }
    }

- [ ] **Step 3: 测试并提交**

    Run: yarn test tests/unit/ui/ScreenStack.test.ts
    Expected: PASS.

    git add assets/script/game/common/ui/ScreenStack.ts tests/unit/ui/ScreenStack.test.ts
    git commit -m "feat: manage UI overlays with a screen stack"

### Task 2: 响应式安全区

**Files:**
- Create: assets/script/game/common/ui/SafeAreaAdapter.ts
- Create in Creator: assets/bundle/gui/common/safe-area-root.prefab

**Interfaces:**
- Produces: SafeAreaAdapter.apply()。

- [ ] **Step 1: 创建安全区组件**

    import { _decorator, Component, screen, UITransform, view } from "cc";
    const { ccclass } = _decorator;

    @ccclass("SafeAreaAdapter")
    export class SafeAreaAdapter extends Component {
      onEnable(): void { this.apply(); }
      apply(): void {
        const visible = view.getVisibleSize();
        const safe = screen.safeArea;
        const transform = this.getComponent(UITransform)!;
        transform.setContentSize(
          visible.width * safe.width / screen.windowSize.width,
          visible.height * safe.height / screen.windowSize.height
        );
      }
    }

- [ ] **Step 2: 创建安全区根预制体**

    Create SafeAreaRoot with edge-anchored containers for top-left, top-center, top-right, bottom-left and bottom-right. Attach SafeAreaAdapter. Place a 72×72 test button in every bottom corner.

- [ ] **Step 3: 分辨率验收**

    Preview at 1334×750, 1600×720, 1920×1080 and 2400×1080.
    Expected: corner buttons remain inside the visible safe area; center dialogs keep a fixed maximum width; no critical HUD overlaps.

- [ ] **Step 4: 提交**

    git add assets/script/game/common/ui/SafeAreaAdapter.ts assets/bundle/gui/common
    git commit -m "feat: adapt UI to mobile safe areas"

### Task 3: 探索与防守 HUD

**Files:**
- Create: assets/script/game/world/view/ExploreHudViewComp.ts
- Create: assets/script/game/battle/view/BattleHudViewComp.ts
- Modify: assets/script/game/common/config/GameUIConfig.ts
- Create in Creator: assets/bundle/gui/world/explore-hud.prefab
- Modify in Creator: assets/bundle/gui/battle/battle.prefab

**Interfaces:**
- Consumes: DayTimeChanged、DayPressureChanged、RoleHealthChanged、WeaponStateChanged、ArkPowerChanged、ArkModuleDamaged、HordeWaveChanged。

- [ ] **Step 1: 增加 UI ID**

    ExploreHud,
    ArkManagement,
    Inventory,
    Research,
    SurvivorRoster,
    Pause,

- [ ] **Step 2: 创建事件驱动探索 HUD**

    onLoad(): void {
      oops.message.on(GameEvent.DayTimeChanged, this.onTimeChanged, this);
      oops.message.on(GameEvent.DayPressureChanged, this.onPressureChanged, this);
      oops.message.on(GameEvent.RoleHealthChanged, this.onHealthChanged, this);
    }

    onDestroy(): void {
      oops.message.off(GameEvent.DayTimeChanged, this.onTimeChanged, this);
      oops.message.off(GameEvent.DayPressureChanged, this.onPressureChanged, this);
      oops.message.off(GameEvent.RoleHealthChanged, this.onHealthChanged, this);
    }

- [ ] **Step 3: 创建事件驱动防守 HUD**

    Subscribe to ArkModuleDamaged and keep a sorted list of the three lowest durability ratios. Subscribe to HordeWaveChanged for warning, probe, assault, respite, climax and cleanup labels.

- [ ] **Step 4: Creator 验收**

    Use debug events to set health, pollution, day pressure, weapon reload, three damaged modules and every horde phase.
    Expected: only changed widgets update; destroyed HUD nodes produce no callback; ordinary monsters show no permanent health bar.

- [ ] **Step 5: 回归与提交**

    Run: yarn test && yarn typecheck:test
    Expected: all tests pass.

    git add assets/script/game/world/view assets/script/game/battle/view assets/script/game/common/config/GameUIConfig.ts assets/bundle/gui
    git commit -m "feat: add event-driven exploration and defense HUD"

### Task 4: 方舟、背包与装备管理界面

**Files:**
- Create: assets/script/game/shelter/view/ArkViewComp.ts
- Create: assets/script/game/bag/view/InventoryViewComp.ts
- Create in Creator: assets/bundle/gui/ark/ark-management.prefab
- Create in Creator: assets/bundle/gui/bag/inventory.prefab

**Interfaces:**
- Consumes: BagModule、ArkModule。
- Produces: placement commands、equip commands、craft commands。

- [ ] **Step 1: 实现方舟视图命令边界**

    onDropModule(instanceId: string, slotId: string): void {
      const result = this.ark.place(instanceId, slotId);
      if (!result.ok) {
        this.showPlacementError(result.error);
        return;
      }
      this.refreshPreview();
    }

- [ ] **Step 2: 实现装备比较视图**

    function formatDelta(value: number): string {
      if (value === 0) return "—";
      return (value > 0 ? "+" : "") + value.toFixed(1);
    }

    function describeResonanceChange(currentTags: string[], candidateTags: string[]): string {
      const current = new Set(currentTags);
      const added = candidateTags.filter(tag => !current.has(tag));
      return added.length > 0 ? "新增：" + added.join("、") : "共鸣不变";
    }

    renderComparison(current: EquipmentViewModel, candidate: EquipmentViewModel): void {
      this.coreTrait.string = candidate.coreTrait;
      this.damageDelta.string = formatDelta(candidate.damage - current.damage);
      this.resonanceDelta.string = describeResonanceChange(current.tags, candidate.tags);
    }

- [ ] **Step 3: Creator 触控验收**

    Drag a module near every valid and invalid slot; compare, equip, favorite and dismantle equipment; resize UI to 125% and 150%.
    Expected: drag snaps within tolerance; errors use icon plus text; protected items remain unavailable to batch dismantle; no panel clips at 150%.

- [ ] **Step 4: 提交**

    git add assets/script/game/shelter/view assets/script/game/bag/view assets/bundle/gui/ark assets/bundle/gui/bag
    git commit -m "feat: add ark and inventory management UI"

### Task 5: 音频提示与自适应音乐

**Files:**
- Create: assets/script/game/common/audio/AudioCueService.ts
- Create: assets/bundle/config/game/AudioCues.json
- Test: tests/unit/audio/AudioCueService.test.ts

**Interfaces:**
- Produces: AudioCueService.handle(event, payload)、setMusicIntensity(level)。

- [ ] **Step 1: 写失败测试**

    it("rate limits repeated ark damage warnings", () => {
      const played: string[] = [];
      const service = new AudioCueService(
        path => played.push(path),
        () => 100,
        {
          ark_damage_critical: {
            paths: ["audio/ui/ark-critical"],
            cooldownMs: 3000
          }
        }
      );
      service.handle("ark_damage_critical");
      service.handle("ark_damage_critical");
      expect(played).toEqual(["audio/ui/ark-critical"]);
    });

    Run: yarn test tests/unit/audio/AudioCueService.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现提示冷却与变体**

    export class AudioCueService {
      private lastPlayed = new Map<string, number>();
      constructor(
        private play: (path: string) => void,
        private now: () => number,
        private cues: Record<string, { paths: string[]; cooldownMs: number }>
      ) {}
      handle(cueId: string): void {
        const cue = this.cues[cueId];
        if (!cue) return;
        const last = this.lastPlayed.get(cueId) ?? -Infinity;
        if (this.now() - last < cue.cooldownMs) return;
        this.lastPlayed.set(cueId, this.now());
        this.play(cue.paths[0]);
      }
    }

- [ ] **Step 3: 绑定 Oops AudioManager**

    const audioCues = new AudioCueService(
      path => { void oops.audio.playEffect(path, { bundle: "bundle" }); },
      () => Date.now(),
      audioCueConfig
    );

    Route exploration, warning, night and boss music through oops.audio.playMusic. Switch layers or stems only at configured musical boundaries.

- [ ] **Step 4: 混音验收**

    Test headphones and phone speaker during exploration, full horde, dialogue and boss stagger.
    Expected: special warnings remain audible; repeated gunfire does not clip; voice ducks music without changing the saved music slider.

- [ ] **Step 5: 测试并提交**

    Run: yarn test tests/unit/audio/AudioCueService.test.ts
    Expected: PASS.

    git add assets/script/game/common/audio assets/bundle/config/game/AudioCues.json tests/unit/audio
    git commit -m "feat: add event-driven game audio cues"

### Task 6: 新手引导与后台恢复

**Files:**
- Create: assets/script/game/initialize/TutorialDirector.ts
- Create: assets/bundle/config/game/TutorialSteps.json
- Modify: assets/script/game/initialize/Initialize.ts:1-27
- Test: tests/unit/initialize/TutorialDirector.test.ts

**Interfaces:**
- Produces: nextStep(context)、complete(stepId)、handleAppHide()、handleAppShow()。

- [ ] **Step 1: 写失败测试**

    it("shows only the first incomplete eligible step", () => {
      const director = new TutorialDirector([
        { id: "move", day: 1, requires: [] },
        { id: "return", day: 1, requires: ["move"] }
      ]);
      expect(director.nextStep({ day: 1 })).toBe("move");
      director.complete("move");
      expect(director.nextStep({ day: 1 })).toBe("return");
    });

    Run: yarn test tests/unit/initialize/TutorialDirector.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现有前置的教学导演**

    export class TutorialDirector {
      private completed = new Set<string>();
      constructor(private steps: TutorialStep[]) {}
      complete(id: string): void { this.completed.add(id); }
      nextStep(context: { day: number }): string | null {
        const step = this.steps.find(x =>
          x.day <= context.day &&
          !this.completed.has(x.id) &&
          x.requires.every(id => this.completed.has(id))
        );
        return step?.id ?? null;
      }
    }

- [ ] **Step 3: 接入应用隐藏与显示事件**

    On GAME_HIDE: pause the current clock, write the recovery snapshot and mute or pause audio.
    On GAME_SHOW: keep the game paused, restore audio state and show a resume overlay.

- [ ] **Step 4: 真机中断验收**

    During day exploration and night defense, background the app for 30 seconds and return.
    Expected: no game time passes; resume overlay appears; state matches the recovery snapshot; audio resumes once.

- [ ] **Step 5: 回归与提交**

    Run: yarn test && yarn typecheck:test
    Expected: all tests pass.

    git add assets/script/game/initialize assets/bundle/config/game/TutorialSteps.json tests/unit/initialize
    git commit -m "feat: add progressive tutorial and app recovery"

## Plan Completion Gate

Verify four aspect ratios, three UI scales, two joystick modes, every audio slider, subtitles, reduced flashes, background recovery and the first three tutorial days. No HUD event may fire after its view is destroyed.
