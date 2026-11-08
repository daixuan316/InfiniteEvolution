# Unified Vitality Combat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement one reusable health, shield, damage, zero-state, and repair system for the player, monsters, battle structures, and Ark modules, then connect it to the playable hospital battle HUD.

**Architecture:** Engine-neutral TypeScript classes own vitality and damage rules. `BattleSimulation` composes those rules into deterministic attacks and target selection, while `BattleHUDViewComp` only mirrors simulation state into Cocos nodes. Ark durability remains plain serializable data and crosses the shared runtime through pure adapter functions.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Oops Framework, Node.js built-in test runner, ECMAScript modules.

## Global Constraints

- Player zero health enters `downed`; monster zero health enters `dead`; battle structures and Ark modules enter `disabled`.
- Disabled structures and modules remain present and can be repaired; they are never permanently destroyed.
- Damage is applied shield first, then health.
- Invalid, negative, `NaN`, or infinite combat values never mutate state.
- Repeated damage against a non-active target never repeats its zero transition.
- Battle structures can be attacked and repaired, but this plan does not add placement costs, construction UI, or resource consumption.
- Keep all pure rules free of `cc` and Oops imports so Node tests can execute them directly.
- Preserve Cocos Creator 3.8.8 and all existing movement, pathfinding, animation, pause, and navigation behavior.

---

## File Structure

### Create

- `assets/script/game/combat.meta` — Cocos directory metadata for the shared combat domain.
- `assets/script/game/combat/Vitality.ts` — health, shield, zero-state, healing, shield restore, and repair runtime.
- `assets/script/game/combat/Vitality.ts.meta` — Cocos TypeScript metadata.
- `assets/script/game/combat/DamageResolver.ts` — validated defense-aware damage calculation.
- `assets/script/game/combat/DamageResolver.ts.meta` — Cocos TypeScript metadata.
- `assets/script/game/shelter.meta` — Cocos directory metadata for Ark/shelter rules.
- `assets/script/game/shelter/model.meta` — Cocos directory metadata for serializable shelter models.
- `assets/script/game/shelter/model/ArkModuleVitalityAdapter.ts` — pure Ark durability adapter using `VitalityRuntime`.
- `assets/script/game/shelter/model/ArkModuleVitalityAdapter.ts.meta` — Cocos TypeScript metadata.
- `tests/unit/combat/Vitality.test.mjs` — vitality boundary and transition tests.
- `tests/unit/combat/DamageResolver.test.mjs` — damage formula and validation tests.
- `tests/unit/shelter/ArkModuleVitalityAdapter.test.mjs` — module stop/repair tests.

### Modify

- `assets/script/game/battle/BattleSimulation.ts` — add combat stats, attack clocks, structures, targeting, damage, down/death behavior, and repair entry point.
- `assets/script/game/common/ui/UIBuilder.ts` — make progress bars reusable and updateable.
- `assets/script/game/battle/BattleHUDViewComp.ts` — bind health/shield/structure state to visible Cocos nodes.
- `tests/unit/battle/BattleSimulation.test.mjs` — add deterministic combat integration tests and adapt long-running pursuit assertions.
- `tests/integration/ui/BattleFlowBindings.test.mjs` — assert real vitality bindings replace static demo values.
- `package.json` — include combat and shelter unit directories in `test:battle`.

---

### Task 1: Shared Vitality Runtime

**Files:**

- Create: `assets/script/game/combat.meta`
- Create: `assets/script/game/combat/Vitality.ts`
- Create: `assets/script/game/combat/Vitality.ts.meta`
- Test: `tests/unit/combat/Vitality.test.mjs`

**Interfaces:**

- Consumes: finite numeric health, shield, damage, heal, and repair values.
- Produces: `VitalityState`, `VitalityConfig`, `VitalitySnapshot`, `VitalityChangeResult`, and `VitalityRuntime` with `applyDamage()`, `heal()`, `restoreShield()`, `repair()`, and `snapshot()`.

- [ ] **Step 1: Write failing shield and zero-transition tests**

