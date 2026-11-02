# 角色战斗 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 实现移动、自动瞄准、无限弹药下的换弹与过热、伤害结算、翻滚和双武器切换。

**Architecture:** TargetSelector、DamageResolver 和 WeaponRuntime 是无引擎依赖的纯规则类；RoleController 只把 Cocos 输入与节点表现映射到领域状态。BattleModule 负责创建和销毁战斗会话。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Oops Framework、Vitest。

## Global Constraints

- 自动射击只在存在有效目标时触发。
- 子弹无限，但保留弹匣、换弹、射速、射程、散布和过热。
- 同类增伤先加后乘，防御采用递减收益。
- 角色移动与输入响应优先于非关键 AI 更新。

---

## File Structure

- Create: assets/script/game/role/model/CombatTypes.ts
- Create: assets/script/game/role/model/TargetSelector.ts
- Create: assets/script/game/role/model/DamageResolver.ts
- Create: assets/script/game/role/model/WeaponRuntime.ts
- Create: assets/script/game/role/RoleController.ts
- Modify: assets/script/game/role/RoleModule.ts
- Modify: assets/script/game/battle/BattleModule.ts
- Test: tests/unit/role/TargetSelector.test.ts
- Test: tests/unit/role/DamageResolver.test.ts
- Test: tests/unit/role/WeaponRuntime.test.ts

### Task 1: 自动目标选择

**Files:**
- Create: assets/script/game/role/model/CombatTypes.ts
- Create: assets/script/game/role/model/TargetSelector.ts
- Test: tests/unit/role/TargetSelector.test.ts

**Interfaces:**
- Produces: TargetCandidate、TargetPolicy、selectTarget(candidates, policy)。

- [ ] **Step 1: 写失败测试**

    import { describe, expect, it } from "vitest";
    import { selectTarget } from "../../../assets/script/game/role/model/TargetSelector";

    describe("selectTarget", () => {
      it("prefers a marked special enemy inside range", () => {
        const target = selectTarget([
          { id: "normal", distance: 2, threatToPlayer: false, special: false, marked: false, hpRatio: 1 },
          { id: "spitter", distance: 5, threatToPlayer: false, special: true, marked: true, hpRatio: 1 }
        ], { maxRange: 8 });
        expect(target?.id).toBe("spitter");
      });
    });

    Run: yarn test tests/unit/role/TargetSelector.test.ts
    Expected: FAIL because selector does not exist.

- [ ] **Step 2: 实现稳定排序**

    export interface TargetCandidate {
      id: string;
      distance: number;
      threatToPlayer: boolean;
      special: boolean;
      marked: boolean;
      hpRatio: number;
    }

    export function selectTarget(
      candidates: TargetCandidate[],
      policy: { maxRange: number }
    ): TargetCandidate | null {
      return candidates
        .filter(x => x.distance <= policy.maxRange)
        .sort((a, b) =>
          Number(b.threatToPlayer) - Number(a.threatToPlayer) ||
          Number(b.marked) - Number(a.marked) ||
          Number(b.special) - Number(a.special) ||
          a.distance - b.distance ||
          a.hpRatio - b.hpRatio
        )[0] ?? null;
    }

- [ ] **Step 3: 运行测试并提交**

    Run: yarn test tests/unit/role/TargetSelector.test.ts
    Expected: PASS.

    git add assets/script/game/role/model tests/unit/role/TargetSelector.test.ts
    git commit -m "feat: select combat targets by threat"

### Task 2: 伤害结算

**Files:**
- Create: assets/script/game/role/model/DamageResolver.ts
- Test: tests/unit/role/DamageResolver.test.ts

**Interfaces:**
- Produces: DamageInput、DamageResult、resolveDamage(input)。

