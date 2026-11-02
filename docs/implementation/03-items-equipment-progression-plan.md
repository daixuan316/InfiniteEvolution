# 物品、装备、成长与经济 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 实现背包、装备实例、词条、标签共鸣、战斗记忆进化、制造、强化、拆解、货币与天赋。

**Architecture:** Inventory、EquipmentSet、CraftingService 和 ProgressionState 都是纯规则对象。BagModule 与 EvolveModule 持有当前存档映射并发出事件，UI 只提交命令和显示结果。

**Tech Stack:** TypeScript、Vitest、Cocos Creator 3.8.8、Oops Framework。

## Global Constraints

- 任务关键物品不占普通背包格。
- 制造必须先验证输入与产出空间，再原子扣除。
- 高品质装备价值来自特性和进化，不只来自数值。
- 收藏、已装备、方案引用和传说装备默认受批量拆解保护。

---

## File Structure

- Create: assets/script/game/bag/model/ItemTypes.ts
- Create: assets/script/game/bag/model/Inventory.ts
- Create: assets/script/game/bag/model/EquipmentSet.ts
- Create: assets/script/game/evolve/model/AffixResolver.ts
- Create: assets/script/game/evolve/model/CombatMemory.ts
- Create: assets/script/game/evolve/model/ProgressionState.ts
- Create: assets/script/game/bag/CraftingService.ts
- Modify: assets/script/game/bag/BagModule.ts
- Modify: assets/script/game/evolve/EvolveModule.ts
- Test: tests/unit/bag/Inventory.test.ts
- Test: tests/unit/bag/EquipmentSet.test.ts
- Test: tests/unit/bag/CraftingService.test.ts
- Test: tests/unit/evolve/CombatMemory.test.ts
- Test: tests/unit/evolve/ProgressionState.test.ts

### Task 1: 背包堆叠与容量

**Files:**
- Create: assets/script/game/bag/model/ItemTypes.ts
- Create: assets/script/game/bag/model/Inventory.ts
- Test: tests/unit/bag/Inventory.test.ts

**Interfaces:**
- Produces: ItemDefinition、ItemStack、Inventory.add()、remove()、count()、canAddAfterRemoving()。

- [ ] **Step 1: 写失败测试**

    import { describe, expect, it } from "vitest";
    import { Inventory } from "../../../assets/script/game/bag/model/Inventory";

    describe("Inventory", () => {
      it("uses space freed by recipe inputs", () => {
        const bag = new Inventory(1, { wood: 10, plank: 10 });
        bag.add("wood", 3);
        expect(bag.canAddAfterRemoving({ wood: 3 }, "plank", 1)).toBe(true);
      });
    });

    Run: yarn test tests/unit/bag/Inventory.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现背包**

    export interface ItemDefinition {
      id: string;
      maxStack: number;
      keyItem: boolean;
    }

    export interface ItemStack {
      itemId: string;
      amount: number;
    }

    export class Inventory {
      private stacks = new Map<string, number>();
      constructor(readonly capacity: number, private maxStacks: Record<string, number>) {}

      count(id: string): number { return this.stacks.get(id) ?? 0; }
      usedSlots(): number {
        let slots = 0;
        for (const [id, count] of this.stacks) slots += Math.ceil(count / this.maxStacks[id]);
        return slots;
      }
      add(id: string, amount: number): boolean {
        const next = this.count(id) + amount;
        const old = this.stacks.get(id);
        this.stacks.set(id, next);
        if (this.usedSlots() > this.capacity) {
          if (old === undefined) this.stacks.delete(id); else this.stacks.set(id, old);
          return false;
        }
        return true;
      }
      remove(id: string, amount: number): boolean {
        if (this.count(id) < amount) return false;
        const next = this.count(id) - amount;
        if (next === 0) this.stacks.delete(id); else this.stacks.set(id, next);
        return true;
      }
    }

- [ ] **Step 3: 实现 canAddAfterRemoving 并覆盖失败回滚**

    canAddAfterRemoving(
      inputs: Record<string, number>,
      outputId: string,
      outputAmount: number
    ): boolean {
      const snapshot = new Map(this.stacks);
      for (const [id, amount] of Object.entries(inputs)) {
        if (!this.remove(id, amount)) {
          this.stacks = snapshot;
          return false;
        }
      }
      const fits = this.add(outputId, outputAmount);
      this.stacks = snapshot;
      return fits;
    }

    Add a test that calls canAddAfterRemoving and then asserts every original item count is unchanged.

- [ ] **Step 4: 运行测试并提交**

    Run: yarn test tests/unit/bag/Inventory.test.ts
    Expected: PASS.

    git add assets/script/game/bag/model tests/unit/bag/Inventory.test.ts
    git commit -m "feat: add capacity-aware inventory"

### Task 2: 装备槽与标签共鸣

