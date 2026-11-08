# Projectile Hit Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace instant player damage with visible homing projectiles that apply damage on impact, and add synchronized floating damage numbers plus hit flashes for projectile and melee hits.

**Architecture:** `BattleSimulation` remains the source of truth for projectile positions, impact timing, damage, and frame-local hit events. `BattleHUDViewComp` renders those existing simulation states with Cocos `Graphics`, `Label`, and `UIOpacity`; presentation never decides whether a hit occurred.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Oops Framework, Node.js built-in test runner, ECMAScript modules.

## Global Constraints

- Player attacks create projectiles and do not change target vitality until impact.
- Projectile speed is `1400` world units per second and lifetime is `1.2` seconds.
- Projectiles keep their original target ID, follow the target position, and never retarget.
- Dead or missing targets cancel their projectiles without damage.
- Projectile and melee damage both emit one `CombatHitEvent` containing actual shield and health loss.
- HUD feedback freezes whenever the existing paused/full-map early return freezes simulation updates.
- Do not add image assets, prefabs, dependencies, global Oops events, wall collision, penetration, spread, or critical-hit effects.
- Preserve the existing vitality, Ark durability, movement, pathfinding, animation, pause, and navigation behavior.

---

## File Structure

### Modify

- `assets/script/game/battle/BattleSimulation.ts` — projectile state, spawn/movement/impact, and frame-local hit events.
- `assets/script/game/battle/BattleHUDViewComp.ts` — projectile node synchronization, floating damage labels, hit-flash timers, and feedback cleanup.
- `tests/unit/battle/BattleSimulation.test.mjs` — projectile timing, cancellation, lifetime, and hit-event tests.
- `tests/integration/ui/BattleFlowBindings.test.mjs` — static bindings for projectile and hit feedback presentation.

No new production files or assets are required.

---

### Task 1: Real Projectile Simulation

**Files:**

- Modify: `assets/script/game/battle/BattleSimulation.ts`
- Modify: `tests/unit/battle/BattleSimulation.test.mjs`

**Interfaces:**

- Consumes: the existing player target, player attack interval/damage, `EnemyAgent`, and simulation `deltaTime`.
- Produces: `BattleProjectile`, `BattleSimulation.projectiles`, `projectileSpeed`, `projectileLifetime`, `spawnPlayerProjectile()`, and `updateProjectiles()`.

- [ ] **Step 1: Write failing impact-timing tests**

```js
test("player shots create a projectile and do not damage before impact", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + 280;
    enemy.y = simulation.player.y;
    const before = enemy.vitality.currentHealth;

    simulation.update(1 / 60);

    assert.equal(simulation.projectiles.length, 1);
    assert.equal(enemy.vitality.currentHealth, before);
    advance(simulation, 0.08);
    assert.equal(enemy.vitality.currentHealth, before);
});

test("projectile damages once on arrival and is removed", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + 280;
    enemy.y = simulation.player.y;
    const before = enemy.vitality.currentHealth;

    simulation.update(1 / 60);
    for (let index = 0; index < 30 && enemy.vitality.currentHealth === before; index++) {
        simulation.update(1 / 60);
    }

    assert.ok(enemy.vitality.currentHealth < before);
    assert.equal(simulation.projectiles.length, 0);
    const afterImpact = enemy.vitality.currentHealth;
    simulation.update(1 / 60);
    assert.equal(enemy.vitality.currentHealth, afterImpact);
});
```

- [ ] **Step 2: Run the focused suite and verify RED**

Run: `node --test tests/unit/battle/BattleSimulation.test.mjs`

Expected: FAIL because `simulation.projectiles` does not exist and player attacks still damage immediately.

- [ ] **Step 3: Add the projectile data contract**

```ts
export interface BattleProjectile extends WorldPoint {
    readonly id: string;
    readonly sourceId: string;
    readonly targetId: string;
    readonly speed: number;
    readonly baseDamage: number;
    readonly tags: readonly string[];
    remainingLifetime: number;
}

readonly projectileSpeed = 1400;
readonly projectileLifetime = 1.2;
readonly projectiles: BattleProjectile[] = [];
private nextProjectileId = 1;
```

- [ ] **Step 4: Replace instant player damage with projectile spawn**

