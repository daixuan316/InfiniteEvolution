import { getTemplate } from "../config/EquipmentCatalog.ts";
import type {
    ActiveResonance,
    EquipmentCatalog,
    EquipmentInstance,
    EquipmentState,
    ResonanceTag,
    RoleCombatSnapshot,
    StatKey,
    WeaponCombatSnapshot,
} from "./EquipmentTypes.ts";

type Modifiers = Partial<Record<StatKey, number>>;

const BASE_ROLE = Object.freeze({ maxHealth: 420, maxShield: 180, defense: 20, moveSpeed: 270, dodgeCooldown: 0.85 });
const TAGS: ResonanceTag[] = ["thunder", "sentinel", "machine", "mutation", "wasteland", "heavy"];

function addModifier(target: Modifiers, stat: StatKey, value: number): void {
    target[stat] = (target[stat] ?? 0) + value;
}

function addModifiers(target: Modifiers, source: Modifiers): void {
    for (const [stat, value] of Object.entries(source) as Array<[StatKey, number]>) addModifier(target, stat, value);
}

function round(value: number): number {
    return Number(value.toFixed(4));
}

export function resolveResonances(instances: readonly EquipmentInstance[], catalog: EquipmentCatalog): ActiveResonance[] {
    const counts = new Map<ResonanceTag, number>();
    for (const instance of instances) {
        for (const tag of new Set(instance.tags)) counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
    return TAGS.map((tag) => {
        const count = counts.get(tag) ?? 0;
        const definition = catalog.resonances.find((item) => item.tag === tag);
        const tiers = definition?.tiers.filter((tier) => count >= tier.count) ?? [];
        const tier = count >= 3 ? 3 : count >= 2 ? 2 : 0;
        return {
            tag,
            count,
            tier,
            nextTier: tier === 0 ? 2 : tier === 2 ? 3 : null,
            mechanics: tiers.map((item) => item.mechanic),
            drawbacks: tiers.flatMap((item) => item.drawback ? [item.drawback] : []),
        };
    });
}

function itemModifiers(instance: EquipmentInstance, catalog: EquipmentCatalog): Modifiers {
    const template = getTemplate(catalog, instance.templateId);
    if (!template) return {};
    const result: Modifiers = { ...template.baseStats };
    for (const id of instance.affixIds) {
        const affix = catalog.affixes.find((item) => item.id === id);
        if (affix) addModifier(result, affix.stat, affix.value);
    }
    if (instance.evolutionId) {
        const evolution = catalog.evolutions.find((item) => item.id === instance.evolutionId && item.templateId === instance.templateId);
        if (evolution) addModifiers(result, evolution.modifiers);
    }
    return result;
}

function resonanceModifiers(resonances: readonly ActiveResonance[], catalog: EquipmentCatalog): Modifiers {
    const result: Modifiers = {};
    for (const active of resonances) {
        const definition = catalog.resonances.find((item) => item.tag === active.tag);
        for (const tier of definition?.tiers ?? []) if (active.count >= tier.count) addModifiers(result, tier.modifiers);
    }
    return result;
}

function resolveWeapon(instance: EquipmentInstance, catalog: EquipmentCatalog, global: Modifiers, mechanics: string[]): WeaponCombatSnapshot {
    const template = getTemplate(catalog, instance.templateId)!;
    const base = template.weapon!;
    const local = itemModifiers(instance, catalog);
    const combined: Modifiers = { ...global };
    addModifiers(combined, local);
    const levelScale = 1 + Math.max(0, instance.level - 1) * 0.02 + Math.max(0, instance.strengthen) * 0.05;
    const damageBonus = combined.damage ?? 0;
    return {
        ...base,
        instanceId: instance.instanceId,
        templateId: template.id,
        name: template.name,
        weaponClass: template.weaponClass!,
        damage: round(base.damage * levelScale * (1 + damageBonus)),
        interval: round(Math.max(0.05, base.interval * (1 + (combined.interval ?? 0)))),
        range: round(Math.max(1, base.range * (1 + (combined.range ?? 0)))),
        magazine: Math.max(1, Math.round(base.magazine + (combined.magazine ?? 0))),
        reload: round(Math.max(0.1, base.reload * (1 + (combined.reload ?? 0)))),
        heatCapacity: round(Math.max(1, base.heatCapacity * (1 + (combined.heatCapacity ?? 0)))),
        coolingPerSecond: round(Math.max(0.1, base.coolingPerSecond * (1 + (combined.coolingPerSecond ?? 0)))),
        chainTargets: Math.max(0, Math.round((base.chainTargets ?? 0) + (combined.chainTargets ?? 0))),
        critChance: Math.max(0, Math.min(1, 0.05 + (combined.critChance ?? 0))),
        critMultiplier: 1.75,
        weakpointMultiplier: round(1.5 + (combined.weakpointMultiplier ?? 0)),
        additiveDamageBonus: round(damageBonus),
        mechanics: [template.fixedTrait, ...mechanics, ...(instance.evolutionId ? [catalog.evolutions.find((item) => item.id === instance.evolutionId)?.mechanic ?? ""] : [])].filter(Boolean),
    };
}

export function resolveRoleCombatSnapshot(state: EquipmentState, catalog: EquipmentCatalog): RoleCombatSnapshot {
    const loadout = state.loadouts.find((item) => item.id === state.activeLoadoutId) ?? state.loadouts[0];
    if (!loadout) throw new Error("equipment state has no loadout");
    const byId = new Map(state.instances.map((item) => [item.instanceId, item]));
    const equipped = [...new Set(Object.values(loadout.slots).filter((id): id is string => id !== null))]
        .map((id) => byId.get(id))
        .filter((item): item is EquipmentInstance => item !== undefined);
    const resonances = resolveResonances(equipped, catalog);
    const global: Modifiers = resonanceModifiers(resonances, catalog);
    for (const instance of equipped) {
        const template = getTemplate(catalog, instance.templateId);
        if (template?.slot !== "weapon") addModifiers(global, itemModifiers(instance, catalog));
    }
    const weaponInstances = [loadout.slots.primary1, loadout.slots.primary2]
        .map((id) => id ? byId.get(id) : undefined)
        .filter((item): item is EquipmentInstance => item !== undefined && getTemplate(catalog, item.templateId)?.slot === "weapon");
    const fallback = state.instances.find((item) => getTemplate(catalog, item.templateId)?.slot === "weapon");
    if (!fallback) throw new Error("equipment state has no weapon");
    while (weaponInstances.length < 2) weaponInstances.push(fallback);
    const activeMechanics = resonances.flatMap((item) => item.mechanics);
    const weapons = weaponInstances.slice(0, 2).map((item) => resolveWeapon(item, catalog, global, activeMechanics)) as [WeaponCombatSnapshot, WeaponCombatSnapshot];
    return {
        maxHealth: Math.max(1, Math.round(BASE_ROLE.maxHealth + (global.maxHealth ?? 0))),
        maxShield: Math.max(0, Math.round(BASE_ROLE.maxShield + (global.maxShield ?? 0))),
        defense: Math.max(0, Math.round(BASE_ROLE.defense + (global.defense ?? 0))),
        moveSpeed: Math.max(1, Math.round(BASE_ROLE.moveSpeed + (global.moveSpeed ?? 0))),
        dodgeCooldown: round(Math.max(0.1, BASE_ROLE.dodgeCooldown * (1 + (global.dodgeCooldown ?? 0)))),
        weapons,
        resonances,
    };
}
