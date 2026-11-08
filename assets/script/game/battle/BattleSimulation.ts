import type { BattleMapDefinition, GridPoint, WorldPoint } from "./BattleMapModel.ts";
import { GridPathfinder } from "./GridPathfinder.ts";
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

export interface EnemyAgent extends BattleActor {
    readonly attackDamage: number;
    readonly attackInterval: number;
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

function distance(a: WorldPoint, b: WorldPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalize(x: number, y: number): WorldPoint {
    const length = Math.hypot(x, y);
    return length > 1 ? { x: x / length, y: y / length } : { x, y };
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
    readonly playerAttackDamage = 35;
    readonly player: BattleActor;
    readonly enemies: EnemyAgent[];
    readonly structures: BattleStructure[];
    playerPath: GridPoint[] = [];
    /** Animation-facing battle state, refreshed every update. */
    playerMoving = false;
    playerAutoAttacking = false;
    playerDodgePlayback = 0;
    playerDodgeCount = 0;
    playerTarget: BattleActor | null = null;
    facing: WorldPoint = { x: 1, y: 0 };
    sprinting = false;
    private playerPathIndex = 0;
    private moveInput: WorldPoint = { x: 0, y: 0 };
    private dodgeCooldown = 0;
    private playerAttackCooldown = 0;
    private readonly pathfinder: GridPathfinder;

    constructor(map: BattleMapDefinition) {
        this.map = map;
        this.pathfinder = new GridPathfinder(map);
        this.player = {
            id: "player",
            ...map.cellToWorld(map.start),
            radius: this.playerRadius,
            speed: 270,
            defense: 20,
            vitality: new VitalityRuntime({ maxHealth: 420, maxShield: 180, zeroState: "downed" }),
        };
        this.enemies = map.enemySpawns.map((spawn, index) => ({
            id: `enemy-${index}`,
            ...map.cellToWorld(spawn),
            radius: index === 3 ? 36 : 25,
            speed: 92 + index * 8,
            defense: ENEMY_COMBAT[index].defense,
            vitality: new VitalityRuntime({ maxHealth: ENEMY_COMBAT[index].health, zeroState: "dead" }),
            attackDamage: ENEMY_COMBAT[index].damage,
            attackInterval: ENEMY_COMBAT[index].interval,
            attackCooldown: 0,
            path: [],
            pathIndex: 0,
            repathIn: index * 0.12,
            targetCellKey: "",
            attacking: false,
        }));
        this.structures = [{
            id: "barricade-0",
            kind: "barricade",
            ...map.cellToWorld({ x: 10, y: 4 }),
            radius: 54,
            defense: 30,
            vitality: new VitalityRuntime({ maxHealth: 600, zeroState: "disabled" }),
        }];
    }

    get activeEnemies(): EnemyAgent[] {
        return this.enemies.filter((enemy) => enemy.vitality.active);
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

    repairStructure(id: string, amount: number): VitalityChangeResult | null {
        const structure = this.structures.find((candidate) => candidate.id === id);
        return structure ? structure.vitality.repair(amount) : null;
    }

    update(deltaTime: number): void {
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
        this.updateAutoAttack(dt);
        this.updateEnemies(dt);
        if (!this.player.vitality.active) this.stopPlayerActions();
    }

    /** Locks and damages the nearest active enemy inside weapon range. */
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
            if (enemyDistance > this.autoAttackRange) continue;
            if (enemyDistance < targetDistance) {
                target = enemy;
                targetDistance = enemyDistance;
            }
        }
        this.playerTarget = target;
        this.playerAutoAttacking = target !== null;
        if (!target || this.playerAttackCooldown > 0) return;

        this.applyResolvedDamage(this.player, target, this.playerAttackDamage, ["physical", "ranged"]);
        this.playerAttackCooldown = this.playerAttackInterval;
        if (!target.vitality.active) {
            this.playerTarget = null;
            this.playerAutoAttacking = false;
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
        let structureTarget: BattleStructure | null = null;
        let structureDistance = Number.POSITIVE_INFINITY;
        for (const structure of this.structures) {
            if (!structure.vitality.active) continue;
            const candidateDistance = distance(enemy, structure);
            if (candidateDistance <= this.structureAggroRange && candidateDistance < structureDistance) {
                structureTarget = structure;
                structureDistance = candidateDistance;
            }
        }
        if (structureTarget) return structureTarget;
        return this.player.vitality.active ? this.player : null;
    }

    private updateEnemyAttack(enemy: EnemyAgent, target: CombatTarget): void {
        if (enemy.attackCooldown > 0) return;
        this.applyResolvedDamage(enemy, target, enemy.attackDamage, ["physical", "melee"]);
        enemy.attackCooldown = enemy.attackInterval;
    }

    private applyResolvedDamage(
        source: CombatTarget,
        target: CombatTarget,
        baseDamage: number,
        tags: readonly string[],
    ): VitalityChangeResult {
        const resolution = resolveDamage({
            sourceId: source.id,
            targetId: target.id,
            baseDamage,
            defense: target.defense,
            tags,
        });
        return target.vitality.applyDamage(resolution.accepted ? resolution.amount : Number.NaN);
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