```ts
private spawnPlayerProjectile(target: EnemyAgent): void {
    const dx = target.x - this.player.x;
    const dy = target.y - this.player.y;
    const length = Math.hypot(dx, dy);
    const direction = length > 0
        ? { x: dx / length, y: dy / length }
        : this.facing;
    this.projectiles.push({
        id: `projectile-${this.nextProjectileId++}`,
        sourceId: this.player.id,
        targetId: target.id,
        x: this.player.x + direction.x * this.player.radius,
        y: this.player.y + direction.y * this.player.radius,
        speed: this.projectileSpeed,
        baseDamage: this.playerAttackDamage,
        tags: Object.freeze(["physical", "ranged"]),
        remainingLifetime: this.projectileLifetime,
    });
}
```

In `updateAutoAttack()`, replace the direct `applyResolvedDamage()` call with `spawnPlayerProjectile(target)`. Keep the existing attack cooldown and animation-facing target assignment.

- [ ] **Step 5: Move and resolve projectiles after auto-fire**

Insert `updateProjectiles(dt)` between `updateAutoAttack(dt)` and `updateEnemies(dt)`:

```ts
private updateProjectiles(dt: number): void {
    for (let index = this.projectiles.length - 1; index >= 0; index--) {
        const projectile = this.projectiles[index];
        projectile.remainingLifetime -= dt;
        const target = this.enemies.find((enemy) => enemy.id === projectile.targetId && enemy.vitality.active);
        if (!target || projectile.remainingLifetime <= 0) {
            this.projectiles.splice(index, 1);
            continue;
        }
        const dx = target.x - projectile.x;
        const dy = target.y - projectile.y;
        const targetDistance = Math.hypot(dx, dy);
        const travel = projectile.speed * dt;
        if (targetDistance <= travel + target.radius) {
            this.applyResolvedDamage(this.player, target, projectile.baseDamage, projectile.tags, "projectile");
            this.projectiles.splice(index, 1);
            if (!target.vitality.active && this.playerTarget?.id === target.id) {
                this.playerTarget = null;
                this.playerAutoAttacking = false;
            }
            continue;
        }
        projectile.x += dx / targetDistance * travel;
        projectile.y += dy / targetDistance * travel;
    }
}
```

- [ ] **Step 6: Test cancellation and expiration**

```js
test("projectile disappears without damage when its target dies first", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + 280;
    enemy.y = simulation.player.y;
    simulation.update(1 / 60);
    assert.equal(simulation.projectiles.length, 1);

    enemy.vitality.applyDamage(9999);
    simulation.update(1 / 60);

    assert.equal(simulation.projectiles.length, 0);
});

test("projectile expires after its maximum lifetime", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + 280;
    enemy.y = simulation.player.y;
    simulation.update(1 / 60);
    enemy.x += 5000;

    advance(simulation, simulation.projectileLifetime + 0.1);

    assert.equal(simulation.projectiles.length, 0);
    assert.equal(enemy.vitality.currentHealth, enemy.vitality.maxHealth);
});
```

- [ ] **Step 7: Run focused tests and verify GREEN**

Run: `node --test tests/unit/battle/BattleSimulation.test.mjs`

Expected: all projectile timing, cancellation, lifetime, and existing battle simulation tests PASS.

- [ ] **Step 8: Commit projectile movement**

```powershell
git add -- assets/script/game/battle/BattleSimulation.ts tests/unit/battle/BattleSimulation.test.mjs
git commit -m "feat: simulate player projectiles"
```

---

### Task 2: Frame-Local Combat Hit Events

**Files:**

- Modify: `assets/script/game/battle/BattleSimulation.ts`
- Modify: `tests/unit/battle/BattleSimulation.test.mjs`

**Interfaces:**

- Consumes: `VitalityChangeResult` returned by `applyResolvedDamage()` for projectile and melee attacks.
- Produces: `CombatHitKind`, `CombatHitEvent`, `BattleSimulation.hitEvents`, and one event per accepted non-zero damage result.

- [ ] **Step 1: Write failing projectile and melee event tests**

```js
test("projectile impact emits actual health damage", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + 180;
    enemy.y = simulation.player.y;

    for (let index = 0; index < 30 && simulation.hitEvents.length === 0; index++) {
        simulation.update(1 / 60);
    }

    const event = simulation.hitEvents[0];
    assert.equal(event.kind, "projectile");
    assert.equal(event.sourceId, "player");
    assert.equal(event.targetId, enemy.id);
    assert.equal(event.shieldDamage, 0);
    assert.equal(event.healthDamage, event.amount);
    assert.equal(event.x, enemy.x);
    assert.equal(event.y, enemy.y);
});

test("melee event reports shield absorption and clears next frame", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    const attackRange = enemy.radius + simulation.player.radius + simulation.meleeAttackMargin;
    enemy.x = simulation.player.x + attackRange - 1;
    enemy.y = simulation.player.y;

    simulation.update(1 / 60);
    const event = simulation.hitEvents.find((candidate) => candidate.kind === "melee");
    assert.ok(event);
    assert.equal(event.targetId, "player");
    assert.ok(event.shieldDamage > 0);
    assert.equal(event.healthDamage, 0);
    assert.equal(event.amount, event.shieldDamage);
    const eventId = event.id;

    simulation.update(1 / 60);
    assert.equal(simulation.hitEvents.some((candidate) => candidate.id === eventId), false);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test tests/unit/battle/BattleSimulation.test.mjs`