- [ ] **Step 1: 写失败测试**

    import { describe, expect, it } from "vitest";
    import { resolveDamage } from "../../../assets/script/game/role/model/DamageResolver";

    describe("resolveDamage", () => {
      it("adds same-pool bonuses and applies defense reduction", () => {
        const result = resolveDamage({
          base: 100,
          skillMultiplier: 1,
          additiveBonuses: [0.2, 0.3],
          criticalMultiplier: 1,
          weakpointMultiplier: 1,
          defense: 100
        });
        expect(result.amount).toBe(75);
      });
    });

    Run: yarn test tests/unit/role/DamageResolver.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现伤害公式**

    export interface DamageInput {
      base: number;
      skillMultiplier: number;
      additiveBonuses: number[];
      criticalMultiplier: number;
      weakpointMultiplier: number;
      defense: number;
    }

    export interface DamageResult { amount: number; }

    export function resolveDamage(input: DamageInput): DamageResult {
      const bonus = input.additiveBonuses.reduce((sum, x) => sum + x, 0);
      const raw = input.base * input.skillMultiplier * (1 + bonus)
        * input.criticalMultiplier * input.weakpointMultiplier;
      const reduction = input.defense / (input.defense + 100);
      return { amount: Math.max(1, Math.round(raw * (1 - reduction))) };
    }

- [ ] **Step 3: 增加边界测试**

    it("never returns less than one for a successful hit", () => {
      expect(resolveDamage({
        base: 1, skillMultiplier: 1, additiveBonuses: [],
        criticalMultiplier: 1, weakpointMultiplier: 1, defense: 99999
      }).amount).toBe(1);
    });

- [ ] **Step 4: 运行测试并提交**

    Run: yarn test tests/unit/role/DamageResolver.test.ts
    Expected: PASS with 2 tests.

    git add assets/script/game/role/model/DamageResolver.ts tests/unit/role/DamageResolver.test.ts
    git commit -m "feat: resolve combat damage"

### Task 3: 武器运行时

**Files:**
- Create: assets/script/game/role/model/WeaponRuntime.ts
- Test: tests/unit/role/WeaponRuntime.test.ts

**Interfaces:**
- Produces: WeaponSpec、WeaponState、WeaponRuntime.tick(dt)、tryFire(hasTarget)、switchAway()。

- [ ] **Step 1: 写失败测试**

    import { describe, expect, it } from "vitest";
    import { WeaponRuntime } from "../../../assets/script/game/role/model/WeaponRuntime";

    describe("WeaponRuntime", () => {
      it("reloads after an unlimited-ammo magazine empties", () => {
        const gun = new WeaponRuntime({
          magazineSize: 2, shotsPerSecond: 10, reloadSeconds: 1, heatPerShot: 0, coolPerSecond: 0
        });
        expect(gun.tryFire(true)).toBe(true);
        gun.tick(0.11);
        expect(gun.tryFire(true)).toBe(true);
        expect(gun.tryFire(true)).toBe(false);
        gun.tick(1);
        expect(gun.ammoInMagazine).toBe(2);
      });
    });

    Run: yarn test tests/unit/role/WeaponRuntime.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现弹匣、射击间隔、换弹和热量**

    export interface WeaponSpec {
      magazineSize: number;
      shotsPerSecond: number;
      reloadSeconds: number;
      heatPerShot: number;
      coolPerSecond: number;
    }

    export class WeaponRuntime {
      ammoInMagazine: number;
      heat = 0;
      private cooldown = 0;
      private reloadRemaining = 0;

      constructor(readonly spec: WeaponSpec) {
        this.ammoInMagazine = spec.magazineSize;
      }

      tryFire(hasTarget: boolean): boolean {
        if (!hasTarget || this.cooldown > 0 || this.reloadRemaining > 0 || this.heat >= 1) return false;
        if (this.ammoInMagazine <= 0) {
          this.reloadRemaining = this.spec.reloadSeconds;
          return false;
        }
        this.ammoInMagazine -= 1;
        this.cooldown = 1 / this.spec.shotsPerSecond;
        this.heat = Math.min(1, this.heat + this.spec.heatPerShot);
        if (this.ammoInMagazine === 0) this.reloadRemaining = this.spec.reloadSeconds;
        return true;
      }

      tick(dt: number): void {
        this.cooldown = Math.max(0, this.cooldown - dt);
        this.heat = Math.max(0, this.heat - this.spec.coolPerSecond * dt);
        if (this.reloadRemaining > 0) {
          this.reloadRemaining = Math.max(0, this.reloadRemaining - dt);
          if (this.reloadRemaining === 0) this.ammoInMagazine = this.spec.magazineSize;
        }
      }
    }

