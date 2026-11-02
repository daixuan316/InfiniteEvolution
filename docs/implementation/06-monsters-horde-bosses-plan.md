# 怪物、尸潮与 BOSS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 实现普通怪状态机、目标选择、尸潮预算导演、适应性变异、精英词缀和三阶段 BOSS。

**Architecture:** MonsterBrain 负责单体意图，HordeDirector 负责确定性预算和波次，AdaptationTracker 只读取历史统计，BossPhaseMachine 负责阶段。Cocos 控制器消费意图并驱动节点、动画和碰撞。

**Tech Stack:** TypeScript、Vitest、Cocos Creator 3.8.8、Oops Framework、对象池。

## Global Constraints

- 普通怪不每帧重新寻路。
- 同一波最多三种高关注特殊怪。
- 适应性变异提前一天预警，同一时间最多两种完整适应。
- BOSS 对硬控使用失衡值，不完全免疫。

---

## File Structure

- Create: assets/script/game/monster/model/MonsterBrain.ts
- Create: assets/script/game/monster/model/HordeDirector.ts
- Create: assets/script/game/monster/model/AdaptationTracker.ts
- Create: assets/script/game/monster/model/EliteAffixResolver.ts
- Create: assets/script/game/monster/model/BossPhaseMachine.ts
- Create: assets/script/game/monster/MonsterController.ts
- Create: assets/script/game/monster/MonsterPool.ts
- Modify: assets/script/game/battle/BattleModule.ts
- Test: tests/unit/monster/MonsterBrain.test.ts
- Test: tests/unit/monster/HordeDirector.test.ts
- Test: tests/unit/monster/AdaptationTracker.test.ts
- Test: tests/unit/monster/BossPhaseMachine.test.ts

### Task 1: 普通怪状态机

**Files:**
- Create: assets/script/game/monster/model/MonsterBrain.ts
- Test: tests/unit/monster/MonsterBrain.test.ts

**Interfaces:**
- Produces: MonsterState、MonsterIntent、MonsterBrain.tick(context)。

- [ ] **Step 1: 写失败测试**

    it("switches from chase to attack inside attack range", () => {
      const brain = new MonsterBrain();
      expect(brain.tick({ targetVisible: true, distance: 5, attackRange: 1 }).state).toBe("chase");
      expect(brain.tick({ targetVisible: true, distance: 0.5, attackRange: 1 }).state).toBe("attack");
    });

    Run: yarn test tests/unit/monster/MonsterBrain.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现有限状态**

    export type MonsterState = "idle" | "alert" | "chase" | "attack" | "siege" | "controlled" | "repath";

    export interface BrainContext {
      targetVisible: boolean;
      targetId?: string;
      distance: number;
      attackRange: number;
      controlled?: boolean;
      siegeTargetId?: string;
    }

    export interface MonsterIntent {
      state: MonsterState;
      targetId: string | null | undefined;
    }

    export class MonsterBrain {
      tick(context: BrainContext): MonsterIntent {
        if (context.controlled) return { state: "controlled", targetId: null };
        if (context.targetVisible && context.distance <= context.attackRange) {
          return { state: "attack", targetId: context.targetId };
        }
        if (context.targetVisible) return { state: "chase", targetId: context.targetId };
        if (context.siegeTargetId) return { state: "siege", targetId: context.siegeTargetId };
        return { state: "idle", targetId: null };
      }
    }

- [ ] **Step 3: 测试并提交**

    Run: yarn test tests/unit/monster/MonsterBrain.test.ts
    Expected: PASS.

    git add assets/script/game/monster/model/MonsterBrain.ts tests/unit/monster/MonsterBrain.test.ts
    git commit -m "feat: add monster decision state machine"

### Task 2: 尸潮预算导演

**Files:**
- Create: assets/script/game/monster/model/HordeDirector.ts
- Test: tests/unit/monster/HordeDirector.test.ts

**Interfaces:**
- Produces: buildHorde(input, catalog, rng): HordePlan。