```js
import assert from "node:assert/strict";
import test from "node:test";

import { VitalityRuntime } from "../../../assets/script/game/combat/Vitality.ts";

test("damage drains shield before health and reports the split", () => {
    const vitality = new VitalityRuntime({ maxHealth: 100, maxShield: 30, zeroState: "downed" });
    const result = vitality.applyDamage(50);

    assert.equal(result.accepted, true);
    assert.equal(result.shieldDamage, 30);
    assert.equal(result.healthDamage, 20);
    assert.equal(result.remainingHealth, 80);
    assert.equal(result.remainingShield, 0);
    assert.equal(result.becameZero, false);
});

test("zero transition is emitted only once", () => {
    const vitality = new VitalityRuntime({ maxHealth: 40, zeroState: "dead" });
    const lethal = vitality.applyDamage(100);
    const repeated = vitality.applyDamage(10);

    assert.equal(lethal.becameZero, true);
    assert.equal(lethal.state, "dead");
    assert.equal(repeated.accepted, false);
    assert.equal(repeated.reason, "inactive-target");
    assert.equal(repeated.becameZero, false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/unit/combat/Vitality.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `Vitality.ts`.

- [ ] **Step 3: Implement validated state and damage splitting**

```ts
export type VitalityState = "active" | "downed" | "dead" | "disabled";
export type VitalityZeroState = Exclude<VitalityState, "active">;
export type VitalityRejectReason = "invalid-amount" | "inactive-target" | "not-repairable";

export interface VitalityConfig {
    maxHealth: number;
    initialHealth?: number;
    maxShield?: number;
    initialShield?: number;
    zeroState: VitalityZeroState;
}

export interface VitalitySnapshot {
    health: number;
    maxHealth: number;
    shield: number;
    maxShield: number;
    healthRatio: number;
    shieldRatio: number;
    state: VitalityState;
}

export interface VitalityChangeResult extends VitalitySnapshot {
    accepted: boolean;
    reason?: VitalityRejectReason;
    requestedAmount: number;
    shieldDamage: number;
    healthDamage: number;
    restoredHealth: number;
    restoredShield: number;
    becameZero: boolean;
    remainingHealth: number;
    remainingShield: number;
}

export class VitalityRuntime {
    readonly maxHealth: number;
    readonly maxShield: number;
    readonly zeroState: VitalityZeroState;
    currentHealth: number;
    currentShield: number;
    state: VitalityState;

    constructor(config: VitalityConfig) {
        if (!Number.isFinite(config.maxHealth) || config.maxHealth <= 0) throw new RangeError("maxHealth must be finite and positive");
        const maxShield = config.maxShield ?? 0;
        if (!Number.isFinite(maxShield) || maxShield < 0) throw new RangeError("maxShield must be finite and non-negative");
        if (config.initialHealth !== undefined && !Number.isFinite(config.initialHealth)) throw new RangeError("initialHealth must be finite");
        if (config.initialShield !== undefined && !Number.isFinite(config.initialShield)) throw new RangeError("initialShield must be finite");
        this.maxHealth = config.maxHealth;
        this.maxShield = maxShield;
        this.zeroState = config.zeroState;
        this.currentHealth = clamp(config.initialHealth ?? config.maxHealth, 0, config.maxHealth);
        this.currentShield = clamp(config.initialShield ?? maxShield, 0, maxShield);
        this.state = this.currentHealth === 0 ? config.zeroState : "active";
    }

    get healthRatio(): number { return this.currentHealth / this.maxHealth; }
    get shieldRatio(): number { return this.maxShield > 0 ? this.currentShield / this.maxShield : 0; }
    get active(): boolean { return this.state === "active"; }

    applyDamage(amount: number): VitalityChangeResult {
        if (!validPositive(amount)) return this.result(false, amount, "invalid-amount");
        if (!this.active) return this.result(false, amount, "inactive-target");
        const shieldDamage = Math.min(this.currentShield, amount);
        this.currentShield -= shieldDamage;
        const healthDamage = Math.min(this.currentHealth, amount - shieldDamage);
        this.currentHealth -= healthDamage;
        const becameZero = this.currentHealth === 0;
        if (becameZero) this.state = this.zeroState;
        return this.result(true, amount, undefined, shieldDamage, healthDamage, 0, 0, becameZero);
    }

    heal(amount: number): VitalityChangeResult {
        if (!validPositive(amount)) return this.result(false, amount, "invalid-amount");
        if (!this.active) return this.result(false, amount, "inactive-target");
        const restored = Math.min(amount, this.maxHealth - this.currentHealth);
        this.currentHealth += restored;
        return this.result(true, amount, undefined, 0, 0, restored);
    }

    restoreShield(amount: number): VitalityChangeResult {
        if (!validPositive(amount)) return this.result(false, amount, "invalid-amount");
        if (!this.active) return this.result(false, amount, "inactive-target");
        const restored = Math.min(amount, this.maxShield - this.currentShield);
        this.currentShield += restored;
        return this.result(true, amount, undefined, 0, 0, 0, restored);
    }

    repair(amount: number): VitalityChangeResult {
        if (!validPositive(amount)) return this.result(false, amount, "invalid-amount");
        if (this.zeroState !== "disabled") return this.result(false, amount, "not-repairable");
        const restored = Math.min(amount, this.maxHealth - this.currentHealth);
        this.currentHealth += restored;
        if (this.currentHealth > 0) this.state = "active";
        return this.result(true, amount, undefined, 0, 0, restored);
    }

