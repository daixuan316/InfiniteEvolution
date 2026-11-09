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
import { DualWeaponRuntime, type ShotIntent, type WeaponRuntimeStatus } from "../equipment/model/WeaponRuntime.ts";
import type { RandomSource } from "../equipment/model/EquipmentEconomyService.ts";
import type { MemoryKind, RoleCombatSnapshot, StatusKind, WeaponCombatSnapshot } from "../equipment/model/EquipmentTypes.ts";
import { createFirstNightHorde, type HordeDirector, type HordePhase } from "../monster/model/HordeDirector.ts";
import type { ArkBattleSettlement, ArkBattleSnapshot } from "../shelter/model/ArkTypes.ts";
import {
    DEFAULT_BATTLE_PLAYER_MODIFIERS,
    type BattlePlayerModifiers,
} from "../research/model/ResearchTypes.ts";
import { PLAYER_COLLISION_RADIUS, enemyActorPresentation } from "./BattleActorPresentation.ts";

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
    readonly playerPosition?: WorldPoint;
    readonly playerModifiers?: BattlePlayerModifiers;
    readonly arkCore?: {
        readonly position: WorldPoint;
        readonly maxHealth: number;
        readonly initialHealth?: number;
        readonly defense: number;
        readonly radius: number;
    };
    readonly arkSnapshot?: ArkBattleSnapshot;
    readonly equipmentSnapshot?: RoleCombatSnapshot;
    readonly random?: RandomSource;
}

export interface ArkBattleModule extends CombatTarget {
    readonly instanceId: string;
    readonly definitionId: string;
    readonly name: string;
    readonly poweredAtStart: boolean;
    powered: boolean;
    readonly attackDamage: number;
    readonly attackInterval: number;
    readonly attackRange: number;
    readonly repairRate: number;
    readonly abilityId: string | null;
    attackCooldown: number;
    overloadRemaining: number;
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
    stunnedFor: number;
}

export interface BattleProjectile extends WorldPoint {
    readonly id: string;
    readonly sourceId: string;
    readonly targetId: string;
    readonly speed: number;
    readonly baseDamage: number;
    readonly tags: readonly string[];
    readonly shot?: ShotIntent;
    remainingLifetime: number;
}

export interface EquipmentMemoryDelta {
    readonly instanceId: string;
    readonly kind: MemoryKind;
    readonly amount: number;
}

interface ActiveCombatStatus {
    readonly targetId: string;
    readonly sourceInstanceId: string;
    readonly kind: StatusKind;
    damage: number;
    remaining: number;
    tickIn: number;
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
    readonly speed: number;
}>> = {
    walker: { health: 90, defense: 5, damage: 18, interval: 1, speed: 92 },
    runner: { health: 70, defense: 0, damage: 12, interval: 0.55, speed: 100 },
    mutant: { health: 130, defense: 12, damage: 24, interval: 1.1, speed: 108 },
    brute: { health: 360, defense: 25, damage: 42, interval: 1.4, speed: 116 },
};