- [ ] **Step 3: 运行测试并提交**

    Run: yarn test tests/unit/role/WeaponRuntime.test.ts
    Expected: PASS.

    git add assets/script/game/role/model/WeaponRuntime.ts tests/unit/role/WeaponRuntime.test.ts
    git commit -m "feat: add weapon firing runtime"

### Task 4: Cocos 角色控制器与战斗会话

**Files:**
- Create: assets/script/game/role/RoleController.ts
- Modify: assets/script/game/role/RoleModule.ts:1-3
- Modify: assets/script/game/battle/BattleModule.ts:1-10
- Modify: assets/script/game/common/config/GameEvent.ts:6-14
- Modify in Creator: assets/bundle/gui/battle/battle.prefab

**Interfaces:**
- Consumes: TargetSelector、WeaponRuntime、DamageResolver。
- Produces: RoleModule.enterBattle(root)、RoleModule.leaveBattle()、GameEvent.RoleHealthChanged、GameEvent.WeaponStateChanged。

- [ ] **Step 1: 增加战斗事件**

    BattleStarted = "BattleStarted",
    BattleEnded = "BattleEnded",
    RoleHealthChanged = "RoleHealthChanged",
    WeaponStateChanged = "WeaponStateChanged",
    RoleDowned = "RoleDowned",

- [ ] **Step 2: 创建 RoleController**

    import { _decorator, Component, Vec2 } from "cc";
    const { ccclass, property } = _decorator;

    @ccclass("RoleController")
    export class RoleController extends Component {
      @property speed = 240;
      private moveInput = Vec2.ZERO;

      setMoveInput(input: Vec2): void {
        this.moveInput = input.lengthSqr() > 1 ? input.normalize() : input;
      }

      update(dt: number): void {
        const p = this.node.position;
        this.node.setPosition(
          p.x + this.moveInput.x * this.speed * dt,
          p.y + this.moveInput.y * this.speed * dt,
          p.z
        );
      }
    }

- [ ] **Step 3: 在 battle.prefab 中创建 Role 节点**

    In Cocos Creator 3.8.8:
    1. Open assets/bundle/gui/battle/battle.prefab.
    2. Add child node Role under the gameplay root.
    3. Attach RoleController.
    4. Add a visible placeholder sprite and collider matching the greybox scale.
    5. Save the prefab and its generated meta state.

- [ ] **Step 4: 让 BattleModule 管理进入与离开**

    export class BattleModule {
      enter(): void {
        oops.message.dispatchEvent(GameEvent.BattleStarted);
      }

      leave(): void {
        oops.message.dispatchEvent(GameEvent.BattleEnded);
      }
    }

- [ ] **Step 5: Creator 手动验收**

    Run main scene.
    Enter Battle.
    Move the virtual input in all directions, switch weapons, empty a magazine, and wait for reload.
    Expected: movement is frame-rate independent; shooting stops without a target; reload restores the magazine; leaving Battle removes all combat listeners.

- [ ] **Step 6: 运行回归并提交**

    Run: yarn test && yarn typecheck:test
    Expected: all domain tests pass.

    git add assets/script/game/role assets/script/game/battle assets/script/game/common/config/GameEvent.ts assets/bundle/gui/battle
    git commit -m "feat: integrate player combat controller"

## Plan Completion Gate

Run all unit tests, then complete a five-minute Creator combat session with movement, target switching, reload, overheat, weapon swap, roll and leave/re-enter. No duplicate event or input callback may appear.
