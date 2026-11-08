import type {
    BattleMapDefinition,
    GridPoint,
    MapExplorationDefinition,
    MapLootDefinition,
    MapReward,
    ResourceKind,
    WorldPoint,
} from "./BattleMapModel.ts";
import { GridPathfinder } from "./GridPathfinder.ts";
import { resolveDamage } from "../combat/DamageResolver.ts";
import { VitalityRuntime, type VitalityChangeResult } from "../combat/Vitality.ts";
import { createFirstNightHorde, type HordeDirector, type HordePhase } from "../monster/model/HordeDirector.ts";
import {
    DEFAULT_BATTLE_PLAYER_MODIFIERS,
    type BattlePlayerModifiers,
} from "../research/model/ResearchTypes.ts";

export interface CombatTarget extends WorldPoint {
    readonly id: string;
    readonly radius: number;
    readonly defense: number;
    readonly vitality: VitalityRuntime;
}

export interface BattleActor extends CombatTarget {
    readonly speed: number;
}

export interface BattleStructure extends CombatTarget {
    readonly kind: "breakable-barrier" | "ark-core";
    readonly name: string;
}

export interface BattleSimulationOptions {
    readonly spawnInitialEnemies?: boolean;
    readonly playerModifiers?: BattlePlayerModifiers;
    readonly arkCore?: {
        readonly position: WorldPoint;
        readonly maxHealth: number;
        readonly defense: number;
        readonly radius: number;
    };
}

export interface BattleLoot extends WorldPoint, MapLootDefinition {
    discovered: boolean;
    opened: boolean;
}

export interface BattleExplorationPoint extends WorldPoint, MapExplorationDefinition {
    completed: boolean;
}

export interface BattleInteractionTarget {
    readonly id: string;
    readonly category: "loot" | "exploration";
    readonly name: string;
    readonly action: "open" | "investigate";
    readonly distance: number;
}

export interface BattleInteractionResult {
    readonly accepted: boolean;
    readonly targetId: string;
    readonly message: string;
    readonly rewards: readonly MapReward[];
    readonly revealedIds: readonly string[];
}

export interface BattleNoticeEvent {
    readonly id: string;
    readonly kind: "loot" | "exploration" | "reveal" | "barrier";
    readonly message: string;
}

export type EnemyKind = "walker" | "runner" | "mutant" | "brute";

export interface EnemyAgent extends BattleActor {
    readonly kind: EnemyKind;
    readonly attackDamage: number;
    readonly attackInterval: number;
    attackCooldown: number;
    path: GridPoint[];
    pathIndex: number;
    repathIn: number;
    targetCellKey: string;
    attacking: boolean;
}

export interface BattleProjectile extends WorldPoint {
    readonly id: string;
    readonly sourceId: string;
    readonly targetId: string;
    readonly speed: number;
    readonly baseDamage: number;
    readonly tags: readonly string[];
    remainingLifetime: number;
}

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

const INITIAL_ENEMY_KINDS: readonly EnemyKind[] = ["walker", "runner", "mutant", "brute"];
const ENEMY_COMBAT: Readonly<Record<EnemyKind, {
    readonly health: number;
    readonly defense: number;
    readonly damage: number;
    readonly interval: number;
    readonly radius: number;
    readonly speed: number;
}>> = {
    walker: { health: 90, defense: 5, damage: 18, interval: 1, radius: 25, speed: 92 },
    runner: { health: 70, defense: 0, damage: 12, interval: 0.55, radius: 25, speed: 100 },
    mutant: { health: 130, defense: 12, damage: 24, interval: 1.1, radius: 25, speed: 108 },
    brute: { health: 360, defense: 25, damage: 42, interval: 1.4, radius: 36, speed: 116 },
};