Expected: FAIL because `hitEvents` and event metadata do not exist.

- [ ] **Step 3: Add the event contracts and frame reset**

```ts
export type CombatHitKind = "projectile" | "melee";

export interface CombatHitEvent extends WorldPoint {
    readonly id: string;
    readonly kind: CombatHitKind;
    readonly sourceId: string;
    readonly targetId: string;
    readonly amount: number;
    readonly shieldDamage: number;
    readonly healthDamage: number;
    readonly becameZero: boolean;
}

readonly hitEvents: CombatHitEvent[] = [];
private nextHitEventId = 1;
```

Make the first statement of `update(deltaTime)` be `this.hitEvents.length = 0;`, before any early combat decisions.

- [ ] **Step 4: Emit events from the shared damage path**

Change `applyResolvedDamage()` to accept `kind: CombatHitKind` and record the exact vitality result:

```ts
private applyResolvedDamage(
    source: CombatTarget,
    target: CombatTarget,
    baseDamage: number,
    tags: readonly string[],
    kind: CombatHitKind,
): VitalityChangeResult {
    const resolution = resolveDamage({
        sourceId: source.id,
        targetId: target.id,
        baseDamage,
        defense: target.defense,
        tags,
    });
    const result = target.vitality.applyDamage(resolution.accepted ? resolution.amount : Number.NaN);
    const amount = result.shieldDamage + result.healthDamage;
    if (result.accepted && amount > 0) {
        this.hitEvents.push({
            id: `hit-${this.nextHitEventId++}`,
            kind,
            sourceId: source.id,
            targetId: target.id,
            amount,
            shieldDamage: result.shieldDamage,
            healthDamage: result.healthDamage,
            becameZero: result.becameZero,
            x: target.x,
            y: target.y,
        });
    }
    return result;
}
```

Pass `"melee"` from `updateEnemyAttack()` and `"projectile"` from `updateProjectiles()`.

- [ ] **Step 5: Verify zero transitions in events**

```js
test("lethal projectile marks its hit event as a zero transition", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.vitality.currentHealth = 1;
    enemy.x = simulation.player.x + 120;
    enemy.y = simulation.player.y;

    for (let index = 0; index < 30 && simulation.hitEvents.length === 0; index++) {
        simulation.update(1 / 60);
    }

    assert.equal(simulation.hitEvents[0].becameZero, true);
    assert.equal(enemy.vitality.state, "dead");
});
```

- [ ] **Step 6: Run battle and combat regressions**

Run: `npm run test:battle`

Expected: projectile/event tests plus all existing vitality, Ark, map, pathfinding, and battle tests PASS.

- [ ] **Step 7: Commit simulation and event behavior**

```powershell
git add -- assets/script/game/battle/BattleSimulation.ts tests/unit/battle/BattleSimulation.test.mjs
git commit -m "feat: simulate projectiles and hit events"
```

---

### Task 3: Projectile Rendering, Damage Numbers, and Hit Flashes

**Files:**

- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Modify: `tests/integration/ui/BattleFlowBindings.test.mjs`

**Interfaces:**

- Consumes: `simulation.projectiles`, `simulation.hitEvents`, actor nodes, structure node, and `deltaTime`.
- Produces: projectile node map, world-space damage feedback states, hit-flash timers, and deterministic pause-aware presentation updates.

- [ ] **Step 1: Write failing static binding tests**

```js
test("Battle HUD renders simulation projectiles", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /simulation\.projectiles/);
    assert.match(source, /projectileNodes = new Map<string, Node>/);
    assert.match(source, /syncProjectiles\(\)/);
    assert.match(source, /createProjectileNode/);
});

test("Battle HUD consumes hit events into timed feedback", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /simulation\.hitEvents/);
    assert.match(source, /damageFeedbacks/);
    assert.match(source, /hitFlashRemaining/);
    assert.match(source, /updateCombatFeedback\(deltaTime\)/);
    assert.match(source, /0\.65/);
    assert.match(source, /0\.12/);
});
```