**Files:**
- Create: assets/script/game/bag/model/EquipmentSet.ts
- Test: tests/unit/bag/EquipmentSet.test.ts

**Interfaces:**
- Produces: EquipmentSlot、EquipmentInstance、EquipmentSet.equip()、getActiveResonances()。

- [ ] **Step 1: 写失败测试**

    it("activates thunder resonance at three matching tags", () => {
      const set = new EquipmentSet();
      set.equip({ instanceId: "a", slot: "head", tags: ["thunder"] });
      set.equip({ instanceId: "b", slot: "armor", tags: ["thunder"] });
      set.equip({ instanceId: "c", slot: "boots", tags: ["thunder"] });
      expect(set.getActiveResonances()).toContain("resonance_thunder_3");
    });

    Run: yarn test tests/unit/bag/EquipmentSet.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现固定槽位与计数**

    export type EquipmentSlot =
      | "weapon_primary" | "weapon_secondary" | "head" | "armor"
      | "gloves" | "boots" | "tactical" | "organ";

    export interface EquipmentInstance {
      instanceId: string;
      slot: EquipmentSlot;
      tags: string[];
    }

    export class EquipmentSet {
      private slots = new Map<EquipmentSlot, EquipmentInstance>();
      equip(item: EquipmentInstance): EquipmentInstance | null {
        const previous = this.slots.get(item.slot) ?? null;
        this.slots.set(item.slot, item);
        return previous;
      }
      getActiveResonances(): string[] {
        const counts = new Map<string, number>();
        for (const item of this.slots.values()) {
          for (const tag of item.tags) counts.set(tag, (counts.get(tag) ?? 0) + 1);
        }
        return [...counts].filter(([, n]) => n >= 2).map(([tag, n]) => "resonance_" + tag + "_" + Math.min(n, 3));
      }
    }

- [ ] **Step 3: 运行测试并提交**

    Run: yarn test tests/unit/bag/EquipmentSet.test.ts
    Expected: PASS.

    git add assets/script/game/bag/model/EquipmentSet.ts tests/unit/bag/EquipmentSet.test.ts
    git commit -m "feat: equip items and resolve resonance"

### Task 3: 战斗记忆进化

**Files:**
- Create: assets/script/game/evolve/model/CombatMemory.ts
- Test: tests/unit/evolve/CombatMemory.test.ts

**Interfaces:**
- Produces: CombatMemory.record(event)、availablePaths(rules)。

- [ ] **Step 1: 写失败测试**

    it("offers hunter evolution after enough weakpoint hits", () => {
      const memory = new CombatMemory();
      for (let i = 0; i < 50; i += 1) memory.record("weakpoint_hit");
      expect(memory.availablePaths([
        { id: "hunter", event: "weakpoint_hit", threshold: 50 }
      ])).toEqual(["hunter"]);
    });

    Run: yarn test tests/unit/evolve/CombatMemory.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现事件计数**

    export type CombatMemoryEvent =
      | "close_kill" | "weakpoint_hit" | "weapon_swap_kill"
      | "ark_defense_kill" | "element_trigger" | "high_pollution_kill";

    export class CombatMemory {
      private counts: Record<string, number> = {};
      record(event: CombatMemoryEvent): void {
        this.counts[event] = (this.counts[event] ?? 0) + 1;
      }
      availablePaths(rules: { id: string; event: CombatMemoryEvent; threshold: number }[]): string[] {
        return rules.filter(r => (this.counts[r.event] ?? 0) >= r.threshold).map(r => r.id);
      }
    }

- [ ] **Step 3: 运行测试并提交**

    Run: yarn test tests/unit/evolve/CombatMemory.test.ts
    Expected: PASS.

    git add assets/script/game/evolve/model/CombatMemory.ts tests/unit/evolve/CombatMemory.test.ts
    git commit -m "feat: track equipment combat memory"

### Task 4: 词条池、经验与天赋点

**Files:**
- Create: assets/script/game/evolve/model/AffixResolver.ts
- Create: assets/script/game/evolve/model/ProgressionState.ts
- Test: tests/unit/evolve/ProgressionState.test.ts

**Interfaces:**
- Produces: rollAffixes(pool, count, rng)、ProgressionState.addExperience(amount)。

- [ ] **Step 1: 写失败测试**

    it("grants one talent point for every crossed level", () => {
      const state = new ProgressionState([0, 100, 250, 450]);
      state.addExperience(260);
      expect(state.level).toBe(3);
      expect(state.unspentTalentPoints).toBe(2);
    });

    Run: yarn test tests/unit/evolve/ProgressionState.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现等级状态**

    export class ProgressionState {
      level = 1;
      experience = 0;
      unspentTalentPoints = 0;
      constructor(private thresholds: number[]) {}
      addExperience(amount: number): void {
        this.experience += Math.max(0, amount);
        while (
          this.level < this.thresholds.length &&
          this.experience >= this.thresholds[this.level]
        ) {
          this.level += 1;
          this.unspentTalentPoints += 1;
        }
      }
    }

