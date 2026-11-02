# 世界、昼夜与探索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 实现章节日钟、动态区域状态、地点搜刮、事件、背包取舍、日落警戒和紧急撤离。

**Architecture:** DayClock 和 WorldState 作为纯规则状态；WorldModule 负责场景加载、阶段转换和存档同步；WorldController 只绑定 Cocos 触发器、地图节点与表现。

**Tech Stack:** TypeScript、Vitest、Cocos Creator 3.8.8、Oops Framework。

## Global Constraints

- 白昼基础时长 6–8 分钟，测试使用可注入时长。
- 菜单时间倍率与系统暂停分离。
- 主线关键物品不因紧急撤离丢失。
- 地图主体手工设计，动态变化由配置控制。

---

## File Structure

- Create: assets/script/game/world/model/DayClock.ts
- Create: assets/script/game/world/model/WorldState.ts
- Create: assets/script/game/world/model/LootResolver.ts
- Create: assets/script/game/world/model/ExtractionResolver.ts
- Create: assets/script/game/world/WorldController.ts
- Modify: assets/script/game/world/WorldModule.ts
- Create in Creator: assets/bundle/game/world/gray-harbor-day.prefab
- Test: tests/unit/world/DayClock.test.ts
- Test: tests/unit/world/WorldState.test.ts
- Test: tests/unit/world/ExtractionResolver.test.ts

### Task 1: 日钟与警戒阶段

**Files:**
- Create: assets/script/game/world/model/DayClock.ts
- Test: tests/unit/world/DayClock.test.ts

**Interfaces:**
- Produces: DayPressure、DayClock.tick(realDt, timeScale)、remaining、pressure。

- [ ] **Step 1: 写失败测试**

    import { describe, expect, it } from "vitest";
    import { DayClock } from "../../../assets/script/game/world/model/DayClock";

    describe("DayClock", () => {
      it("moves through warning, night and hunt thresholds", () => {
        const clock = new DayClock(480, 120, 0, -60);
        clock.tick(360, 1);
        expect(clock.pressure).toBe("warning");
        clock.tick(120, 1);
        expect(clock.pressure).toBe("night");
        clock.tick(60, 1);
        expect(clock.pressure).toBe("hunt");
      });
    });

    Run: yarn test tests/unit/world/DayClock.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现日钟**

    export type DayPressure = "safe" | "warning" | "night" | "hunt";

    export class DayClock {
      remaining: number;
      constructor(
        duration: number,
        private warningAt: number,
        private nightAt: number,
        private huntAt: number
      ) {
        this.remaining = duration;
      }
      tick(realDt: number, timeScale: number): void {
        this.remaining -= realDt * timeScale;
      }
      get pressure(): DayPressure {
        if (this.remaining <= this.huntAt) return "hunt";
        if (this.remaining <= this.nightAt) return "night";
        if (this.remaining <= this.warningAt) return "warning";
        return "safe";
      }
    }

- [ ] **Step 3: 增加菜单倍率测试并提交**

    Verify tick(10, 0.2) consumes 2 seconds and tick(10, 0) consumes zero.

    Run: yarn test tests/unit/world/DayClock.test.ts
    Expected: PASS.

    git add assets/script/game/world/model/DayClock.ts tests/unit/world/DayClock.test.ts
    git commit -m "feat: add day pressure clock"

### Task 2: 动态区域状态

**Files:**
- Create: assets/script/game/world/model/WorldState.ts
- Test: tests/unit/world/WorldState.test.ts

**Interfaces:**
- Produces: RegionState、WorldState.apply(change)、getRegion(id)。

- [ ] **Step 1: 写失败测试**

    it("persists a cleared nest and repaired power station", () => {
      const world = new WorldState();
      world.apply({ type: "nest_cleared", regionId: "hospital" });
      world.apply({ type: "facility_repaired", regionId: "hospital", facilityId: "power" });
      expect(world.getRegion("hospital")).toEqual({
        nestCleared: true,
        escapedSpecials: 0,
        facilities: ["power"],
        noise: 0
      });
    });

    Run: yarn test tests/unit/world/WorldState.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现显式变更联合类型**

    export interface RegionState {
      nestCleared: boolean;
      escapedSpecials: number;
      facilities: string[];
      noise: number;
    }

    export type WorldChange =
      | { type: "nest_cleared"; regionId: string }
      | { type: "facility_repaired"; regionId: string; facilityId: string }
      | { type: "special_escaped"; regionId: string }
      | { type: "noise_added"; regionId: string; amount: number };

    export class WorldState {
      private regions: Record<string, RegionState> = {};
      getRegion(id: string): RegionState {
        return this.regions[id] ?? { nestCleared: false, escapedSpecials: 0, facilities: [], noise: 0 };
      }
      apply(change: WorldChange): void {
        const next = { ...this.getRegion(change.regionId) };
        if (change.type === "nest_cleared") next.nestCleared = true;
        if (change.type === "facility_repaired") next.facilities = [...new Set([...next.facilities, change.facilityId])];
        if (change.type === "special_escaped") next.escapedSpecials += 1;
        if (change.type === "noise_added") next.noise += change.amount;
        this.regions[change.regionId] = next;
      }
    }

