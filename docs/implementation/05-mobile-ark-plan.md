# 移动方舟 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 实现方舟槽位布局、模块耐久、供电优先级、噪音预测、维修、方案保存和活体进化。

**Architecture:** ArkState 保存纯数据；PlacementValidator、PowerAllocator、NoiseCalculator 和 RepairService 提供确定性规则；ArkController 绑定方舟节点和夜间交互。

**Tech Stack:** TypeScript、Vitest、Cocos Creator 3.8.8、Oops Framework。

## Global Constraints

- 使用固定槽位，不做像素级自由建造。
- 供电不足时按核心、重要、普通顺序断电。
- 模块耐久归零停机但不永久销毁。
- 每次活体进化必须同时包含能力、副作用和视觉状态。

---

## File Structure

- Create: assets/script/game/shelter/model/ArkTypes.ts
- Create: assets/script/game/shelter/model/PlacementValidator.ts
- Create: assets/script/game/shelter/model/PowerAllocator.ts
- Create: assets/script/game/shelter/model/NoiseCalculator.ts
- Create: assets/script/game/shelter/model/RepairService.ts
- Create: assets/script/game/shelter/model/ArkEvolutionService.ts
- Create: assets/script/game/shelter/ArkModule.ts
- Create: assets/script/game/shelter/ArkController.ts
- Test: tests/unit/shelter/PlacementValidator.test.ts
- Test: tests/unit/shelter/PowerAllocator.test.ts
- Test: tests/unit/shelter/NoiseCalculator.test.ts
- Test: tests/unit/shelter/RepairService.test.ts
- Test: tests/unit/shelter/ArkEvolutionService.test.ts

### Task 1: 槽位与合法放置

**Files:**
- Create: assets/script/game/shelter/model/ArkTypes.ts
- Create: assets/script/game/shelter/model/PlacementValidator.ts
- Test: tests/unit/shelter/PlacementValidator.test.ts

**Interfaces:**
- Produces: ArkSlot、ArkModuleInstance、validatePlacement(slot, module)。

- [ ] **Step 1: 写失败测试**

    it("rejects an internal generator on a weapon slot", () => {
      expect(validatePlacement(
        { id: "top_1", accepts: ["weapon"] },
        { instanceId: "gen_1", category: "internal", slotId: null }
      )).toEqual({ ok: false, error: "slot_rejects_category" });
    });

    Run: yarn test tests/unit/shelter/PlacementValidator.test.ts
    Expected: FAIL.

- [ ] **Step 2: 定义模块与槽位**

    export type ArkCategory = "defense" | "weapon" | "internal";
    export type PowerPriority = "core" | "important" | "normal";

    export interface ArkSlot {
      id: string;
      accepts: ArkCategory[];
    }

    export interface ArkModuleInstance {
      instanceId: string;
      definitionId: string;
      category: ArkCategory;
      slotId: string | null;
      durability: number;
      maxDurability: number;
      powerDemand: number;
      noise: number;
      priority: PowerPriority;
      evolutionId: string | null;
      evolutionPowerDelta: number;
      evolutionNoiseDelta: number;
    }

- [ ] **Step 3: 实现放置校验**

    export function validatePlacement(slot: ArkSlot, module: ArkModuleInstance) {
      if (!slot.accepts.includes(module.category)) {
        return { ok: false as const, error: "slot_rejects_category" as const };
      }
      return { ok: true as const, value: { ...module, slotId: slot.id } };
    }

- [ ] **Step 4: 测试并提交**

    Run: yarn test tests/unit/shelter/PlacementValidator.test.ts
    Expected: PASS.

    git add assets/script/game/shelter/model tests/unit/shelter/PlacementValidator.test.ts
    git commit -m "feat: validate ark module placement"

### Task 2: 供电分配

**Files:**
- Create: assets/script/game/shelter/model/PowerAllocator.ts
- Test: tests/unit/shelter/PowerAllocator.test.ts

**Interfaces:**
- Produces: allocatePower(capacity, modules): PowerAllocation。