function distance(a: WorldPoint, b: WorldPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(x: number, y: number): WorldPoint {
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
}

function normalizePlayerModifiers(modifiers: BattlePlayerModifiers | undefined): BattlePlayerModifiers {
    if (!modifiers) return DEFAULT_BATTLE_PLAYER_MODIFIERS;
    return {
        maxHealthAdd: Number.isFinite(modifiers.maxHealthAdd) && modifiers.maxHealthAdd >= 0 ? modifiers.maxHealthAdd : 0,
        maxShieldAdd: Number.isFinite(modifiers.maxShieldAdd) && modifiers.maxShieldAdd >= 0 ? modifiers.maxShieldAdd : 0,
        attackDamageMultiplier: Number.isFinite(modifiers.attackDamageMultiplier) && modifiers.attackDamageMultiplier > 0
            ? modifiers.attackDamageMultiplier
            : 1,
        moveSpeedMultiplier: Number.isFinite(modifiers.moveSpeedMultiplier) && modifiers.moveSpeedMultiplier > 0
            ? modifiers.moveSpeedMultiplier
            : 1,
    };
}

export class BattleSimulation {
    readonly map: BattleMapDefinition;
    readonly playerRadius = 28;
    /** Movement speed multiplier while sprinting; also drives walk animation speed. */
    readonly sprintMultiplier = 1.55;
    /** Weapon reach for the player's auto-fire state, in world units. */
    readonly autoAttackRange = 320;
    /** Extra clearance beyond body radii before a melee enemy starts attacking. */
    readonly meleeAttackMargin = 55;
    /** Nearby fortifications intercept monsters before they continue toward the player. */
    readonly structureAggroRange = 300;
    readonly playerAttackInterval = 0.35;
    readonly playerAttackDamage: number;
    readonly projectileSpeed = 1400;
    readonly projectileLifetime = 1.2;
    readonly interactionRange = 145;
    readonly player: BattleActor;
    readonly enemies: EnemyAgent[];
    readonly structures: BattleStructure[];
    readonly loot: BattleLoot[];
    readonly explorationPoints: BattleExplorationPoint[];
    readonly resources: Record<ResourceKind, number> = {
        scrap: 0,
        medical: 0,
        ammo: 0,
        parts: 0,
        intel: 0,
    };
    readonly projectiles: BattleProjectile[] = [];
    readonly hitEvents: CombatHitEvent[] = [];
    readonly noticeEvents: BattleNoticeEvent[] = [];
    playerPath: GridPoint[] = [];
    /** Animation-facing battle state, refreshed every update. */
    playerMoving = false;
    playerAutoAttacking = false;
    playerDodgePlayback = 0;
    playerDodgeCount = 0;
    playerTarget: CombatTarget | null = null;
    facing: WorldPoint = { x: 1, y: 0 };
    sprinting = false;
    private playerPathIndex = 0;
    private moveInput: WorldPoint = { x: 0, y: 0 };
    private dodgeCooldown = 0;
    private playerAttackCooldown = 0;
    private nextProjectileId = 1;
    private nextHitEventId = 1;
    private nextNoticeEventId = 1;
    private nextEnemyId = 0;
    private nextHordeSpawnIndex = 0;
    private horde: HordeDirector | null = null;
    private readonly pathfinder: GridPathfinder;

    constructor(map: BattleMapDefinition, options: BattleSimulationOptions = {}) {
        this.map = map;
        this.pathfinder = new GridPathfinder(map);
        const playerModifiers = normalizePlayerModifiers(options.playerModifiers);
        this.playerAttackDamage = 35 * playerModifiers.attackDamageMultiplier;
        this.player = {
            id: "player",
            ...map.cellToWorld(map.start),
            radius: this.playerRadius,
            speed: 270 * playerModifiers.moveSpeedMultiplier,
            defense: 20,
            vitality: new VitalityRuntime({
                maxHealth: 420 + playerModifiers.maxHealthAdd,
                maxShield: 180 + playerModifiers.maxShieldAdd,
                zeroState: "downed",
            }),
        };
        this.enemies = options.spawnInitialEnemies === false ? [] : map.enemySpawns.map((spawn, index) => this.createEnemy(
            INITIAL_ENEMY_KINDS[index] ?? "walker",
            map.cellToWorld(spawn),
            index * 0.12,
        ));
        this.structures = map.barriers.map((barrier) => ({
            id: barrier.id,
            kind: "breakable-barrier" as const,
            name: barrier.name,
            ...map.cellToWorld(barrier.cell),
            radius: barrier.radius,
            defense: barrier.defense,
            vitality: new VitalityRuntime({ maxHealth: barrier.maxHealth, zeroState: "destroyed" }),
        }));
        if (options.arkCore) {
            this.structures.push({
                id: "ark-core",
                kind: "ark-core",
                name: "方舟核心",
                ...options.arkCore.position,
                radius: options.arkCore.radius,
                defense: options.arkCore.defense,
                vitality: new VitalityRuntime({ maxHealth: options.arkCore.maxHealth, zeroState: "destroyed" }),
            });
        }
        this.loot = map.loot.map((item) => ({
            ...item,
            ...map.cellToWorld(item.cell),
            discovered: item.initiallyDiscovered,
            opened: false,
        }));
        this.explorationPoints = map.explorationPoints.map((point) => ({
            ...point,
            ...map.cellToWorld(point.cell),
            completed: false,
        }));
    }

    get activeEnemies(): EnemyAgent[] {
        return this.enemies.filter((enemy) => enemy.vitality.active);
    }

    get hordeStarted(): boolean {
        return this.horde !== null;
    }

    get hordePhase(): HordePhase | null {
        return this.horde?.phase ?? null;
    }

    get hordeCompleted(): boolean {
        return this.horde?.completed ?? false;
    }

    get hordeProgressRatio(): number {
        return this.horde?.progressRatio ?? 0;
    }

    get remainingHordeThreats(): number {
        return this.horde?.remainingThreats(this.activeEnemies.length) ?? 0;
    }

    startHorde(seed = 1): boolean {
        if (this.horde) return false;
        this.horde = createFirstNightHorde(seed);
        return true;
    }

    get nearestInteraction(): BattleInteractionTarget | null {
        if (!this.player.vitality.active) return null;
        const candidates: BattleInteractionTarget[] = [];
        for (const item of this.loot) {
            if (!item.discovered || item.opened) continue;
            const itemDistance = distance(this.player, item);
            if (itemDistance <= this.interactionRange) {
                candidates.push({ id: item.id, category: "loot", name: item.name, action: "open", distance: itemDistance });
            }
        }
        for (const point of this.explorationPoints) {
            if (point.completed) continue;
            const pointDistance = distance(this.player, point);
            if (pointDistance <= this.interactionRange) {
                candidates.push({ id: point.id, category: "exploration", name: point.name, action: "investigate", distance: pointDistance });
            }
        }
        candidates.sort((left, right) => left.distance - right.distance || left.id.localeCompare(right.id));
        return candidates[0] ?? null;
    }

    interact(id: string): BattleInteractionResult {
        if (!this.player.vitality.active) return this.rejectedInteraction(id, "当前无法交互");
        const loot = this.loot.find((item) => item.id === id);
        if (loot) {
            if (!loot.discovered || loot.opened || distance(this.player, loot) > this.interactionRange) {
                return this.rejectedInteraction(id, "目标不在交互范围内");
            }
            loot.opened = true;
            this.grantRewards(loot.rewards);
            const message = `已开启 ${loot.name} · ${this.rewardSummary(loot.rewards)}`;
            this.pushNotice("loot", message);
            return { accepted: true, targetId: id, message, rewards: loot.rewards, revealedIds: [] };
        }

        const point = this.explorationPoints.find((candidate) => candidate.id === id);
        if (!point || point.completed || distance(this.player, point) > this.interactionRange) {
            return this.rejectedInteraction(id, "目标不在交互范围内");
        }
        point.completed = true;
        this.grantRewards(point.rewards);
        const revealedIds = point.typeId === "radar-terminal" ? this.revealHiddenLoot() : [];
        const effect = revealedIds.length > 0 ? `，已标记 ${revealedIds.length} 个隐藏补给` : "";
        const message = `调查完成：${point.name}${effect}`;
        this.pushNotice(revealedIds.length > 0 ? "reveal" : "exploration", message);
        return { accepted: true, targetId: id, message, rewards: point.rewards, revealedIds };
    }

    findCombatTarget(id: string): CombatTarget | null {
        if (this.player.id === id) return this.player;
        return this.enemies.find((enemy) => enemy.id === id)
            ?? this.structures.find((structure) => structure.id === id)
            ?? null;
    }

    setMoveInput(x: number, y: number): void {
        if (!this.player.vitality.active) {
            this.moveInput = { x: 0, y: 0 };
            return;
        }
        this.moveInput = normalize(x, y);
        if (Math.hypot(this.moveInput.x, this.moveInput.y) > 0.05) {
            this.facing = { ...this.moveInput };
            this.playerPath = [];
            this.playerPathIndex = 0;
        }
    }

    setSprinting(active: boolean): void {
        this.sprinting = this.player.vitality.active && active;
    }

    tryDodge(): boolean {
        if (!this.player.vitality.active || this.dodgeCooldown > 0) return false;
        const before = { x: this.player.x, y: this.player.y };
        const distance = 190;
        const increments = 12;
        for (let index = 0; index < increments; index++) {
            this.moveWithCollision(this.player, this.facing.x * distance / increments, this.facing.y * distance / increments);
        }
        if (Math.hypot(this.player.x - before.x, this.player.y - before.y) < 1) return false;
        this.playerPath = [];
        this.playerPathIndex = 0;
        this.dodgeCooldown = 0.85;
        this.playerDodgePlayback = 0.5;
        this.playerDodgeCount += 1;
        return true;
    }

    setPlayerDestination(destination: WorldPoint): boolean {
        if (!this.player.vitality.active) return false;
        const start = this.map.worldToCell(this.player);
        const requestedGoal = this.map.worldToCell(destination);
        const path = this.pathfinder.findPathToNearest(start, requestedGoal);
        if (path.length === 0) return false;
        this.moveInput = { x: 0, y: 0 };
        this.playerPath = path;
        this.playerPathIndex = Math.min(1, path.length);
        return true;
    }

    update(deltaTime: number): void {
        this.hitEvents.length = 0;
        const dt = Math.max(0, Math.min(deltaTime, 0.1));
        this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
        this.playerDodgePlayback = Math.max(0, this.playerDodgePlayback - dt);
        if (this.player.vitality.active) {
            const speedMultiplier = this.sprinting ? this.sprintMultiplier : 1;
            const directInput = Math.hypot(this.moveInput.x, this.moveInput.y) > 0.05;
            if (directInput) {
                this.moveWithCollision(this.player, this.moveInput.x * this.player.speed * speedMultiplier * dt, this.moveInput.y * this.player.speed * speedMultiplier * dt);
            } else {
                this.playerPathIndex = this.followPath(this.player, this.playerPath, this.playerPathIndex, dt, speedMultiplier);
                if (this.playerPathIndex >= this.playerPath.length) this.playerPath = [];
            }
            this.playerMoving = directInput || this.playerPathIndex < this.playerPath.length;
        } else {
            this.stopPlayerActions();
        }
        this.updateHorde(dt);
        this.updateAutoAttack(dt);
        this.updateProjectiles(dt);
        this.updateEnemies(dt);
        if (!this.player.vitality.active) this.stopPlayerActions();
    }

    private updateHorde(dt: number): void {
        if (!this.horde || this.horde.completed) return;
        const result = this.horde.tick(dt, this.activeEnemies.length);
        for (const spawn of result.spawns) {
            const kind: EnemyKind = spawn.id === "brute" ? "brute" : spawn.id === "runner" ? "runner" : "walker";
            const spawnCell = this.map.enemySpawns[this.nextHordeSpawnIndex % this.map.enemySpawns.length] ?? this.map.start;
            this.nextHordeSpawnIndex += 1;
            this.enemies.push(this.createEnemy(kind, this.map.cellToWorld(spawnCell), this.nextEnemyId * 0.04));
        }
    }

    private createEnemy(kind: EnemyKind, position: WorldPoint, repathIn: number): EnemyAgent {
        const combat = ENEMY_COMBAT[kind];
        return {
            id: `enemy-${this.nextEnemyId++}`,
            kind,
            ...position,
            radius: combat.radius,
            speed: combat.speed,
            defense: combat.defense,
            vitality: new VitalityRuntime({ maxHealth: combat.health, zeroState: "dead" }),
            attackDamage: combat.damage,
            attackInterval: combat.interval,
            attackCooldown: 0,
            path: [],
            pathIndex: 0,
            repathIn,
            targetCellKey: "",
            attacking: false,
        };
    }

    /** Locks and damages the nearest active enemy inside weapon range. */
    private updateAutoAttack(dt: number): void {
        this.playerAttackCooldown = Math.max(0, this.playerAttackCooldown - dt);
        if (!this.player.vitality.active) {
            this.playerTarget = null;
            this.playerAutoAttacking = false;
            return;
        }
        let target: CombatTarget | null = null;
        let targetDistance = Number.POSITIVE_INFINITY;
        for (const enemy of this.activeEnemies) {
            const enemyDistance = distance(enemy, this.player);
            if (enemyDistance > this.autoAttackRange) continue;
            if (enemyDistance < targetDistance) {
                target = enemy;
                targetDistance = enemyDistance;
            }
        }
        if (!target) {
            for (const structure of this.structures) {
                if (structure.kind !== "breakable-barrier") continue;
                if (!structure.vitality.active) continue;
                const structureDistance = distance(structure, this.player);
                if (structureDistance > this.autoAttackRange || structureDistance >= targetDistance) continue;
                target = structure;
                targetDistance = structureDistance;
            }
        }
        this.playerTarget = target;
        this.playerAutoAttacking = target !== null;
        if (!target || this.playerAttackCooldown > 0) return;

        this.spawnPlayerProjectile(target);
        this.playerAttackCooldown = this.playerAttackInterval;
    }

    private spawnPlayerProjectile(target: CombatTarget): void {
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

    private updateProjectiles(dt: number): void {
        for (let index = this.projectiles.length - 1; index >= 0; index--) {
            const projectile = this.projectiles[index];
            projectile.remainingLifetime -= dt;
            const target = this.findCombatTarget(projectile.targetId);
            if (!target?.vitality.active || projectile.remainingLifetime <= 0) {
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

    private updateEnemies(dt: number): void {
        for (const enemy of this.enemies) {
            if (!enemy.vitality.active) {
                enemy.attacking = false;
                enemy.path = [];
                enemy.pathIndex = 0;
                continue;
            }
            enemy.attackCooldown = Math.max(0, enemy.attackCooldown - dt);
            const target = this.selectEnemyTarget(enemy);
            if (!target) {
                enemy.attacking = false;
                enemy.path = [];
                enemy.pathIndex = 0;
                continue;
            }
            const attackRange = enemy.radius + target.radius + this.meleeAttackMargin;
            enemy.attacking = distance(enemy, target) <= attackRange;
            if (enemy.attacking) {
                enemy.path = [];
                enemy.pathIndex = 0;
                this.updateEnemyAttack(enemy, target);
                continue;
            }
            const targetCell = this.map.worldToCell(target);
            const targetKey = `${target.id}:${targetCell.x},${targetCell.y}`;
            enemy.repathIn -= dt;
            if (enemy.repathIn <= 0 || enemy.targetCellKey !== targetKey || enemy.pathIndex >= enemy.path.length) {
                enemy.path = this.pathfinder.findPathToNearest(this.map.worldToCell(enemy), targetCell);
                enemy.pathIndex = Math.min(1, enemy.path.length);
                enemy.repathIn = 0.65;
                enemy.targetCellKey = targetKey;
            }
            enemy.pathIndex = this.followPath(enemy, enemy.path, enemy.pathIndex, dt);
        }
    }

    private selectEnemyTarget(enemy: EnemyAgent): CombatTarget | null {
        const arkCore = this.structures.find((structure) => structure.kind === "ark-core" && structure.vitality.active) ?? null;
        let target: CombatTarget | null = arkCore ?? (this.player.vitality.active ? this.player : null);
        let targetDistance = target ? distance(enemy, target) : Number.POSITIVE_INFINITY;
        if (arkCore && this.player.vitality.active) {
            const playerDistance = distance(enemy, this.player);
            if (playerDistance + 100 < targetDistance) {
                target = this.player;
                targetDistance = playerDistance;
            }
        }
        for (const structure of this.structures) {
            if (structure.kind === "ark-core") continue;
            if (!structure.vitality.active) continue;
            const candidateDistance = distance(enemy, structure);
            if (candidateDistance <= this.structureAggroRange && candidateDistance < targetDistance) {
                target = structure;
                targetDistance = candidateDistance;
            }
        }
        return target;
    }

    private updateEnemyAttack(enemy: EnemyAgent, target: CombatTarget): void {
        if (enemy.attackCooldown > 0) return;
        this.applyResolvedDamage(enemy, target, enemy.attackDamage, ["physical", "melee"], "melee");
        enemy.attackCooldown = enemy.attackInterval;
    }

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
            if (result.becameZero) {
                const structure = this.structures.find((candidate) => candidate.id === target.id);
                if (structure?.kind === "breakable-barrier") this.openBarrierRoute(structure);
            }
        }
        return result;
    }

    private rejectedInteraction(id: string, message: string): BattleInteractionResult {
        return { accepted: false, targetId: id, message, rewards: [], revealedIds: [] };
    }

    private grantRewards(rewards: readonly MapReward[]): void {
        for (const reward of rewards) this.resources[reward.kind] += reward.amount;
    }

    private revealHiddenLoot(): string[] {
        const revealedIds: string[] = [];
        for (const item of this.loot) {
            if (item.discovered || item.opened) continue;
            item.discovered = true;
            revealedIds.push(item.id);
        }
        return revealedIds;
    }

    private rewardSummary(rewards: readonly MapReward[]): string {
        const labels: Record<ResourceKind, string> = {
            scrap: "废料",
            medical: "医疗物资",
            ammo: "弹药",
            parts: "零件",
            intel: "情报",
        };
        return rewards.map((reward) => `${labels[reward.kind]} +${reward.amount}`).join("、");
    }

    private pushNotice(kind: BattleNoticeEvent["kind"], message: string): void {
        this.noticeEvents.push({ id: `notice-${this.nextNoticeEventId++}`, kind, message });
    }

    private openBarrierRoute(structure: BattleStructure): void {
        if (!this.map.setBarrierBlocking(structure.id, false)) return;
        this.playerPath = [];
        this.playerPathIndex = 0;
        for (const enemy of this.enemies) {
            enemy.path = [];
            enemy.pathIndex = 0;
            enemy.targetCellKey = "";
            enemy.repathIn = 0;
        }
        this.pushNotice("barrier", `${structure.name}已摧毁 · 捷径已开放`);
    }

    private stopPlayerActions(): void {
        this.moveInput = { x: 0, y: 0 };
        this.playerPath = [];
        this.playerPathIndex = 0;
        this.playerMoving = false;
        this.playerAutoAttacking = false;
        this.playerTarget = null;
        this.sprinting = false;
    }

    private followPath(actor: BattleActor, path: readonly GridPoint[], startIndex: number, dt: number, speedMultiplier = 1): number {
        let index = startIndex;
        let movementBudget = actor.speed * speedMultiplier * dt;
        while (index < path.length && movementBudget > 0) {
            const target = this.map.cellToWorld(path[index]);
            const remaining = distance(actor, target);
            if (remaining <= 1) {
                index++;
                continue;
            }
            const step = Math.min(remaining, movementBudget);
            const dx = (target.x - actor.x) / remaining * step;
            const dy = (target.y - actor.y) / remaining * step;
            this.moveWithCollision(actor, dx, dy);
            movementBudget -= step;
            if (step >= remaining - 0.001) index++;
            else break;
        }
        return index;
    }

    private moveWithCollision(actor: BattleActor, dx: number, dy: number): void {
        const horizontal = { x: actor.x + dx, y: actor.y };
        if (this.map.isWorldWalkable(horizontal, actor.radius)) actor.x = horizontal.x;
        const vertical = { x: actor.x, y: actor.y + dy };
        if (this.map.isWorldWalkable(vertical, actor.radius)) actor.y = vertical.y;
    }
}
