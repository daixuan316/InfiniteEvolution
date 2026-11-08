import type { BattleMapDefinition, GridPoint, WorldPoint } from "./BattleMapModel.ts";
import { GridPathfinder } from "./GridPathfinder.ts";

export interface BattleActor extends WorldPoint {
    readonly id: string;
    readonly radius: number;
    readonly speed: number;
}

interface EnemyAgent extends BattleActor {
    path: GridPoint[];
    pathIndex: number;
    repathIn: number;
    targetCellKey: string;
    attacking: boolean;
}

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
    readonly player: BattleActor;
    readonly enemies: EnemyAgent[];
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
    private readonly pathfinder: GridPathfinder;

    constructor(map: BattleMapDefinition) {
        this.map = map;
        this.pathfinder = new GridPathfinder(map);
        this.player = { id: "player", ...map.cellToWorld(map.start), radius: this.playerRadius, speed: 270 };
        this.enemies = map.enemySpawns.map((spawn, index) => ({
            id: `enemy-${index}`,
            ...map.cellToWorld(spawn),
            radius: index === 3 ? 36 : 25,
            speed: 92 + index * 8,
            path: [],
            pathIndex: 0,
            repathIn: index * 0.12,
            targetCellKey: "",
            attacking: false,
        }));
    }

    setMoveInput(x: number, y: number): void {
        this.moveInput = normalize(x, y);
        if (Math.hypot(this.moveInput.x, this.moveInput.y) > 0.05) {
            this.facing = { ...this.moveInput };
            this.playerPath = [];
            this.playerPathIndex = 0;
        }
    }

    setSprinting(active: boolean): void {
        this.sprinting = active;
    }

    tryDodge(): boolean {
        if (this.dodgeCooldown > 0) return false;
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
        const dt = Math.max(0, Math.min(deltaTime, 0.1));
        this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
        this.playerDodgePlayback = Math.max(0, this.playerDodgePlayback - dt);
        const speedMultiplier = this.sprinting ? this.sprintMultiplier : 1;
        const directInput = Math.hypot(this.moveInput.x, this.moveInput.y) > 0.05;
        if (directInput) {
            this.moveWithCollision(this.player, this.moveInput.x * this.player.speed * speedMultiplier * dt, this.moveInput.y * this.player.speed * speedMultiplier * dt);
        } else {
            this.playerPathIndex = this.followPath(this.player, this.playerPath, this.playerPathIndex, dt, speedMultiplier);
            if (this.playerPathIndex >= this.playerPath.length) this.playerPath = [];
        }
        this.playerMoving = directInput || this.playerPathIndex < this.playerPath.length;
        this.updateAutoAttack();
        this.updateEnemies(dt);
    }

    /** Locks the nearest enemy inside weapon range, per the auto-fire targeting rule. */
    private updateAutoAttack(): void {
        let target: EnemyAgent | null = null;
        let targetDistance = Number.POSITIVE_INFINITY;
        for (const enemy of this.enemies) {
            const enemyDistance = distance(enemy, this.player);
            if (enemyDistance > this.autoAttackRange) continue;
            if (enemyDistance < targetDistance) {
                target = enemy;
                targetDistance = enemyDistance;
            }
        }
        this.playerTarget = target;
        this.playerAutoAttacking = target !== null;
    }

    private updateEnemies(dt: number): void {
        const playerCell = this.map.worldToCell(this.player);
        const targetKey = `${playerCell.x},${playerCell.y}`;
        for (const enemy of this.enemies) {
            const attackRange = enemy.radius + this.playerRadius + this.meleeAttackMargin;
            enemy.attacking = distance(enemy, this.player) <= attackRange;
            if (enemy.attacking) {
                enemy.path = [];
                enemy.pathIndex = 0;
                continue;
            }
            enemy.repathIn -= dt;
            if (enemy.repathIn <= 0 || enemy.targetCellKey !== targetKey || enemy.pathIndex >= enemy.path.length) {
                enemy.path = this.pathfinder.findPathToNearest(this.map.worldToCell(enemy), playerCell);
                enemy.pathIndex = Math.min(1, enemy.path.length);
                enemy.repathIn = 0.65;
                enemy.targetCellKey = targetKey;
            }
            enemy.pathIndex = this.followPath(enemy, enemy.path, enemy.pathIndex, dt);
        }
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