- [ ] **Step 1: 写失败测试**

    const testCatalog = [
      { id: "walker", cost: 5, special: false },
      { id: "runner", cost: 10, special: true },
      { id: "spitter", cost: 15, special: true },
      { id: "brute", cost: 20, special: true },
      { id: "screamer", cost: 25, special: true }
    ];

    function seededSequence(values: number[]): () => number {
      let index = 0;
      return () => values[index++ % values.length];
    }

    it("never spends beyond budget or adds more than three special types", () => {
      const plan = buildHorde(
        { budget: 100, maxSpecialTypes: 3 },
        testCatalog,
        seededSequence([0.1, 0.7, 0.3])
      );
      expect(plan.spent).toBeLessThanOrEqual(100);
      expect(new Set(plan.units.filter(x => x.special).map(x => x.id)).size).toBeLessThanOrEqual(3);
    });

    Run: yarn test tests/unit/monster/HordeDirector.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现预算循环**

    export interface HordeInput { budget: number; maxSpecialTypes: number; }
    export interface HordeUnitCost { id: string; cost: number; special: boolean; }
    export interface HordeSpawn { id: string; special: boolean; }
    export interface HordePlan { units: HordeSpawn[]; spent: number; }

    export function buildHorde(input: HordeInput, catalog: HordeUnitCost[], rng: () => number): HordePlan {
      let remaining = input.budget;
      const units: HordeSpawn[] = [];
      const specialTypes = new Set<string>();
      const ordered = [...catalog].sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));
      while (true) {
        const candidates = ordered.filter(x =>
          x.cost <= remaining && (!x.special || specialTypes.has(x.id) || specialTypes.size < input.maxSpecialTypes)
        );
        if (candidates.length === 0) break;
        const picked = candidates[Math.floor(rng() * candidates.length)];
        units.push({ id: picked.id, special: picked.special });
        if (picked.special) specialTypes.add(picked.id);
        remaining -= picked.cost;
      }
      return { units, spent: input.budget - remaining };
    }

- [ ] **Step 3: 测试多个固定种子并提交**

    Run the same assertions over seeds 1 through 100 using a deterministic RNG.
    Run: yarn test tests/unit/monster/HordeDirector.test.ts
    Expected: PASS for every seed.

    git add assets/script/game/monster/model/HordeDirector.ts tests/unit/monster/HordeDirector.test.ts
    git commit -m "feat: build deterministic horde plans"

### Task 3: 适应性变异

**Files:**
- Create: assets/script/game/monster/model/AdaptationTracker.ts
- Test: tests/unit/monster/AdaptationTracker.test.ts

**Interfaces:**
- Produces: recordNight(stats)、forecast()、advanceDay()。

- [ ] **Step 1: 写失败测试**

    it("forecasts fire resistance before activation and decays after strategy changes", () => {
      const tracker = new AdaptationTracker();
      tracker.recordNight({ fireShare: 0.8, turretShare: 0.1, averageNoise: 20 });
      tracker.recordNight({ fireShare: 0.75, turretShare: 0.1, averageNoise: 20 });
      expect(tracker.forecast()).toContain("adapt_heat_skin");
      expect(tracker.active()).not.toContain("adapt_heat_skin");
      tracker.advanceDay();
      expect(tracker.active()).toContain("adapt_heat_skin");
    });

    Run: yarn test tests/unit/monster/AdaptationTracker.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现三晚窗口和延迟激活**

    Store the last three NightStats. A rule becomes forecast when its threshold is met for two consecutive entries. advanceDay moves forecast IDs into active IDs, keeps at most two active IDs by score, and decreases scores when the matching tactic drops below 0.4.

- [ ] **Step 3: 将规则写成数据**

    export const ADAPTATION_RULES = [
      { id: "adapt_heat_skin", metric: "fireShare", threshold: 0.7, counter: "electric" },
      { id: "adapt_parasite", metric: "turretShare", threshold: 0.65, counter: "player_damage" },
      { id: "adapt_scout", metric: "averageNoise", threshold: 20, comparison: "below", counter: "kill_screamer" }
    ] as const;

- [ ] **Step 4: 测试并提交**

    Run: yarn test tests/unit/monster/AdaptationTracker.test.ts
    Expected: PASS.

    git add assets/script/game/monster/model/AdaptationTracker.ts tests/unit/monster/AdaptationTracker.test.ts
    git commit -m "feat: forecast adaptive horde mutations"

### Task 4: 精英词缀与 BOSS 阶段