function distance(a: WorldPoint, b: WorldPoint): number {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function enemyKindForSpawn(spawn: GridPoint): EnemyKind {
    const kindIndex = Math.abs(Math.imul(spawn.x, 31) + Math.imul(spawn.y, 17)) % INITIAL_ENEMY_KINDS.length;
    return INITIAL_ENEMY_KINDS[kindIndex];
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

function defaultWeapon(instanceId: string): WeaponCombatSnapshot {
    return {
        instanceId,
        templateId: "weapon_assault",
        name: "制式步枪",
        weaponClass: "assault",
        damage: 35,
        interval: 0.35,
        range: 320,
        magazine: 24,
        reload: 1.7,
        heatPerShot: 0,
        heatCapacity: 100,
        coolingPerSecond: 25,
        projectileSpeed: 1400,
        critChance: 0,
        critMultiplier: 1.75,
        weakpointMultiplier: 1.5,
        additiveDamageBonus: 0,
        mechanics: ["稳定连射"],
    };
}

function defaultEquipmentSnapshot(): RoleCombatSnapshot {
    return {
        maxHealth: 420,
        maxShield: 180,
        defense: 20,
        moveSpeed: 270,
        dodgeCooldown: 0.85,
        weapons: [defaultWeapon("default-primary"), defaultWeapon("default-backup")],
        resonances: [],
    };
}

export class BattleSimulation {
    readonly map: BattleMapDefinition;
    readonly playerRadius = PLAYER_COLLISION_RADIUS;
    /** Movement speed multiplier while sprinting; also drives walk animation speed. */
    readonly sprintMultiplier = 1.55;
    /** Weapon reach for the player's auto-fire state, in world units. */
    autoAttackRange = 320;
    /** Extra clearance beyond body radii before a melee enemy starts attacking. */
    readonly meleeAttackMargin = 55;
    /** Nearby fortifications intercept monsters before they continue toward the player. */
    readonly structureAggroRange = 300;
    playerAttackInterval = 0.35;
    playerAttackDamage: number;
    projectileSpeed = 1400;
    readonly projectileLifetime = 1.2;
    readonly interactionRange = 145;
    readonly player: BattleActor;
    readonly enemies: EnemyAgent[];
    readonly structures: BattleStructure[];
    readonly arkModules: ArkBattleModule[];
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
    readonly weaponRuntime: DualWeaponRuntime;
    playerPath: GridPoint[] = [];
    /** Animation-facing battle state, refreshed every update. */
    playerMoving = false;
    playerAutoAttacking = false;
    playerDodgePlayback = 0;
    playerDodgeCount = 0;
    playerPollution = 32;
    playerTarget: CombatTarget | null = null;
    facing: WorldPoint = { x: 1, y: 0 };
    sprinting = false;
    private playerPathIndex = 0;
    private playerDestination: WorldPoint | null = null;
    private moveInput: WorldPoint = { x: 0, y: 0 };
    private dodgeCooldown = 0;
    private playerAttackCooldown = 0;
    private dodgeCooldownDuration = 0.85;
    private nextProjectileId = 1;
    private nextHitEventId = 1;
    private nextNoticeEventId = 1;
    private nextEnemyId = 0;
    private nextHordeSpawnIndex = 0;
    private horde: HordeDirector | null = null;
    private readonly pathfinder: GridPathfinder;
    private readonly spawnInitialEnemies: boolean;
    private lastMapRevision: number;
    private readonly battleRandom: RandomSource;
    private readonly equipmentMemory = new Map<string, Map<MemoryKind, number>>();
    private readonly combatStatuses: ActiveCombatStatus[] = [];
    private emergencyEnergy = 0;
    private emergencyEnergySpent = 0;
    private readonly arkRewardMultiplier: number;
    private readonly arkHordeMultiplier: number;

    constructor(map: BattleMapDefinition, options: BattleSimulationOptions = {}) {
        this.map = map;
        this.pathfinder = new GridPathfinder(map);
        this.spawnInitialEnemies = options.spawnInitialEnemies !== false;
        const playerModifiers = normalizePlayerModifiers(options.playerModifiers);
        const equipment = structuredClone(options.equipmentSnapshot ?? defaultEquipmentSnapshot());
        equipment.weapons = equipment.weapons.map((weapon) => ({
            ...weapon,
            damage: weapon.damage * playerModifiers.attackDamageMultiplier,
        })) as [WeaponCombatSnapshot, WeaponCombatSnapshot];
        this.battleRandom = options.random ?? { next: () => Math.random() };
        this.weaponRuntime = new DualWeaponRuntime(equipment.weapons, this.battleRandom);
        this.playerAttackDamage = this.weaponRuntime.activeSnapshot.damage;
        this.playerAttackInterval = this.weaponRuntime.activeSnapshot.interval;
        this.autoAttackRange = this.weaponRuntime.activeSnapshot.range;
        this.projectileSpeed = this.weaponRuntime.activeSnapshot.projectileSpeed;
        this.dodgeCooldownDuration = equipment.dodgeCooldown;
        const initialPlayerPosition = options.playerPosition ?? map.cellToWorld(map.start);
        this.player = {
            id: "player",
            ...initialPlayerPosition,
            radius: this.playerRadius,
            speed: equipment.moveSpeed * playerModifiers.moveSpeedMultiplier,
            defense: equipment.defense,
            vitality: new VitalityRuntime({
                maxHealth: equipment.maxHealth + playerModifiers.maxHealthAdd,
                maxShield: equipment.maxShield + playerModifiers.maxShieldAdd,
                zeroState: "downed",
            }),
        };
        map.refreshAround?.(initialPlayerPosition);
        this.enemies = !this.spawnInitialEnemies ? [] : map.enemySpawns.flatMap((spawn, index) => {
            const stableId = map.infinite ? `chunk-enemy:${spawn.x}:${spawn.y}` : undefined;
            if (stableId && map.readObjectDelta?.(spawn, stableId)?.destroyed) return [];
            return [this.createEnemy(
                enemyKindForSpawn(spawn),
                map.cellToWorld(spawn),
                index * 0.12,
                stableId,
                map.enemyHealthMultiplier?.(spawn) ?? 1,
            )];
        });
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
                vitality: new VitalityRuntime({ maxHealth: options.arkCore.maxHealth, initialHealth: options.arkCore.initialHealth, zeroState: "destroyed" }),
            });
        }
        const arkOrigin = options.arkCore?.position ?? map.cellToWorld(map.extraction);
        const offsets: Readonly<Record<string, WorldPoint>> = {
            "front-left": { x: -150, y: -80 }, "front-right": { x: 150, y: -80 },
            "top-left": { x: -130, y: 95 }, "top-right": { x: 130, y: 95 },
            side: { x: 220, y: 0 }, internal: { x: 0, y: 30 }, bio: { x: -220, y: 0 },
        };
        this.arkModules = (options.arkSnapshot?.modules ?? []).map((entry) => {
            const offset = offsets[entry.slotId] ?? { x: 0, y: 0 };
            return {
                id: entry.instanceId,
                instanceId: entry.instanceId,
                definitionId: entry.definitionId,
                name: entry.name,
                x: arkOrigin.x + offset.x,
                y: arkOrigin.y + offset.y,
                radius: entry.battle.radius ?? 38,
                defense: entry.battle.defense ?? 0,
                vitality: new VitalityRuntime({ maxHealth: entry.maxDurability, initialHealth: entry.durability, zeroState: "disabled" }),
                poweredAtStart: entry.powered,
                powered: entry.powered,
                attackDamage: entry.battle.attackDamage ?? 0,
                attackInterval: entry.battle.attackInterval ?? 1,
                attackRange: entry.battle.attackRange ?? 0,
                repairRate: entry.battle.repairRate ?? 0,
                abilityId: entry.abilityId,
                attackCooldown: 0,
                overloadRemaining: 0,
            };
        });
        this.emergencyEnergy = options.arkSnapshot?.emergencyEnergy ?? 0;
        this.arkRewardMultiplier = options.arkSnapshot?.rewardMultiplier ?? 1;
        this.arkHordeMultiplier = options.arkSnapshot?.hordeMultiplier ?? 1;
        this.loot = map.loot.map((item) => this.createLoot(item));
        this.explorationPoints = map.explorationPoints.map((point) => this.createExplorationPoint(point));
        this.lastMapRevision = map.revision ?? 0;
    }

    get activeEnemies(): EnemyAgent[] {
        return this.enemies.filter((enemy) => enemy.vitality.active);
    }

    get worldRevision(): number {
        return this.lastMapRevision;
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

    get weaponStatus(): WeaponRuntimeStatus {
        return this.weaponRuntime.status;
    }

    switchWeapon(): WeaponRuntimeStatus {
        const previous = this.weaponRuntime.status.instanceId;
        const status = this.weaponRuntime.swap();
        this.syncActiveWeaponFields();
        this.addEquipmentMemory(previous, "swapChain", 1);
        this.addEquipmentMemory(status.instanceId, "swapChain", 1);
        return status;
    }

    drainEquipmentMemoryDeltas(): EquipmentMemoryDelta[] {
        const result: EquipmentMemoryDelta[] = [];
        for (const [instanceId, counters] of this.equipmentMemory) {
            for (const [kind, amount] of counters) if (amount > 0) result.push({ instanceId, kind, amount });
        }
        this.equipmentMemory.clear();
        return result;
    }

    startHorde(seed = 1): boolean {
        if (this.horde) return false;
        this.horde = createFirstNightHorde(seed, this.arkHordeMultiplier);
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
            this.map.writeObjectDelta?.(loot.cell, loot.id, { opened: true, discovered: loot.discovered });
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
        this.map.writeObjectDelta?.(point.cell, point.id, { eventStage: "complete" });
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
            ?? this.arkModules.find((module) => module.id === id)
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
            this.playerDestination = null;
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
        this.playerDestination = null;
        this.dodgeCooldown = this.dodgeCooldownDuration;
        this.playerDodgePlayback = 0.5;
        this.playerDodgeCount += 1;
        return true;
    }

    setPlayerDestination(destination: WorldPoint): boolean {
        if (!this.player.vitality.active) return false;
        const path = this.planPlayerPath(destination);
        if (path.length === 0) return false;
        this.playerDestination = { ...destination };
        this.moveInput = { x: 0, y: 0 };
        this.playerPath = path;
        this.playerPathIndex = Math.min(1, path.length);
        return true;
    }

    private planPlayerPath(destination: WorldPoint): GridPoint[] {
        const start = this.map.worldToCell(this.player);
        const requestedGoal = this.map.worldToCell(destination);
        return this.pathfinder.findPathToNearest(start, requestedGoal);
    }

    update(deltaTime: number): void {
        this.hitEvents.length = 0;
        this.refreshWorldContent();
        this.map.advancePreload?.(6);
        const dt = Math.max(0, Math.min(deltaTime, 0.1));
        this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);
        this.playerDodgePlayback = Math.max(0, this.playerDodgePlayback - dt);
        this.weaponRuntime.update(dt);
        this.updateCombatStatuses(dt);
        if (this.player.vitality.active) {
            const speedMultiplier = this.sprinting ? this.sprintMultiplier : 1;
            const directInput = Math.hypot(this.moveInput.x, this.moveInput.y) > 0.05;
            if (directInput) {
                this.moveWithCollision(this.player, this.moveInput.x * this.player.speed * speedMultiplier * dt, this.moveInput.y * this.player.speed * speedMultiplier * dt);
            } else {
                this.playerPathIndex = this.followPath(this.player, this.playerPath, this.playerPathIndex, dt, speedMultiplier);
                if (this.playerPathIndex >= this.playerPath.length) {
                    this.playerPath = [];
                    if (this.playerDestination && distance(this.player, this.playerDestination) <= this.map.tileSize) {
                        this.playerDestination = null;
                    } else if (this.playerDestination) {
                        const continuation = this.planPlayerPath(this.playerDestination);
                        if (continuation.length > 1) {
                            this.playerPath = continuation;
                            this.playerPathIndex = 1;
                        }
                    }
                }
            }
            this.playerMoving = directInput || this.playerPathIndex < this.playerPath.length;
        } else {
            this.stopPlayerActions();
        }
        this.updateHorde(dt);
        this.updateAutoAttack(dt);
        this.updateArkModules(dt);
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

    refreshWorldContent(): boolean {
        if (this.map.infinite) {
            for (const enemy of this.enemies) {
                if (!enemy.id.startsWith("chunk-enemy:") || enemy.vitality.active) continue;
                this.map.writeObjectDelta?.(this.map.worldToCell(enemy), enemy.id, { destroyed: true });
            }
        }
        const changed = this.map.refreshAround?.(this.player) ?? false;
        const revision = this.map.revision ?? this.lastMapRevision;
        if (!changed && revision === this.lastMapRevision) return false;

        const existingLoot = new Map(this.loot.map((item) => [item.id, item]));
        const nextLoot = this.map.loot.map((definition) => existingLoot.get(definition.id) ?? this.createLoot(definition));
        this.loot.splice(0, this.loot.length, ...nextLoot);

        const existingExploration = new Map(this.explorationPoints.map((point) => [point.id, point]));
        const nextExploration = this.map.explorationPoints.map((definition) => existingExploration.get(definition.id) ?? this.createExplorationPoint(definition));
        this.explorationPoints.splice(0, this.explorationPoints.length, ...nextExploration);

        if (this.spawnInitialEnemies && this.map.infinite) {
            const existingEnemies = new Map(this.enemies.map((enemy) => [enemy.id, enemy]));
            const nextEnemies: EnemyAgent[] = [];
            this.map.enemySpawns.forEach((spawn, index) => {
                const id = `chunk-enemy:${spawn.x}:${spawn.y}`;
                if (this.map.readObjectDelta?.(spawn, id)?.destroyed) return;
                const existing = existingEnemies.get(id);
                if (existing) {
                    nextEnemies.push(existing);
                    return;
                }
                nextEnemies.push(this.createEnemy(
                    enemyKindForSpawn(spawn),
                    this.map.cellToWorld(spawn),
                    index * 0.04,
                    id,
                    this.map.enemyHealthMultiplier?.(spawn) ?? 1,
                ));
            });
            this.enemies.splice(0, this.enemies.length, ...nextEnemies);
        }

        if (this.playerDestination) {
            this.playerPath = this.planPlayerPath(this.playerDestination);
            this.playerPathIndex = Math.min(1, this.playerPath.length);
        } else {
            this.playerPath = [];
            this.playerPathIndex = 0;
        }
        this.lastMapRevision = revision;
        return true;
    }

    private createLoot(item: MapLootDefinition): BattleLoot {
        const delta = this.map.readObjectDelta?.(item.cell, item.id);
        return {
            ...item,
            ...this.map.cellToWorld(item.cell),
            discovered: delta?.discovered ?? item.initiallyDiscovered,
            opened: delta?.opened ?? false,
        };
    }

    private createExplorationPoint(point: MapExplorationDefinition): BattleExplorationPoint {
        const delta = this.map.readObjectDelta?.(point.cell, point.id);
        return {
            ...point,
            ...this.map.cellToWorld(point.cell),
            completed: delta?.eventStage === "complete",
        };
    }

    private createEnemy(kind: EnemyKind, position: WorldPoint, repathIn: number, stableId?: string, healthMultiplier = 1): EnemyAgent {
        const combat = ENEMY_COMBAT[kind];
        const presentation = enemyActorPresentation(kind);
        const normalizedHealthMultiplier = Number.isFinite(healthMultiplier)
            ? Math.max(1, Math.min(3, healthMultiplier))
            : 1;
        return {
            id: stableId ?? `enemy-${this.nextEnemyId++}`,
            kind,
            ...position,
            radius: presentation.collisionRadius,
            speed: combat.speed,
            defense: combat.defense,
            vitality: new VitalityRuntime({ maxHealth: combat.health * normalizedHealthMultiplier, zeroState: "dead" }),
            attackDamage: combat.damage,
            attackInterval: combat.interval,
            attackCooldown: 0,
            path: [],
            pathIndex: 0,
            repathIn,
            targetCellKey: "",
            attacking: false,
            stunnedFor: 0,
        };
    }

    /** Locks and damages the nearest active enemy inside weapon range. */
    private updateAutoAttack(dt: number): void {
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
        if (!target) return;
        const shot = this.weaponRuntime.tryFire({
            distance: targetDistance,
            moving: this.playerMoving,
            nearArk: this.hordeStarted,
        });
        if (!shot.ok) return;
        if (shot.value.pollutionCost > 0) {
            this.playerPollution = Math.min(100, this.playerPollution + shot.value.pollutionCost);
            if (this.playerPollution >= 60) this.addEquipmentMemory(shot.value.instanceId, "highPollutionUse", 1);
        }
        this.spawnPlayerProjectile(target, shot.value);
        if (targetDistance <= 160) this.addEquipmentMemory(shot.value.instanceId, "closeHit", shot.value.projectileCount);
    }

    private spawnPlayerProjectile(target: CombatTarget, shot: ShotIntent): void {
        const dx = target.x - this.player.x;
        const dy = target.y - this.player.y;
        const length = Math.hypot(dx, dy);
        const direction = length > 0
            ? { x: dx / length, y: dy / length }
            : this.facing;
        for (let index = 0; index < shot.projectileCount; index++) {
            this.projectiles.push({
                id: `projectile-${this.nextProjectileId++}`,
                sourceId: this.player.id,
                targetId: target.id,
                x: this.player.x + direction.x * this.player.radius,
                y: this.player.y + direction.y * this.player.radius,
                speed: this.projectileSpeed,
                baseDamage: shot.damage * (1 + shot.suppression * 0.02),
                tags: Object.freeze(["ranged", shot.weaponClass, ...(shot.status ? [shot.status] : [])]),
                shot,
                remainingLifetime: this.projectileLifetime,
            });
        }
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
                this.resolvePlayerProjectile(projectile, target);
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

    private resolvePlayerProjectile(projectile: BattleProjectile, target: CombatTarget): void {
        const result = this.applyResolvedDamage(this.player, target, projectile.baseDamage, projectile.tags, "projectile");
        const shot = projectile.shot;
        if (!shot) return;
        if (shot.weakpoint) this.addEquipmentMemory(shot.instanceId, "weakpointHit", 1);
        this.applyShotStatus(shot, target);
        const secondary = this.activeEnemies
            .filter((enemy) => enemy.id !== target.id && enemy.vitality.active)
            .sort((left, right) => distance(left, target) - distance(right, target));
        if (shot.splashRadius > 0) {
            for (const enemy of secondary.filter((candidate) => distance(candidate, target) <= shot.splashRadius)) {
                this.applyResolvedDamage(this.player, enemy, projectile.baseDamage * 0.72, [...projectile.tags, "splash"], "projectile");
                this.applyShotStatus(shot, enemy);
            }
        }
        if (shot.chainTargets > 0) {
            secondary.slice(0, shot.chainTargets).forEach((enemy, index) => {
                this.applyResolvedDamage(this.player, enemy, projectile.baseDamage * Math.pow(0.78, index + 1), [...projectile.tags, "chain"], "projectile");
                this.applyShotStatus(shot, enemy);
            });
        }
        if (shot.penetration > 0) {
            secondary.filter((enemy) => distance(enemy, target) <= 110).slice(0, shot.penetration).forEach((enemy, index) => {
                this.applyResolvedDamage(this.player, enemy, projectile.baseDamage * Math.pow(0.85, index + 1), [...projectile.tags, "penetration"], "projectile");
            });
        }
        if (result.becameZero && this.hordeStarted) this.addEquipmentMemory(shot.instanceId, "arkDefenseKill", 1);
    }

    private applyShotStatus(shot: ShotIntent, target: CombatTarget): void {
        if (!shot.status || this.normalizedBattleRandom() >= shot.statusChance) return;
        this.addEquipmentMemory(shot.instanceId, "statusProc", 1);
        const enemy = this.enemies.find((candidate) => candidate.id === target.id);
        if (shot.status === "shock" && enemy) enemy.stunnedFor = Math.max(enemy.stunnedFor, 0.35);
        const duration = shot.status === "burn" ? 3 : shot.status === "infection" ? 4 : shot.status === "corrode" ? 4 : 1;
        const damage = shot.status === "burn" ? shot.damage * 0.2 : shot.status === "infection" ? shot.damage * 0.15 : 0;
        const existing = this.combatStatuses.find((status) => status.targetId === target.id && status.kind === shot.status);
        if (existing) {
            existing.remaining = Math.max(existing.remaining, duration);
            existing.damage = Math.max(existing.damage, damage);
            return;
        }
        this.combatStatuses.push({ targetId: target.id, sourceInstanceId: shot.instanceId, kind: shot.status, damage, remaining: duration, tickIn: 1 });
    }

    private updateCombatStatuses(dt: number): void {
        for (let index = this.combatStatuses.length - 1; index >= 0; index--) {
            const status = this.combatStatuses[index];
            status.remaining -= dt;
            status.tickIn -= dt;
            const target = this.findCombatTarget(status.targetId);
            if (!target?.vitality.active || status.remaining <= 0) {
                this.combatStatuses.splice(index, 1);
                continue;
            }
            if (status.damage > 0 && status.tickIn <= 0) {
                this.applyResolvedDamage(this.player, target, status.damage, [status.kind, "damage-over-time"], "projectile");
                status.tickIn += 1;
            }
        }
    }

    private syncActiveWeaponFields(): void {
        const weapon = this.weaponRuntime.activeSnapshot;
        this.playerAttackDamage = weapon.damage;
        this.playerAttackInterval = weapon.interval;
        this.autoAttackRange = weapon.range;
        this.projectileSpeed = weapon.projectileSpeed;
    }

    private addEquipmentMemory(instanceId: string, kind: MemoryKind, amount: number): void {
        if (!Number.isFinite(amount) || amount <= 0) return;
        let counters = this.equipmentMemory.get(instanceId);
        if (!counters) {
            counters = new Map<MemoryKind, number>();
            this.equipmentMemory.set(instanceId, counters);
        }
        counters.set(kind, (counters.get(kind) ?? 0) + amount);
    }

    private normalizedBattleRandom(): number {
        const value = this.battleRandom.next();
        return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0;
    }

    private updateArkModules(dt: number): void {
        for (const module of this.arkModules) {
            module.attackCooldown = Math.max(0, module.attackCooldown - dt);
            module.overloadRemaining = Math.max(0, module.overloadRemaining - dt);
            if (!module.powered || !module.vitality.active || module.attackDamage <= 0 || module.attackRange <= 0 || module.attackCooldown > 0) continue;
            let target: EnemyAgent | null = null;
            let targetDistance = Number.POSITIVE_INFINITY;
            for (const enemy of this.activeEnemies) {
                const candidate = distance(module, enemy);
                const preferred = module.abilityId === "target_low_health"
                    ? !target || enemy.vitality.healthRatio < target.vitality.healthRatio || (enemy.vitality.healthRatio === target.vitality.healthRatio && candidate < targetDistance)
                    : candidate < targetDistance;
                if (candidate <= module.attackRange && preferred) {
                    target = enemy;
                    targetDistance = candidate;
                }
            }
            if (!target) continue;
            const overloaded = module.overloadRemaining > 0;
            this.applyResolvedDamage(module, target, module.attackDamage * (overloaded ? 1.5 : 1), ["physical", "ark-module"], "projectile");
            module.attackCooldown = module.attackInterval * (overloaded ? 0.7 : 1);
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
            enemy.stunnedFor = Math.max(0, enemy.stunnedFor - dt);
            if (enemy.stunnedFor > 0) {
                enemy.attacking = false;
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
        for (const module of this.arkModules) {
            if (!module.vitality.active) continue;
            const candidateDistance = distance(enemy, module);
            if (candidateDistance <= this.structureAggroRange && candidateDistance < targetDistance) {
                target = module;
                targetDistance = candidateDistance;
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

    tryEmergencyPower(instanceId: string): boolean {
        const module = this.arkModules.find((item) => item.instanceId === instanceId);
        if (!module || module.powered || !module.vitality.active || this.emergencyEnergy < 1) return false;
        module.powered = true;
        this.emergencyEnergy -= 1;
        this.emergencyEnergySpent += 1;
        return true;
    }

    tryRemoteRepair(instanceId: string): boolean {
        const module = this.arkModules.find((item) => item.instanceId === instanceId);
        if (!module || module.vitality.currentHealth >= module.vitality.maxHealth || this.emergencyEnergy < 1) return false;
        const amount = Math.max(20, this.arkModules.reduce((sum, item) => sum + item.repairRate, 0));
        const result = module.vitality.repair(amount);
        if (!result.accepted) return false;
        this.emergencyEnergy -= 1;
        this.emergencyEnergySpent += 1;
        return true;
    }

    tryOverload(instanceId: string): boolean {
        const module = this.arkModules.find((item) => item.instanceId === instanceId);
        if (!module || !module.powered || !module.vitality.active || module.attackDamage <= 0 || module.overloadRemaining > 0 || this.emergencyEnergy < 1) return false;
        module.overloadRemaining = 10;
        this.emergencyEnergy -= 1;
        this.emergencyEnergySpent += 1;
        return true;
    }

    createArkSettlement(battleId: string): ArkBattleSettlement {
        const core = this.structures.find((item) => item.kind === "ark-core");
        return {
            battleId,
            moduleDurability: this.arkModules.map((module) => ({ instanceId: module.instanceId, durability: module.vitality.currentHealth })),
            resourceDeltas: {
                scrap: Math.floor(this.resources.scrap * this.arkRewardMultiplier),
                parts: Math.floor(this.resources.parts * this.arkRewardMultiplier),
                energyCell: this.emergencyEnergySpent === 0 ? 0 : -this.emergencyEnergySpent,
            },
            coreDurability: core?.vitality.currentHealth ?? 0,
        };
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
            defense: this.combatStatuses.some((status) => status.targetId === target.id && status.kind === "corrode")
                ? target.defense * 0.7
                : target.defense,
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
            this.map.writeObjectDelta?.(item.cell, item.id, { discovered: true });
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
        this.map.writeObjectDelta?.(this.map.worldToCell(structure), structure.id, { destroyed: true });
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