- [ ] **Step 1: 写失败测试**

    it("keeps core modules powered before normal modules", () => {
      const result = allocatePower(5, [
        { id: "radar", demand: 3, priority: "normal" },
        { id: "core", demand: 5, priority: "core" }
      ]);
      expect(result.poweredIds).toEqual(["core"]);
      expect(result.unpoweredIds).toEqual(["radar"]);
    });

    Run: yarn test tests/unit/shelter/PowerAllocator.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现稳定优先级分配**

    export interface PowerRequest {
      id: string;
      demand: number;
      priority: PowerPriority;
    }

    export interface PowerAllocation {
      poweredIds: string[];
      unpoweredIds: string[];
      remaining: number;
    }

    const rank = { core: 0, important: 1, normal: 2 };
    export function allocatePower(capacity: number, modules: PowerRequest[]): PowerAllocation {
      let remaining = capacity;
      const poweredIds: string[] = [];
      const unpoweredIds: string[] = [];
      for (const module of [...modules].sort((a, b) => rank[a.priority] - rank[b.priority] || a.id.localeCompare(b.id))) {
        if (module.demand <= remaining) {
          poweredIds.push(module.id);
          remaining -= module.demand;
        } else unpoweredIds.push(module.id);
      }
      return { poweredIds, unpoweredIds, remaining };
    }

- [ ] **Step 3: 测试并提交**

    Run: yarn test tests/unit/shelter/PowerAllocator.test.ts
    Expected: PASS.

    git add assets/script/game/shelter/model/PowerAllocator.ts tests/unit/shelter/PowerAllocator.test.ts
    git commit -m "feat: allocate ark power by priority"

### Task 3: 噪音预测与诱敌档位

**Files:**
- Create: assets/script/game/shelter/model/NoiseCalculator.ts
- Test: tests/unit/shelter/NoiseCalculator.test.ts

**Interfaces:**
- Produces: calculateNoise(modules, broadcastBonus)、classifyNoise(value)。

- [ ] **Step 1: 写失败测试**

    it("classifies broadcast noise as bait", () => {
      const value = calculateNoise([{ active: true, noise: 30 }], 80);
      expect(classifyNoise(value)).toBe("bait");
    });

    Run: yarn test tests/unit/shelter/NoiseCalculator.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现噪音档位**

    export function calculateNoise(modules: { active: boolean; noise: number }[], broadcastBonus: number): number {
      return modules.filter(x => x.active).reduce((sum, x) => sum + x.noise, broadcastBonus);
    }

    export function classifyNoise(value: number): "hidden" | "noticed" | "danger" | "bait" {
      if (value >= 100) return "bait";
      if (value >= 60) return "danger";
      if (value >= 25) return "noticed";
      return "hidden";
    }

- [ ] **Step 3: 测试并提交**

    Run: yarn test tests/unit/shelter/NoiseCalculator.test.ts
    Expected: PASS.

    git add assets/script/game/shelter/model/NoiseCalculator.ts tests/unit/shelter/NoiseCalculator.test.ts
    git commit -m "feat: predict ark noise tier"

### Task 4: 耐久与维修

**Files:**
- Create: assets/script/game/shelter/model/RepairService.ts
- Test: tests/unit/shelter/RepairService.test.ts

**Interfaces:**
- Produces: damageModule()、quoteRepair()、repairModule()。

- [ ] **Step 1: 写失败测试**

    it("stops a module at zero without deleting it", () => {
      const damaged = damageModule({ durability: 10, maxDurability: 100 }, 25);
      expect(damaged.durability).toBe(0);
      expect(damaged.destroyed).toBe(false);
      expect(damaged.operational).toBe(false);
    });

    Run: yarn test tests/unit/shelter/RepairService.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现非永久销毁规则**

    export interface DurabilityState {
      durability: number;
      maxDurability: number;
    }

    export function damageModule(state: DurabilityState, amount: number) {
      const durability = Math.max(0, state.durability - amount);
      return { ...state, durability, operational: durability > 0, destroyed: false };
    }

    export function quoteRepair(state: DurabilityState, costPerPoint: number, dailyCap: number): number {
      return Math.min((state.maxDurability - state.durability) * costPerPoint, dailyCap);
    }

- [ ] **Step 3: 测试并提交**

    Run: yarn test tests/unit/shelter/RepairService.test.ts
    Expected: PASS.

    git add assets/script/game/shelter/model/RepairService.ts tests/unit/shelter/RepairService.test.ts
    git commit -m "feat: damage and repair ark modules"

### Task 5: 活体进化与副作用

**Files:**
- Create: assets/script/game/shelter/model/ArkEvolutionService.ts
- Test: tests/unit/shelter/ArkEvolutionService.test.ts

**Interfaces:**
- Produces: applyArkEvolution(module, evolution)、removeArkEvolution(module)。