**Files:**
- Create: assets/script/game/monster/model/EliteAffixResolver.ts
- Create: assets/script/game/monster/model/BossPhaseMachine.ts
- Test: tests/unit/monster/BossPhaseMachine.test.ts

**Interfaces:**
- Produces: applyAffix(base, affix)、BossPhaseMachine.damage()、addStagger()。

- [ ] **Step 1: 写 BOSS 阶段失败测试**

    it("enters phase two at 70 percent and exposes a stagger window", () => {
      const boss = new BossPhaseMachine(1000, [0.7, 0.3], 100);
      boss.damage(310);
      expect(boss.phase).toBe(2);
      boss.addStagger(100);
      expect(boss.staggered).toBe(true);
    });

    Run: yarn test tests/unit/monster/BossPhaseMachine.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现阶段和失衡**

    export class BossPhaseMachine {
      hp: number;
      phase = 1;
      stagger = 0;
      staggered = false;
      constructor(readonly maxHp: number, private thresholds: number[], private staggerThreshold: number) {
        this.hp = maxHp;
      }
      damage(amount: number): void {
        this.hp = Math.max(0, this.hp - amount);
        this.phase = 1 + this.thresholds.filter(x => this.hp / this.maxHp <= x).length;
      }
      addStagger(amount: number): void {
        this.stagger += amount;
        if (this.stagger >= this.staggerThreshold) this.staggered = true;
      }
    }

- [ ] **Step 3: 实现词缀组合排除**

    Define ELITE_AFFIXES with incompatibleWith arrays. resolveEliteAffixes(seed, count) must never return incompatible pairs and must cap normal elites at one and advanced elites at two.

- [ ] **Step 4: 测试并提交**

    Run: yarn test tests/unit/monster
    Expected: all monster tests pass.

    git add assets/script/game/monster/model tests/unit/monster
    git commit -m "feat: add elite affixes and boss phases"

### Task 5: 对象池与夜战集成

**Files:**
- Create: assets/script/game/monster/MonsterController.ts
- Create: assets/script/game/monster/MonsterPool.ts
- Modify: assets/script/game/battle/BattleModule.ts
- Modify: assets/script/game/common/config/GameEvent.ts
- Create in Creator: assets/bundle/game/monster/monster-prototype.prefab

**Interfaces:**
- Produces: MonsterPool.acquire(definitionId)、release(controller)、BattleModule.startNight(plan)。

- [ ] **Step 1: 增加夜战事件**

    HordeWarning = "HordeWarning",
    HordeWaveChanged = "HordeWaveChanged",
    MonsterSpecialWarning = "MonsterSpecialWarning",
    BossPhaseChanged = "BossPhaseChanged",
    NightCompleted = "NightCompleted",

- [ ] **Step 2: 建立对象池**

    export class MonsterPool {
      private free = new Map<string, MonsterController[]>();
      constructor(private factory: (definitionId: string) => MonsterController) {}
      acquire(definitionId: string): MonsterController {
        const list = this.free.get(definitionId);
        return list?.pop() ?? this.factory(definitionId);
      }
      release(controller: MonsterController): void {
        controller.resetRuntimeState();
        const list = this.free.get(controller.definitionId) ?? [];
        list.push(controller);
        this.free.set(controller.definitionId, list);
      }
    }

- [ ] **Step 3: 接入六段波次**

    BattleModule must advance warning, probe, assault, respite, climax and cleanup from a HordePlan. During respite it stops spawning but does not freeze existing monsters. During cleanup it forbids new filler spawns.

- [ ] **Step 4: Creator 压力验收**

    Run a ten-minute night with the prototype units.
    Expected: special warnings appear at least five seconds before entry; pool counts stabilize after repeated waves; no path is recomputed every frame; cleanup ends after remaining enemies die.

- [ ] **Step 5: 回归与提交**

    Run: yarn test && yarn typecheck:test
    Expected: all tests pass.

    git add assets/script/game/monster assets/script/game/battle assets/script/game/common/config/GameEvent.ts assets/bundle/game/monster tests/unit/monster
    git commit -m "feat: integrate horde combat and bosses"

## Plan Completion Gate

Run 100 deterministic director seeds, a ten-minute pooled horde stress test, one adaptation forecast cycle and a three-phase boss. Record maximum active monsters, pool size, frame time and any stuck agent.