- [ ] **Step 2: Run binding tests and verify RED**

Run: `node --test tests/integration/ui/BattleFlowBindings.test.mjs`

Expected: FAIL because projectile and hit-feedback members do not exist.

- [ ] **Step 3: Add presentation state and actor opacity components**

```ts
interface DamageFeedback {
    readonly node: Node;
    readonly opacity: UIOpacity;
    readonly startX: number;
    readonly startY: number;
    readonly duration: number;
    elapsed: number;
}

private readonly projectileNodes = new Map<string, Node>();
private readonly damageFeedbacks: DamageFeedback[] = [];
private readonly hitFlashRemaining = new Map<string, number>();
private readonly consumedHitEvents = new Set<string>();
```

In `createActor()`, add `actor.addComponent(UIOpacity)`. Keep the existing structure `UIOpacity` component.

- [ ] **Step 4: Draw and synchronize projectile nodes**

```ts
private createProjectileNode(id: string): Node {
    const node = this.createNode(this.worldLayer, `Projectile:${id}`, new Size(44, 18), Vec3.ZERO);
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color(255, 244, 184, 255);
    graphics.circle(8, 0, 4.5);
    graphics.fill();
    graphics.strokeColor = new Color(255, 151, 31, 230);
    graphics.lineWidth = 5;
    graphics.moveTo(-18, 0);
    graphics.lineTo(5, 0);
    graphics.stroke();
    graphics.strokeColor = new Color(255, 220, 112, 90);
    graphics.lineWidth = 10;
    graphics.moveTo(-12, 0);
    graphics.lineTo(8, 0);
    graphics.stroke();
    return node;
}

private syncProjectiles(): void {
    const activeIds = new Set<string>();
    for (const projectile of this.simulation.projectiles) {
        activeIds.add(projectile.id);
        const node = this.projectileNodes.get(projectile.id) ?? this.createProjectileNode(projectile.id);
        this.projectileNodes.set(projectile.id, node);
        node.setPosition(projectile.x, projectile.y);
        const target = this.simulation.enemies.find((enemy) => enemy.id === projectile.targetId);
        if (target) {
            const angle = Math.atan2(target.y - projectile.y, target.x - projectile.x) * 180 / Math.PI;
            node.setRotationFromEuler(0, 0, angle);
        }
    }
    for (const [id, node] of this.projectileNodes) {
        if (activeIds.has(id)) continue;
        node.destroy();
        this.projectileNodes.delete(id);
    }
}
```

- [ ] **Step 5: Convert hit events to labels and flash timers**

For every unconsumed event, create a label under `worldLayer`, add `UIOpacity`, and push a `DamageFeedback` with duration `0.65`. Use `event.id` parity for a horizontal offset of `-12` or `12`.

```ts
private consumeHitEvents(): void {
    for (const event of this.simulation.hitEvents) {
        if (this.consumedHitEvents.has(event.id)) continue;
        this.consumedHitEvents.add(event.id);
        const color = this.hitColor(event.targetId, event.shieldDamage, event.healthDamage);
        const offset = Number(event.id.split("-").at(-1)) % 2 === 0 ? 12 : -12;
        const label = UIBuilder.label(
            this.worldLayer,
            `Damage:${event.id}`,
            `-${event.amount}`,
            new Size(110, 42),
            new Vec3(event.x + offset, event.y + 36),
            25,
            color,
        );
        const opacity = label.node.addComponent(UIOpacity);
        this.damageFeedbacks.push({
            node: label.node,
            opacity,
            startX: event.x + offset,
            startY: event.y + 36,
            duration: 0.65,
            elapsed: 0,
        });
        this.hitFlashRemaining.set(event.targetId, 0.12);
    }
}
```

`hitColor()` returns orange for enemy targets, cyan for shield-only player hits, danger red for player health hits, and orange-red for structure targets.

```ts
private hitColor(targetId: string, shieldDamage: number, healthDamage: number): Color {
    if (targetId.startsWith("enemy-")) return UI_THEME.colors.orange;
    if (targetId === this.simulation.player.id) {
        return healthDamage > 0 ? UI_THEME.colors.danger : UI_THEME.colors.cyan;
    }
    if (shieldDamage > 0 && healthDamage === 0) return UI_THEME.colors.cyan;
    return new Color(255, 104, 48, 255);
}
```

- [ ] **Step 6: Advance and clean feedback using `deltaTime`**