    snapshot(): VitalitySnapshot {
        return {
            health: this.currentHealth,
            maxHealth: this.maxHealth,
            shield: this.currentShield,
            maxShield: this.maxShield,
            healthRatio: this.healthRatio,
            shieldRatio: this.shieldRatio,
            state: this.state,
        };
    }

    private result(
        accepted: boolean,
        requestedAmount: number,
        reason?: VitalityRejectReason,
        shieldDamage = 0,
        healthDamage = 0,
        restoredHealth = 0,
        restoredShield = 0,
        becameZero = false,
    ): VitalityChangeResult {
        return {
            ...this.snapshot(),
            accepted,
            reason,
            requestedAmount,
            shieldDamage,
            healthDamage,
            restoredHealth,
            restoredShield,
            becameZero,
            remainingHealth: this.currentHealth,
            remainingShield: this.currentShield,
        };
    }
}

function validPositive(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
}
```

- [ ] **Step 4: Add invalid-input and repair-reactivation tests**

```js
test("invalid amounts never mutate vitality", () => {
    const vitality = new VitalityRuntime({ maxHealth: 100, zeroState: "downed" });
    for (const amount of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.equal(vitality.applyDamage(amount).accepted, false);
    }
    assert.equal(vitality.currentHealth, 100);
});

test("disabled structures reactivate after repair", () => {
    const vitality = new VitalityRuntime({ maxHealth: 60, zeroState: "disabled" });
    vitality.applyDamage(100);
    const repaired = vitality.repair(15);

    assert.equal(repaired.accepted, true);
    assert.equal(repaired.state, "active");
    assert.equal(repaired.remainingHealth, 15);
});

test("repair cannot revive dead actors", () => {
    const vitality = new VitalityRuntime({ maxHealth: 60, zeroState: "dead" });
    vitality.applyDamage(100);
    assert.equal(vitality.repair(15).reason, "not-repairable");
    assert.equal(vitality.state, "dead");
});
```

- [ ] **Step 5: Add exact Cocos metadata**

Create `assets/script/game/combat.meta` with directory UUID `77a0e1b0-8d6a-4f6e-8d1d-0a5edda41c01` and `Vitality.ts.meta` with TypeScript UUID `77a0e1b0-8d6a-4f6e-8d1d-0a5edda41c02`, following the existing `battle.meta` and `BattleSimulation.ts.meta` schemas.

- [ ] **Step 6: Run focused tests and verify GREEN**

Run: `node --test tests/unit/combat/Vitality.test.mjs`

Expected: all vitality tests PASS.

- [ ] **Step 7: Commit the vitality core**

```powershell
git add -- assets/script/game/combat.meta assets/script/game/combat/Vitality.ts assets/script/game/combat/Vitality.ts.meta tests/unit/combat/Vitality.test.mjs
git commit -m "feat: add shared vitality runtime"
```

---

### Task 2: Damage Request and Resolver

**Files:**

- Create: `assets/script/game/combat/DamageResolver.ts`
- Create: `assets/script/game/combat/DamageResolver.ts.meta`
- Test: `tests/unit/combat/DamageResolver.test.mjs`

**Interfaces:**

- Consumes: `DamageRequest` containing IDs, base damage, defense, multipliers, additive bonuses, and tags.
- Produces: `DamageResolution` and `resolveDamage(request)`.

- [ ] **Step 1: Write failing formula and validation tests**

```js
import assert from "node:assert/strict";
import test from "node:test";

import { resolveDamage } from "../../../assets/script/game/combat/DamageResolver.ts";

const validRequest = {
    sourceId: "player",
    targetId: "enemy-0",
    baseDamage: 100,
    defense: 100,
    skillMultiplier: 1,
    additiveBonuses: [0.2, 0.3],
    criticalMultiplier: 1,
    weakpointMultiplier: 1,
    tags: ["physical", "ranged"],
};

test("same-pool bonuses add before defense reduction", () => {
    const result = resolveDamage(validRequest);
    assert.equal(result.accepted, true);
    assert.equal(result.rawDamage, 150);
    assert.equal(result.reduction, 0.5);
    assert.equal(result.amount, 75);
});

test("a valid hit always deals at least one damage", () => {
    const result = resolveDamage({ ...validRequest, baseDamage: 1, defense: 99999, additiveBonuses: [] });
    assert.equal(result.amount, 1);
});