- [ ] **Step 3: 实现受限词条抽取**

    export interface AffixDefinition {
      id: string;
      allowedSlots: EquipmentSlot[];
      group: string;
    }

    export function rollAffixes(
      pool: AffixDefinition[],
      slot: EquipmentSlot,
      count: number,
      rng: () => number
    ): AffixDefinition[] {
      const available = pool.filter(x => x.allowedSlots.includes(slot));
      const result: AffixDefinition[] = [];
      while (available.length > 0 && result.length < count) {
        const index = Math.floor(rng() * available.length);
        const picked = available.splice(index, 1)[0];
        if (!result.some(x => x.group === picked.group)) result.push(picked);
      }
      return result;
    }

- [ ] **Step 4: 测试并提交**

    Run: yarn test tests/unit/evolve/ProgressionState.test.ts
    Expected: PASS.

    git add assets/script/game/evolve/model/AffixResolver.ts assets/script/game/evolve/model/ProgressionState.ts tests/unit/evolve/ProgressionState.test.ts
    git commit -m "feat: add affixes and character progression"

### Task 5: 原子制造、强化与拆解

**Files:**
- Create: assets/script/game/bag/CraftingService.ts
- Test: tests/unit/bag/CraftingService.test.ts

**Interfaces:**
- Consumes: Inventory。
- Produces: CraftingService.craft(recipe)、strengthen(instance, cost)、salvage(instance)。

- [ ] **Step 1: 写失败测试**

    it("does not consume inputs when output cannot fit", () => {
      const bag = new Inventory(1, { wood: 99, rifle: 1 });
      bag.add("wood", 5);
      const service = new CraftingService(bag);
      expect(service.craft({ inputs: { wood: 2 }, outputId: "rifle", outputAmount: 1 })).toBe(false);
      expect(bag.count("wood")).toBe(5);
    });

    Run: yarn test tests/unit/bag/CraftingService.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现验证后扣除**

    craft(recipe: Recipe): boolean {
      for (const [id, amount] of Object.entries(recipe.inputs)) {
        if (this.inventory.count(id) < amount) return false;
      }
      if (!this.inventory.canAddAfterRemoving(recipe.inputs, recipe.outputId, recipe.outputAmount)) return false;
      for (const [id, amount] of Object.entries(recipe.inputs)) this.inventory.remove(id, amount);
      return this.inventory.add(recipe.outputId, recipe.outputAmount);
    }

- [ ] **Step 3: 增加强化和拆解结果测试**

    Define StrengthenResult and SalvageResult as immutable return values. Verify strengthening never adds affixes and salvage respects a protected flag before removing an instance.

- [ ] **Step 4: 运行测试并提交**

    Run: yarn test tests/unit/bag/CraftingService.test.ts
    Expected: PASS.

    git add assets/script/game/bag/CraftingService.ts tests/unit/bag/CraftingService.test.ts
    git commit -m "feat: craft and salvage equipment atomically"

### Task 6: BagModule 与 EvolveModule 集成

**Files:**
- Modify: assets/script/game/bag/BagModule.ts:1-3
- Modify: assets/script/game/evolve/EvolveModule.ts:1-3
- Modify: assets/script/game/common/config/GameEvent.ts

**Interfaces:**
- Produces: BagModule.addItem()、craft()、equip()；EvolveModule.recordCombatEvent()、chooseEvolution()。

- [ ] **Step 1: 为模块建立明确命令 API**

    export class BagModule {
      constructor(
        readonly inventory: Inventory,
        readonly equipment: EquipmentSet,
        readonly crafting: CraftingService
      ) {}

      addItem(id: string, amount: number): boolean {
        const added = this.inventory.add(id, amount);
        if (added) oops.message.dispatchEvent(GameEvent.InventoryChanged);
        return added;
      }
    }

- [ ] **Step 2: 接入存档映射**

    Add toSaveData() and restore(save) methods that serialize plain item stacks, equipment instance IDs, affixes, evolution choices and memory counters. Do not serialize class instances.

- [ ] **Step 3: Creator 验收**

    In a debug panel, grant wood and a rifle recipe, fill the bag, craft once, equip the rifle, trigger three thunder tags and restart the preview.
    Expected: full-bag failure keeps materials; successful craft persists; resonance and equipment remain after restart.

- [ ] **Step 4: 回归与提交**

    Run: yarn test && yarn typecheck:test
    Expected: all tests pass.

    git add assets/script/game/bag assets/script/game/evolve assets/script/game/common/config/GameEvent.ts tests/unit/bag tests/unit/evolve
    git commit -m "feat: integrate inventory equipment and progression"

## Plan Completion Gate

Run all tests and complete the Creator persistence check for add, craft, equip, evolve, dismantle and restart. No protected equipment may be removed by batch dismantle.