```ts
private updateCombatFeedback(deltaTime: number): void {
    for (let index = this.damageFeedbacks.length - 1; index >= 0; index--) {
        const feedback = this.damageFeedbacks[index];
        feedback.elapsed += deltaTime;
        const progress = Math.min(1, feedback.elapsed / feedback.duration);
        feedback.node.setPosition(feedback.startX, feedback.startY + progress * 64);
        const fade = progress <= 0.45 ? 1 : 1 - (progress - 0.45) / 0.55;
        feedback.opacity.opacity = Math.round(Math.max(0, fade) * 255);
        if (progress >= 1) {
            feedback.node.destroy();
            this.damageFeedbacks.splice(index, 1);
        }
    }

    for (const [targetId, remaining] of [...this.hitFlashRemaining]) {
        const next = Math.max(0, remaining - deltaTime);
        this.applyHitOpacity(targetId, next > 0);
        if (next === 0) this.hitFlashRemaining.delete(targetId);
        else this.hitFlashRemaining.set(targetId, next);
    }
}
```

`applyHitOpacity()` selects the player node, enemy node by ID, or structure node. Flashing opacity is 145 for active targets. Resting opacity is 255 except a disabled structure, which restores to 110.

```ts
private applyHitOpacity(targetId: string, flashing: boolean): void {
    let node: Node | undefined;
    let restingOpacity = 255;
    if (targetId === this.simulation.player.id) {
        node = this.playerNode;
    } else {
        const enemyIndex = this.simulation.enemies.findIndex((enemy) => enemy.id === targetId);
        if (enemyIndex >= 0) node = this.enemyNodes[enemyIndex];
        const structure = this.simulation.structures.find((candidate) => candidate.id === targetId);
        if (structure) {
            node = this.structureNode;
            restingOpacity = structure.vitality.state === "disabled" ? 110 : 255;
        }
    }
    if (!node) return;
    const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    opacity.opacity = flashing ? Math.min(restingOpacity, 145) : restingOpacity;
}
```

- [ ] **Step 7: Wire update order and pause freezing**

After `simulation.update(deltaTime)`, call in this order:

```ts
this.syncActors();
this.syncVitality();
this.syncProjectiles();
this.consumeHitEvents();
this.updateCombatFeedback(deltaTime);
```

Keep these calls after the existing paused/full-map early return. During initial render, call only `syncActors()`, `syncVitality()`, and `syncProjectiles()`; there are no hit events to consume before the first simulation update.

- [ ] **Step 8: Run UI and battle verification**

Run: `node --test tests/integration/ui/BattleFlowBindings.test.mjs`

Expected: all binding tests PASS.

Run: `npm run test:battle`

Expected: all combat and battle tests PASS.

Run: `npm run test:ui`

Expected: all UI and integration tests PASS.

- [ ] **Step 9: Commit HUD feedback**

```powershell
git add -- assets/script/game/battle/BattleHUDViewComp.ts tests/integration/ui/BattleFlowBindings.test.mjs
git commit -m "feat: render projectile hit feedback"
```

---

### Task 4: Final Regression and Acceptance

**Files:**

- Verify only; fix a failure in the task that owns the affected behavior.

**Interfaces:**

- Consumes: completed projectile simulation, hit events, and HUD feedback.
- Produces: fresh automated evidence and an explicit note for any Creator-only check that cannot run.

- [ ] **Step 1: Run the full automated surface**

Run: `npm run test:battle`

Expected: zero failures.

Run: `npm run test:ui`

Expected: zero failures.

- [ ] **Step 2: Check repository hygiene**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git status --short`

Expected: no uncommitted feature files.

- [ ] **Step 3: Perform Creator preview acceptance when available**

In Cocos Creator 3.8.8, enter the hospital battle page and verify:

1. Every player shot visibly travels from the player to its target.
2. Monster health remains unchanged until the projectile arrives.
3. Projectile impacts display orange damage numbers and a brief monster flash.
4. Monster melee hits show cyan shield damage, then red health damage after shield depletion.
5. Barricade hits show orange-red damage and flash without losing disabled-state opacity.
6. Opening pause or full map freezes bullets, numbers, and flashes.

If the Creator executable is unavailable, report this preview as not run; do not infer it from static tests.

## Plan Completion Gate

The feature is complete only when player damage is impact-timed, every accepted projectile/melee hit creates exactly one accurate event, HUD feedback consumes those events without deciding damage, both automated suites pass, and unrun Creator preview work is explicitly reported.