- [ ] **Step 1: 写失败测试**

    it("applies both ability and power-noise costs", () => {
      const evolved = applyArkEvolution(baseTurret, {
        id: "evo_hunter_gland",
        abilityId: "target_low_health",
        powerDelta: 2,
        noiseDelta: 5
      });
      expect(evolved.evolutionId).toBe("evo_hunter_gland");
      expect(evolved.powerDemand).toBe(baseTurret.powerDemand + 2);
      expect(evolved.noise).toBe(baseTurret.noise + 5);
    });

    Run: yarn test tests/unit/shelter/ArkEvolutionService.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现不可叠加进化**

    export interface ArkEvolutionDefinition {
      id: string;
      abilityId: string;
      powerDelta: number;
      noiseDelta: number;
    }

    export function applyArkEvolution(
      module: ArkModuleInstance,
      evolution: ArkEvolutionDefinition
    ): ArkModuleInstance {
      if (module.evolutionId) throw new Error("module already evolved");
      return {
        ...module,
        evolutionId: evolution.id,
        evolutionPowerDelta: evolution.powerDelta,
        evolutionNoiseDelta: evolution.noiseDelta,
        powerDemand: module.powerDemand + evolution.powerDelta,
        noise: module.noise + evolution.noiseDelta
      };
    }

- [ ] **Step 3: 测试拆除返还规则**

    export function removeArkEvolution(
      module: ArkModuleInstance,
      originalCoreCost: number
    ): { module: ArkModuleInstance; coreRefund: number } {
      return {
        module: {
          ...module,
          evolutionId: null,
          powerDemand: module.powerDemand - module.evolutionPowerDelta,
          noise: module.noise - module.evolutionNoiseDelta,
          evolutionPowerDelta: 0,
          evolutionNoiseDelta: 0
        },
        coreRefund: Math.floor(originalCoreCost * 0.5)
      };
    }

    Verify the returned refund is below the original core cost and the module restores the exact stored power and noise deltas.

- [ ] **Step 4: 测试并提交**

    Run: yarn test tests/unit/shelter/ArkEvolutionService.test.ts
    Expected: PASS.

    git add assets/script/game/shelter/model/ArkEvolutionService.ts tests/unit/shelter/ArkEvolutionService.test.ts
    git commit -m "feat: evolve ark modules with tradeoffs"

### Task 6: 方舟运行时与 Creator 集成

**Files:**
- Create: assets/script/game/shelter/ArkModule.ts
- Create: assets/script/game/shelter/ArkController.ts
- Modify: assets/script/game/common/config/GameEvent.ts
- Create in Creator: assets/bundle/game/ark/ark-tier-1.prefab

**Interfaces:**
- Produces: ArkModule.place()、saveLayout()、applyPower()、damage()、repair()。

- [ ] **Step 1: 增加方舟事件**

    ArkLayoutChanged = "ArkLayoutChanged",
    ArkPowerChanged = "ArkPowerChanged",
    ArkNoiseChanged = "ArkNoiseChanged",
    ArkModuleDamaged = "ArkModuleDamaged",
    ArkCoreDown = "ArkCoreDown",

- [ ] **Step 2: 建立 ArkModule 聚合服务**

    export class ArkModule {
      constructor(public state: ArkState) {}
      recalculate(): void {
        const powerRequests = this.state.modules.map(module => ({
          id: module.instanceId,
          demand: module.powerDemand,
          priority: module.priority
        }));
        const noiseSources = this.state.modules.map(module => ({
          active: module.durability > 0,
          noise: module.noise
        }));
        this.state.power = allocatePower(this.state.powerCapacity, powerRequests);
        this.state.noiseTier = classifyNoise(calculateNoise(noiseSources, this.state.broadcastNoise));
        oops.message.dispatchEvent(GameEvent.ArkPowerChanged, this.state.power);
        oops.message.dispatchEvent(GameEvent.ArkNoiseChanged, this.state.noiseTier);
      }
    }

- [ ] **Step 3: 在 Creator 创建一级方舟**

    Add named slot nodes for front armor, top weapon, rear weapon, generator and workshop. Attach ArkController to the root. Bind module visuals by slot ID and include powered, damaged and offline states.

- [ ] **Step 4: 手动验收**

    Place an invalid module, exceed power capacity, switch a priority, activate bait broadcast, damage a turret to zero, repair it and restart preview.
    Expected: invalid placement is rejected; power and noise previews match runtime; the turret stops but remains installed; layout persists.

- [ ] **Step 5: 回归与提交**

    Run: yarn test && yarn typecheck:test
    Expected: all tests pass.

    git add assets/script/game/shelter assets/script/game/common/config/GameEvent.ts assets/bundle/game/ark tests/unit/shelter
    git commit -m "feat: integrate modular mobile ark"

## Plan Completion Gate

Test three saved layouts, every power priority, all noise tiers, module damage at each durability threshold and one live evolution. Restart Creator preview and verify the same state is restored.
