import type { RandomSource } from "./EquipmentEconomyService.ts";
import type { StatusKind, WeaponCombatSnapshot } from "./EquipmentTypes.ts";

export interface FireContext {
    distance: number;
    moving: boolean;
    weakpoint?: boolean;
    nearArk?: boolean;
    pollution?: number;
}

export interface ShotIntent {
    instanceId: string;
    weaponClass: WeaponCombatSnapshot["weaponClass"];
    damage: number;
    projectileCount: number;
    penetration: number;
    splashRadius: number;
    chainTargets: number;
    status?: StatusKind;
    statusChance: number;
    pollutionCost: number;
    mobileDamageBonus: number;
    suppression: number;
    critical: boolean;
    weakpoint: boolean;
}

export type FireResult = { ok: true; value: ShotIntent } | { ok: false; error: "cooldown" | "reloading" | "overheated" | "minimum-range" };

export interface WeaponRuntimeStatus {
    index: number;
    instanceId: string;
    name: string;
    weaponClass: WeaponCombatSnapshot["weaponClass"];
    damage: number;
    magazine: number;
    magazineSize: number;
    reloadRemaining: number;
    heat: number;
    heatCapacity: number;
    overheated: boolean;
    cooldown: number;
}

interface WeaponState {
    snapshot: WeaponCombatSnapshot;
    magazine: number;
    reloadRemaining: number;
    heat: number;
    overheated: boolean;
    cooldown: number;
    suppression: number;
}

export class DualWeaponRuntime {
    private readonly weapons: [WeaponState, WeaponState];
    private readonly random: RandomSource;
    private activeIndex = 0;

    constructor(snapshots: [WeaponCombatSnapshot, WeaponCombatSnapshot], random: RandomSource = { next: () => Math.random() }) {
        this.weapons = snapshots.map((snapshot) => ({
            snapshot: structuredClone(snapshot),
            magazine: snapshot.magazine,
            reloadRemaining: 0,
            heat: 0,
            overheated: false,
            cooldown: 0,
            suppression: 0,
        })) as [WeaponState, WeaponState];
        this.random = random;
    }

    get status(): WeaponRuntimeStatus {
        const state = this.weapons[this.activeIndex];
        return {
            index: this.activeIndex,
            instanceId: state.snapshot.instanceId,
            name: state.snapshot.name,
            weaponClass: state.snapshot.weaponClass,
            damage: state.snapshot.damage,
            magazine: state.magazine,
            magazineSize: state.snapshot.magazine,
            reloadRemaining: state.reloadRemaining,
            heat: state.heat,
            heatCapacity: state.snapshot.heatCapacity,
            overheated: state.overheated,
            cooldown: state.cooldown,
        };
    }

    get activeSnapshot(): WeaponCombatSnapshot {
        return structuredClone(this.weapons[this.activeIndex].snapshot);
    }

    swap(): WeaponRuntimeStatus {
        this.activeIndex = this.activeIndex === 0 ? 1 : 0;
        return this.status;
    }

    update(deltaTime: number): void {
        const dt = Math.max(0, Math.min(Number.isFinite(deltaTime) ? deltaTime : 0, 1));
        for (const state of this.weapons) {
            state.cooldown = Math.max(0, state.cooldown - dt);
            state.heat = Math.max(0, state.heat - state.snapshot.coolingPerSecond * dt);
            if (state.overheated && state.heat <= state.snapshot.heatCapacity * 0.35) state.overheated = false;
            if (state.reloadRemaining > 0) {
                state.reloadRemaining = Math.max(0, state.reloadRemaining - dt);
                if (state.reloadRemaining === 0) state.magazine = state.snapshot.magazine;
            }
            state.suppression = Math.max(0, state.suppression - dt * 2);
        }
    }

    tryFire(context: FireContext): FireResult {
        const state = this.weapons[this.activeIndex];
        const weapon = state.snapshot;
        if (state.reloadRemaining > 0) return { ok: false, error: "reloading" };
        if (state.magazine <= 0) {
            state.reloadRemaining = weapon.reload;
            return { ok: false, error: "reloading" };
        }
        if (state.overheated) return { ok: false, error: "overheated" };
        if (state.cooldown > 0) return { ok: false, error: "cooldown" };
        if (context.distance < (weapon.minimumRange ?? 0)) return { ok: false, error: "minimum-range" };

        state.magazine -= 1;
        state.cooldown = weapon.interval;
        state.heat = Math.min(weapon.heatCapacity, state.heat + weapon.heatPerShot);
        if (weapon.heatPerShot > 0 && state.heat >= weapon.heatCapacity) state.overheated = true;
        if (weapon.weaponClass === "lmg") state.suppression = Math.min(10, state.suppression + 1);
        const mobileDamageBonus = weapon.weaponClass === "smg" && context.moving ? 0.15 : 0;
        const critical = this.normalizedRandom() < weapon.critChance;
        return {
            ok: true,
            value: {
                instanceId: weapon.instanceId,
                weaponClass: weapon.weaponClass,
                damage: weapon.damage * (1 + mobileDamageBonus) * (critical ? weapon.critMultiplier : 1),
                projectileCount: weapon.pellets ?? 1,
                penetration: weapon.penetration ?? 0,
                splashRadius: weapon.splashRadius ?? 0,
                chainTargets: weapon.chainTargets ?? 0,
                status: weapon.status,
                statusChance: weapon.statusChance ?? 0,
                pollutionCost: weapon.pollutionCost ?? 0,
                mobileDamageBonus,
                suppression: weapon.weaponClass === "lmg" ? Math.ceil(state.suppression) : 0,
                critical,
                weakpoint: context.weakpoint ?? false,
            },
        };
    }

    private normalizedRandom(): number {
        const value = this.random.next();
        return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0;
    }
}