- [ ] **Step 3: 运行测试并提交**

    Run: yarn test tests/unit/world/WorldState.test.ts
    Expected: PASS.

    git add assets/script/game/world/model/WorldState.ts tests/unit/world/WorldState.test.ts
    git commit -m "feat: persist dynamic world state"

### Task 3: 搜刮与撤离损失

**Files:**
- Create: assets/script/game/world/model/LootResolver.ts
- Create: assets/script/game/world/model/ExtractionResolver.ts
- Test: tests/unit/world/ExtractionResolver.test.ts

**Interfaces:**
- Produces: rollLoot(table, rng)、resolveEmergencyExtraction(items, rng)。

- [ ] **Step 1: 写失败测试**

    it("never loses protected key items during emergency extraction", () => {
      const result = resolveEmergencyExtraction([
        { instanceId: "a", itemId: "item_scrap", protected: false },
        { instanceId: "b", itemId: "blueprint_rifle", protected: true }
      ], () => 0);
      expect(result.kept.map(x => x.itemId)).toContain("blueprint_rifle");
      expect(result.lost.map(x => x.itemId)).not.toContain("blueprint_rifle");
    });

    Run: yarn test tests/unit/world/ExtractionResolver.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现可注入随机源的撤离**

    export interface CarriedItem {
      instanceId: string;
      itemId: string;
      protected: boolean;
    }

    export function resolveEmergencyExtraction(
      items: CarriedItem[],
      rng: () => number,
      lossChance = 0.35
    ): { kept: CarriedItem[]; lost: CarriedItem[] } {
      const kept: CarriedItem[] = [];
      const lost: CarriedItem[] = [];
      for (const item of items) {
        if (!item.protected && rng() < lossChance) lost.push(item);
        else kept.push(item);
      }
      return { kept, lost };
    }

- [ ] **Step 3: 实现权重掉落**

    export interface LootEntry {
      itemId: string;
      weight: number;
    }

    export function rollLoot(entries: LootEntry[], rng: () => number): string {
      const total = entries.reduce((sum, x) => sum + x.weight, 0);
      let cursor = rng() * total;
      for (const entry of entries) {
        cursor -= entry.weight;
        if (cursor <= 0) return entry.itemId;
      }
      return entries[entries.length - 1].itemId;
    }

- [ ] **Step 4: 测试并提交**

    Run: yarn test tests/unit/world
    Expected: all world tests pass.

    git add assets/script/game/world/model tests/unit/world
    git commit -m "feat: resolve exploration loot and extraction"

### Task 4: Cocos 世界场景与阶段集成

**Files:**
- Create: assets/script/game/world/WorldController.ts
- Modify: assets/script/game/world/WorldModule.ts:1-3
- Modify: assets/script/game/common/config/GameEvent.ts
- Create in Creator: assets/bundle/game/world/gray-harbor-day.prefab

**Interfaces:**
- Produces: WorldModule.startDay(config)、pauseForMenu()、resumeFromMenu()、extract(mode)。

- [ ] **Step 1: 增加世界事件**

    DayTimeChanged = "DayTimeChanged",
    DayPressureChanged = "DayPressureChanged",
    RegionStateChanged = "RegionStateChanged",
    ExtractionStarted = "ExtractionStarted",
    DayReturned = "DayReturned",

- [ ] **Step 2: 实现 WorldModule 的阶段所有权**

    export class WorldModule {
      private clock: DayClock | null = null;
      startDay(seconds: number): void { this.clock = new DayClock(seconds, 120, 0, -60); }
      tick(dt: number, timeScale: number): void {
        if (!this.clock) return;
        this.clock.tick(dt, timeScale);
        oops.message.dispatchEvent(GameEvent.DayTimeChanged, this.clock.remaining);
      }
    }

- [ ] **Step 3: 在 Creator 创建灰盒地图**

    Create a horizontal main road, hospital branch, rooftop branch, underground shortcut, Ark return trigger and three loot containers. Attach WorldController to the root and assign trigger IDs matching configuration.

- [ ] **Step 4: 手动验收**

    Run a 120-second accelerated test day.
    Open inventory for ten real seconds.
    Expected: clock consumes two game seconds at menu scale 0.2.
    Return normally once and use emergency extraction once.
    Expected: key items remain; region changes persist after preview restart.

- [ ] **Step 5: 回归与提交**

    Run: yarn test && yarn typecheck:test
    Expected: all tests pass.

    git add assets/script/game/world assets/script/game/common/config/GameEvent.ts assets/bundle/game/world tests/unit/world
    git commit -m "feat: integrate day exploration world"

## Plan Completion Gate

Complete normal return, late return and emergency extraction using a fixed test seed. Verify time scaling, persistent shortcuts, protected items and save restoration.