test("invalid numeric inputs are rejected", () => {
    for (const patch of [
        { baseDamage: -1 },
        { defense: -1 },
        { skillMultiplier: 0 },
        { criticalMultiplier: Number.NaN },
        { additiveBonuses: [Number.POSITIVE_INFINITY] },
    ]) {
        assert.equal(resolveDamage({ ...validRequest, ...patch }).accepted, false);
    }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/unit/combat/DamageResolver.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `DamageResolver.ts`.

- [ ] **Step 3: Implement the resolver**

```ts
export interface DamageRequest {
    sourceId: string;
    targetId: string;
    baseDamage: number;
    defense: number;
    skillMultiplier?: number;
    additiveBonuses?: readonly number[];
    criticalMultiplier?: number;
    weakpointMultiplier?: number;
    tags?: readonly string[];
}

export interface DamageResolution {
    accepted: boolean;
    reason?: "invalid-request";
    sourceId: string;
    targetId: string;
    rawDamage: number;
    reduction: number;
    amount: number;
    tags: readonly string[];
}

export function resolveDamage(request: DamageRequest): DamageResolution {
    const skill = request.skillMultiplier ?? 1;
    const critical = request.criticalMultiplier ?? 1;
    const weakpoint = request.weakpointMultiplier ?? 1;
    const bonuses = request.additiveBonuses ?? [];
    const valid = request.sourceId.length > 0
        && request.targetId.length > 0
        && Number.isFinite(request.baseDamage) && request.baseDamage > 0
        && Number.isFinite(request.defense) && request.defense >= 0
        && Number.isFinite(skill) && skill > 0
        && Number.isFinite(critical) && critical > 0
        && Number.isFinite(weakpoint) && weakpoint > 0
        && bonuses.every(Number.isFinite)
        && 1 + bonuses.reduce((sum, value) => sum + value, 0) > 0;
    if (!valid) return rejected(request);
    const rawDamage = request.baseDamage * skill
        * (1 + bonuses.reduce((sum, value) => sum + value, 0))
        * critical * weakpoint;
    const reduction = request.defense / (request.defense + 100);
    return {
        accepted: true,
        sourceId: request.sourceId,
        targetId: request.targetId,
        rawDamage,
        reduction,
        amount: Math.max(1, Math.round(rawDamage * (1 - reduction))),
        tags: Object.freeze([...(request.tags ?? [])]),
    };
}

function rejected(request: DamageRequest): DamageResolution {
    return {
        accepted: false,
        reason: "invalid-request",
        sourceId: request.sourceId,
        targetId: request.targetId,
        rawDamage: 0,
        reduction: 0,
        amount: 0,
        tags: Object.freeze([...(request.tags ?? [])]),
    };
}
```

- [ ] **Step 4: Add Cocos metadata**

Create `DamageResolver.ts.meta` with TypeScript UUID `77a0e1b0-8d6a-4f6e-8d1d-0a5edda41c03` and the same schema as other TypeScript metadata files.

- [ ] **Step 5: Run both combat rule suites**

Run: `node --test tests/unit/combat/*.test.mjs`

Expected: all vitality and damage tests PASS.

- [ ] **Step 6: Commit the resolver**

```powershell
git add -- assets/script/game/combat/DamageResolver.ts assets/script/game/combat/DamageResolver.ts.meta tests/unit/combat/DamageResolver.test.mjs
git commit -m "feat: resolve validated combat damage"
```

---

### Task 3: Ark Module Vitality Adapter

**Files:**

- Create: `assets/script/game/shelter.meta`
- Create: `assets/script/game/shelter/model.meta`
- Create: `assets/script/game/shelter/model/ArkModuleVitalityAdapter.ts`
- Create: `assets/script/game/shelter/model/ArkModuleVitalityAdapter.ts.meta`
- Test: `tests/unit/shelter/ArkModuleVitalityAdapter.test.mjs`

**Interfaces:**

- Consumes: serializable `ArkModuleDurabilityState` and finite positive damage or repair amount.
- Produces: `damageArkModule(state, amount)` and `repairArkModule(state, amount)` returning the same object shape with updated durability flags.

- [ ] **Step 1: Write failing stop-and-repair tests**

```js
import assert from "node:assert/strict";
import test from "node:test";

import { damageArkModule, repairArkModule } from "../../../assets/script/game/shelter/model/ArkModuleVitalityAdapter.ts";

test("Ark module stops at zero without permanent destruction", () => {
    const result = damageArkModule({ id: "turret-1", durability: 10, maxDurability: 100, operational: true, destroyed: false }, 25);
    assert.deepEqual(result, {
        id: "turret-1",
        durability: 0,
        maxDurability: 100,
        operational: false,
        destroyed: false,
    });
});

test("repair reactivates a disabled Ark module", () => {
    const result = repairArkModule({ id: "turret-1", durability: 0, maxDurability: 100, operational: false, destroyed: false }, 30);
    assert.equal(result.durability, 30);
    assert.equal(result.operational, true);
    assert.equal(result.destroyed, false);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/unit/shelter/ArkModuleVitalityAdapter.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement pure conversion through `VitalityRuntime`**

```ts
import { VitalityRuntime } from "../../combat/Vitality.ts";

export interface ArkModuleDurabilityState {
    durability: number;
    maxDurability: number;
    operational: boolean;
    destroyed: boolean;
}

function createRuntime(state: ArkModuleDurabilityState): VitalityRuntime {
    return new VitalityRuntime({
        maxHealth: state.maxDurability,
        initialHealth: state.durability,
        zeroState: "disabled",
    });
}

function project<T extends ArkModuleDurabilityState>(state: T, runtime: VitalityRuntime): T {
    return {
        ...state,
        durability: runtime.currentHealth,
        operational: runtime.active,
        destroyed: false,
    };
}

export function damageArkModule<T extends ArkModuleDurabilityState>(state: T, amount: number): T {
    const runtime = createRuntime(state);
    runtime.applyDamage(amount);
    return project(state, runtime);
}

export function repairArkModule<T extends ArkModuleDurabilityState>(state: T, amount: number): T {
    const runtime = createRuntime(state);
    runtime.repair(amount);
    return project(state, runtime);
}
```

- [ ] **Step 4: Test invalid damage and repair limits**

```js
test("invalid amounts preserve durability and repair clamps to the maximum", () => {
    const base = { id: "core", durability: 25, maxDurability: 100, operational: true, destroyed: false };
    assert.deepEqual(damageArkModule(base, Number.NaN), base);
    assert.equal(repairArkModule(base, 1000).durability, 100);
});

test("adapter always clears permanent destruction", () => {
    const repaired = repairArkModule({ id: "core", durability: 0, maxDurability: 100, operational: false, destroyed: true }, 10);
    assert.equal(repaired.destroyed, false);
    assert.equal(repaired.operational, true);
});
```

- [ ] **Step 5: Add exact Cocos metadata**

Use directory UUIDs `77a0e1b0-8d6a-4f6e-8d1d-0a5edda41c04` for `shelter.meta` and `77a0e1b0-8d6a-4f6e-8d1d-0a5edda41c05` for `model.meta`. Use TypeScript UUID `77a0e1b0-8d6a-4f6e-8d1d-0a5edda41c06` for the adapter metadata.

- [ ] **Step 6: Run the adapter and combat suites**

Run: `node --test tests/unit/combat/*.test.mjs tests/unit/shelter/*.test.mjs`

Expected: all tests PASS.

- [ ] **Step 7: Commit Ark reuse**

```powershell
git add -- assets/script/game/shelter.meta assets/script/game/shelter/model.meta assets/script/game/shelter/model/ArkModuleVitalityAdapter.ts assets/script/game/shelter/model/ArkModuleVitalityAdapter.ts.meta tests/unit/shelter/ArkModuleVitalityAdapter.test.mjs
git commit -m "feat: reuse vitality for Ark modules"
```

---

### Task 4: Deterministic Battle Damage Loop and Repairable Barricade

**Files:**

- Modify: `assets/script/game/battle/BattleSimulation.ts`
- Modify: `tests/unit/battle/BattleSimulation.test.mjs`

**Interfaces:**

- Consumes: `VitalityRuntime`, `resolveDamage()`, the hospital map, and existing movement/pathfinding updates.
- Produces: combat-aware `BattleActor`, `BattleStructure`, `activeEnemies`, `structures`, `repairStructure(id, amount)`, timed player shots, and timed monster melee hits.

- [ ] **Step 1: Add failing player attack and death-filter tests**

```js
test("player auto-fire damages and kills only active enemies", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + 100;
    enemy.y = simulation.player.y;

    const before = enemy.vitality.currentHealth;
    advance(simulation, 0.4);
    assert.ok(enemy.vitality.currentHealth < before);

    advance(simulation, 5);
    assert.equal(enemy.vitality.state, "dead");
    assert.equal(simulation.activeEnemies.includes(enemy), false);
    assert.notEqual(simulation.playerTarget?.id, enemy.id);
});
```

- [ ] **Step 2: Add failing barricade and player-down tests**

```js
test("monsters damage a nearby barricade on attack intervals and it can be repaired", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    const barricade = simulation.structures[0];
    enemy.x = barricade.x + enemy.radius + barricade.radius + simulation.meleeAttackMargin - 1;
    enemy.y = barricade.y;

    const before = barricade.vitality.currentHealth;
    advance(simulation, 0.2);
    assert.ok(barricade.vitality.currentHealth < before);

    barricade.vitality.applyDamage(9999);
    assert.equal(barricade.vitality.state, "disabled");
    assert.equal(simulation.repairStructure(barricade.id, 80).accepted, true);
    assert.equal(barricade.vitality.state, "active");
});

test("downed player cannot move, dodge, or attack", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    simulation.player.vitality.applyDamage(9999);
    const before = { x: simulation.player.x, y: simulation.player.y };
    simulation.setMoveInput(1, 0);
    simulation.setSprinting(true);

    assert.equal(simulation.tryDodge(), false);
    assert.equal(simulation.setPlayerDestination({ x: before.x + 200, y: before.y }), false);
    advance(simulation, 1);
    assert.deepEqual({ x: simulation.player.x, y: simulation.player.y }, before);
    assert.equal(simulation.playerAutoAttacking, false);
});
```

- [ ] **Step 3: Run battle tests and verify RED**

Run: `node --test tests/unit/battle/BattleSimulation.test.mjs`

Expected: FAIL because combat stats, structures, and `activeEnemies` do not exist.

- [ ] **Step 4: Add combat entity types and deterministic defaults**

```ts
import { resolveDamage } from "../combat/DamageResolver.ts";
import { VitalityRuntime, type VitalityChangeResult } from "../combat/Vitality.ts";

interface CombatTarget extends WorldPoint {
    readonly id: string;
    readonly radius: number;
    readonly defense: number;
    readonly vitality: VitalityRuntime;
}

export interface BattleActor extends CombatTarget {
    readonly speed: number;
}

export interface BattleStructure extends CombatTarget {
    readonly kind: "barricade";
}

interface EnemyAgent extends BattleActor {
    attackDamage: number;
    attackInterval: number;
    attackCooldown: number;
    path: GridPoint[];
    pathIndex: number;
    repathIn: number;
    targetCellKey: string;
    attacking: boolean;
}

const ENEMY_COMBAT = [
    { health: 90, defense: 5, damage: 18, interval: 1 },
    { health: 70, defense: 0, damage: 12, interval: 0.55 },
    { health: 130, defense: 12, damage: 24, interval: 1.1 },
    { health: 360, defense: 25, damage: 42, interval: 1.4 },
] as const;
```

Create player vitality `{ maxHealth: 420, maxShield: 180, zeroState: "downed" }`, player defense `20`, and one barricade at `map.cellToWorld({ x: 10, y: 4 })` with radius `54`, defense `30`, and vitality `{ maxHealth: 600, zeroState: "disabled" }`. Verify this point with `map.isWorldWalkable(position, radius)` in a test.

- [ ] **Step 5: Implement player shot timing and active target filtering**

Replace the presentation-only `updateAutoAttack()` with `updateAutoAttack(dt)`:

```ts
private playerAttackCooldown = 0;
readonly playerAttackInterval = 0.35;
readonly playerAttackDamage = 35;

get activeEnemies(): EnemyAgent[] {
    return this.enemies.filter((enemy) => enemy.vitality.active);
}

private updateAutoAttack(dt: number): void {
    this.playerAttackCooldown = Math.max(0, this.playerAttackCooldown - dt);
    if (!this.player.vitality.active) {
        this.playerTarget = null;
        this.playerAutoAttacking = false;
        return;
    }
    let target: EnemyAgent | null = null;
    let targetDistance = Number.POSITIVE_INFINITY;
    for (const enemy of this.activeEnemies) {
        const enemyDistance = distance(enemy, this.player);
        if (enemyDistance <= this.autoAttackRange && enemyDistance < targetDistance) {
            target = enemy;
            targetDistance = enemyDistance;
        }
    }
    this.playerTarget = target;
    this.playerAutoAttacking = this.playerTarget !== null;
    if (!this.playerTarget || this.playerAttackCooldown > 0) return;
    this.applyResolvedDamage(this.player, this.playerTarget, this.playerAttackDamage, ["physical", "ranged"]);
    this.playerAttackCooldown = this.playerAttackInterval;
    if (!this.playerTarget.vitality.active) this.playerTarget = null;
}
```

- [ ] **Step 6: Implement monster structure targeting and attack clocks**

Add `selectEnemyTarget(enemy)` that chooses the nearest active structure within `structureAggroRange = 300`; otherwise it returns the active player; otherwise `null`. Change `updateEnemies(dt)` to path toward that target cell, calculate attack range from both radii plus `meleeAttackMargin`, and apply damage only when `attackCooldown <= 0`.

```ts
private updateEnemyAttack(enemy: EnemyAgent, target: CombatTarget): void {
    if (enemy.attackCooldown > 0) return;
    this.applyResolvedDamage(enemy, target, enemy.attackDamage, ["physical", "melee"]);
    enemy.attackCooldown = enemy.attackInterval;
}

private applyResolvedDamage(source: CombatTarget, target: CombatTarget, baseDamage: number, tags: readonly string[]): VitalityChangeResult {
    const resolution = resolveDamage({
        sourceId: source.id,
        targetId: target.id,
        baseDamage,
        defense: target.defense,
        tags,
    });
    return resolution.accepted
        ? target.vitality.applyDamage(resolution.amount)
        : target.vitality.applyDamage(Number.NaN);
}
```

Dead enemies must clear path state and skip all movement/attack updates. Disabled structures must no longer be selected. A downed player must no longer be attacked.

- [ ] **Step 7: Enforce downed input and add repair entry point**

Guard `setMoveInput()`, `setSprinting()`, `tryDodge()`, and `setPlayerDestination()` with `player.vitality.active`. At the start of `update()`, clear movement/path/sprint state for a non-active player. Add:

```ts
repairStructure(id: string, amount: number): VitalityChangeResult | null {
    const structure = this.structures.find((candidate) => candidate.id === id);
    return structure ? structure.vitality.repair(amount) : null;
}
```

Add `assert.equal(simulation.repairStructure("missing", 10), null)` to the barricade test so the missing-ID contract is fixed.

- [ ] **Step 8: Adapt legacy pursuit tests to combat state**

Replace the existing 90-second “all enemies attack the player” assertion with a bounded approach test that advances until each active enemy reaches either its selected target or a maximum of 25 seconds. Keep the collision and non-overlap assertions. Do not disable combat globally just to preserve the old test.

- [ ] **Step 9: Run all pure combat and battle tests**

Run: `node --test tests/unit/combat/*.test.mjs tests/unit/shelter/*.test.mjs tests/unit/battle/*.test.mjs`

Expected: all suites PASS, including movement/pathfinding regressions.

- [ ] **Step 10: Commit the playable damage loop**

```powershell
git add -- assets/script/game/battle/BattleSimulation.ts tests/unit/battle/BattleSimulation.test.mjs
git commit -m "feat: integrate battle vitality and attacks"
```

---

### Task 5: Dynamic HUD Vitality and Structure Presentation

**Files:**

- Modify: `assets/script/game/common/ui/UIBuilder.ts`
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Modify: `tests/integration/ui/BattleFlowBindings.test.mjs`
- Modify: `package.json`

**Interfaces:**

- Consumes: `BattleSimulation.player.vitality`, `enemy.vitality`, `simulation.activeEnemies`, and `simulation.structures`.
- Produces: `UIBuilder.setProgressBarRatio(track, ratio)`, dynamic player and enemy bars, hidden dead enemies, visible barricade durability/disabled state, and a player-down indicator.

- [ ] **Step 1: Write failing static integration assertions**

```js
test("Battle HUD binds player, enemy, and structure vitality", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /simulation\.player\.vitality/);
    assert.match(source, /enemy\.vitality\.healthRatio/);
    assert.match(source, /simulation\.structures/);
    assert.match(source, /UIBuilder\.setProgressBarRatio/);
    assert.doesNotMatch(source, /\["Walker", "gui\/battle-hud\/actors\/walker", 112, 0\.38\]/);
});

test("dynamic maps exclude dead monsters", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /simulation\.activeEnemies/);
});
```

- [ ] **Step 2: Run integration test and verify RED**

Run: `node --test tests/integration/ui/BattleFlowBindings.test.mjs`

Expected: FAIL because the HUD still uses hard-coded demo health values.

- [ ] **Step 3: Make `UIBuilder` progress bars updateable**

Change `progressBar()` to always create `${name}Fill`, even at ratio zero, and delegate geometry to:

```ts
static setProgressBarRatio(track: Node, ratio: number): void {
    const clamped = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
    const trackSize = track.getComponent(UITransform)?.contentSize;
    const fill = track.getChildByName(`${track.name}Fill`);
    const fillTransform = fill?.getComponent(UITransform);
    const graphics = fill?.getComponent(Graphics);
    if (!trackSize || !fill || !fillTransform || !graphics) return;
    const inset = 7;
    const height = Math.max(0, trackSize.height - inset * 2);
    const availableWidth = Math.max(0, trackSize.width - inset * 2);
    const width = availableWidth * clamped;
    fillTransform.setContentSize(width, height);
    fill.setPosition(-(availableWidth - width) / 2, 0);
    fill.active = width > 0;
    graphics.clear();
    if (width > 0) {
        graphics.roundRect(-width / 2, -height / 2, width, height, 4);
        graphics.fill();
    }
}
```

Set `graphics.fillColor` before the first call and preserve it across redraws.

- [ ] **Step 4: Store HUD references instead of demo values**

Add fields for player health/shield labels and bars, enemy bars, the barricade node/bar/status label, and the downed label. Change the actor asset tuples to `[name, asset, size]` and create bars at ratio `1` from simulation state.

Create a simple barricade with `Graphics` primitives so no new art asset is required. Set its position from `simulation.structures[0]`, give it a durability bar, and add a `UIOpacity` component for disabled dimming.

- [ ] **Step 5: Add one state synchronization method**

```ts
private syncVitality(): void {
    const player = this.simulation.player.vitality;
    this.playerHealthText.string = `${Math.ceil(player.currentHealth)} / ${player.maxHealth}`;
    this.playerShieldText.string = `护盾  ${Math.ceil(player.currentShield)} / ${player.maxShield}`;
    UIBuilder.setProgressBarRatio(this.playerHealthBar, player.healthRatio);
    UIBuilder.setProgressBarRatio(this.playerShieldBar, player.shieldRatio);
    this.downedLabel.node.active = player.state === "downed";

    this.simulation.enemies.forEach((enemy, index) => {
        const visible = enemy.vitality.state !== "dead";
        this.enemyNodes[index].active = visible;
        UIBuilder.setProgressBarRatio(this.enemyHealthBars[index], enemy.vitality.healthRatio);
    });

    const structure = this.simulation.structures[0];
    UIBuilder.setProgressBarRatio(this.structureHealthBar, structure.vitality.healthRatio);
    this.structureStatusLabel.string = structure.vitality.state === "disabled" ? "路障 · 已失效" : `路障 ${Math.ceil(structure.vitality.currentHealth)} / ${structure.vitality.maxHealth}`;
    this.structureNode.getComponent(UIOpacity)!.opacity = structure.vitality.state === "disabled" ? 110 : 255;
}
```

Call `syncVitality()` after each simulation update and once during initial render. Change both minimap render loops to use `simulation.activeEnemies` so dead monsters disappear immediately.

- [ ] **Step 6: Update the battle test script**

Change `package.json` to:

```json
"test:battle": "node --test tests/unit/combat/*.test.mjs tests/unit/shelter/*.test.mjs tests/unit/battle/*.test.mjs"
```

Do not change unrelated scripts or dependencies.

- [ ] **Step 7: Run focused HUD and battle tests**

Run: `npm run test:battle`

Expected: combat, shelter, and battle tests PASS.

Run: `node --test tests/integration/ui/BattleFlowBindings.test.mjs`

Expected: all battle binding assertions PASS.

- [ ] **Step 8: Commit dynamic presentation**

```powershell
git add -- assets/script/game/common/ui/UIBuilder.ts assets/script/game/battle/BattleHUDViewComp.ts tests/integration/ui/BattleFlowBindings.test.mjs package.json
git commit -m "feat: bind battle HUD to vitality state"
```

---

### Task 6: Full Regression and Cocos Acceptance

**Files:**

- Verify only; fix failures in the owning task files.

**Interfaces:**

- Consumes: the completed shared vitality, damage, Ark adapter, battle simulation, and HUD work.
- Produces: evidence that automated regressions pass and a concise record of any Creator-only manual check that remains.

- [ ] **Step 1: Run the complete automated test surface**

Run: `npm run test:battle`

Expected: all combat, shelter, map, camera, pathfinder, and battle simulation tests PASS.

Run: `npm run test:ui`

Expected: all UI unit tests, battle unit tests, and UI integration tests PASS.

- [ ] **Step 2: Run repository hygiene checks**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: only known user-owned changes, if any; no generated cache or accidental asset files from this feature.

- [ ] **Step 3: Perform Cocos Creator 3.8.8 manual acceptance when the editor is available**

Open `assets/main.scene`, enter the hospital battle page, and verify:

1. Player shots lower the nearest living monster bar.
2. A killed monster disappears from the world and minimap.
3. Monsters lower barricade durability on attack intervals.
4. A zero-durability barricade remains visible and says `路障 · 已失效`.
5. Calling `simulation.repairStructure("barricade-0", 80)` from a temporary debugger hook reactivates the barricade; remove the hook before committing.
6. Player damage drains 180 shield before 420 health.
7. At zero health, the player shows the downed label and no longer moves, dodges, sprints, or attacks.

If Creator is unavailable, report this check as not run; do not claim it passed based on Node tests.

- [ ] **Step 4: Commit only acceptance fixes if needed**

If a manual or regression failure required code changes, stage only the owning feature files and commit with a message describing the observed fix. If no changes were needed, do not create an empty commit.

## Plan Completion Gate

The implementation is complete only when `npm run test:battle` and `npm run test:ui` pass, `git diff --check` is clean, all four entity categories demonstrably share `VitalityRuntime`, and any unrun Cocos manual acceptance is explicitly reported rather than inferred.
