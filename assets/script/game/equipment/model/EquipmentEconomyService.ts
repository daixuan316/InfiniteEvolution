import { getTemplate } from "../config/EquipmentCatalog.ts";
import { createEmptyMemory } from "./EquipmentTypes.ts";
import type {
    AffixCategory,
    EquipmentCatalog,
    EquipmentCommandResult,
    EquipmentInstance,
    EquipmentQuality,
    EquipmentState,
    MaterialId,
} from "./EquipmentTypes.ts";

export interface RandomSource {
    next(): number;
}

type EconomySuccess<T> = EquipmentCommandResult<{ state: EquipmentState; instance: EquipmentInstance } & T>;

const QUALITY_AFFIXES: Record<EquipmentQuality, number> = { common: 0, fine: 1, rare: 2, epic: 3, legendary: 4, mutated: 4 };

function spend(state: EquipmentState, costs: Partial<Record<MaterialId, number>>): boolean {
    if (Object.values(costs).some((value) => !Number.isFinite(value) || value! < 0)) return false;
    for (const [id, amount] of Object.entries(costs) as Array<[MaterialId, number]>) if ((state.materials[id] ?? 0) < amount) return false;
    for (const [id, amount] of Object.entries(costs) as Array<[MaterialId, number]>) state.materials[id] -= amount;
    return true;
}

function isHighQuality(instance: EquipmentInstance): boolean {
    return instance.quality === "legendary" || instance.quality === "mutated";
}

export class EquipmentEconomyService {
    private readonly catalog: EquipmentCatalog;
    private readonly random: RandomSource;

    constructor(catalog: EquipmentCatalog, random: RandomSource = { next: () => Math.random() }) {
        this.catalog = catalog;
        this.random = random;
    }

    craft(state: EquipmentState, recipeId: string): EconomySuccess<{}> {
        const recipe = this.catalog.recipes.find((item) => item.id === recipeId);
        if (!recipe || recipe.minimumWorkshopLevel > state.workshopLevel) return { ok: false, error: "invalid-command" };
        if (state.instances.length >= state.capacity) return { ok: false, error: "inventory-full" };
        const next = structuredClone(state);
        if (!spend(next, recipe.costs)) return { ok: false, error: "insufficient-materials" };
        const template = getTemplate(this.catalog, recipe.templateId);
        if (!template) return { ok: false, error: "invalid-command" };
        const affixes = this.allowedAffixes(template.id, undefined);
        const instance: EquipmentInstance = {
            instanceId: `equipment-${next.nextInstanceId++}`,
            templateId: template.id,
            level: Math.max(1, Math.min(next.roleLevel, next.chapterLevelCap)),
            strengthen: 0,
            quality: "fine",
            affixIds: affixes.length ? [affixes[Math.floor(this.normalizedRandom() * affixes.length)].id] : [],
            tags: [...template.tags],
            favorite: false,
            locked: false,
            rerollCount: 0,
            rerollSlot: null,
            evolutionId: null,
            evolutionResetCount: 0,
            memory: createEmptyMemory(),
        };
        next.instances.push(instance);
        return { ok: true, value: { state: next, instance: structuredClone(instance) } };
    }

    strengthen(state: EquipmentState, instanceId: string): EconomySuccess<{}> {
        const next = structuredClone(state);
        const instance = next.instances.find((item) => item.instanceId === instanceId);
        if (!instance) return { ok: false, error: "missing-instance" };
        if (instance.strengthen >= 10 || instance.level > Math.min(next.roleLevel, next.chapterLevelCap)) return { ok: false, error: "level-cap" };
        const level = instance.strengthen + 1;
        if (!spend(next, { scrap: 20 * level, parts: 5 * level })) return { ok: false, error: "insufficient-materials" };
        instance.strengthen = level;
        return { ok: true, value: { state: next, instance: structuredClone(instance) } };
    }

    synchronize(state: EquipmentState, instanceId: string): EconomySuccess<{}> {
        const next = structuredClone(state);
        const instance = next.instances.find((item) => item.instanceId === instanceId);
        if (!instance) return { ok: false, error: "missing-instance" };
        const targetLevel = Math.min(next.roleLevel, next.chapterLevelCap);
        if (instance.level >= targetLevel) return { ok: false, error: "level-cap" };
        const difference = targetLevel - instance.level;
        if (!spend(next, { scrap: difference * 15, parts: difference * 4 })) return { ok: false, error: "insufficient-materials" };
        instance.level = targetLevel;
        return { ok: true, value: { state: next, instance: structuredClone(instance) } };
    }

    rerollAffix(state: EquipmentState, instanceId: string, slot: number, category: AffixCategory): EconomySuccess<{}> {
        const next = structuredClone(state);
        const instance = next.instances.find((item) => item.instanceId === instanceId);
        if (!instance) return { ok: false, error: "missing-instance" };
        if (!Number.isInteger(slot) || slot < 0 || slot >= instance.affixIds.length || slot >= QUALITY_AFFIXES[instance.quality]) return { ok: false, error: "invalid-command" };
        const candidates = this.allowedAffixes(instance.templateId, category).filter((item) => item.id !== instance.affixIds[slot]);
        if (candidates.length === 0) return { ok: false, error: "invalid-command" };
        if (!spend(next, { gold: 100 * (instance.rerollCount + 1), electronics: 5 + instance.rerollCount * 2 })) return { ok: false, error: "insufficient-materials" };
        instance.affixIds[slot] = candidates[Math.floor(this.normalizedRandom() * candidates.length)].id;
        instance.rerollSlot = slot;
        instance.rerollCount += 1;
        return { ok: true, value: { state: next, instance: structuredClone(instance) } };
    }

    salvageOne(state: EquipmentState, instanceId: string, confirmHighQuality = false): EconomySuccess<{ rewards: Partial<Record<MaterialId, number>> }> {
        const next = structuredClone(state);
        const instance = next.instances.find((item) => item.instanceId === instanceId);
        if (!instance) return { ok: false, error: "missing-instance" };
        if (this.isReferenced(next, instanceId) || instance.favorite || instance.locked || instance.evolutionId || (isHighQuality(instance) && !confirmHighQuality)) {
            return { ok: false, error: "protected-instance" };
        }
        const rewards = this.salvageRewards(instance);
        next.instances = next.instances.filter((item) => item.instanceId !== instanceId);
        for (const [id, amount] of Object.entries(rewards) as Array<[MaterialId, number]>) next.materials[id] += amount;
        return { ok: true, value: { state: next, instance: structuredClone(instance), rewards } };
    }

    salvageMany(state: EquipmentState, instanceIds: readonly string[]): EquipmentCommandResult<{ state: EquipmentState; salvagedIds: string[]; rewards: Partial<Record<MaterialId, number>> }> {
        let next = structuredClone(state);
        const salvagedIds: string[] = [];
        const rewards: Partial<Record<MaterialId, number>> = {};
        for (const instanceId of [...new Set(instanceIds)]) {
            const result = this.salvageOne(next, instanceId, false);
            if (!result.ok) continue;
            next = result.value.state;
            salvagedIds.push(instanceId);
            for (const [id, amount] of Object.entries(result.value.rewards) as Array<[MaterialId, number]>) rewards[id] = (rewards[id] ?? 0) + amount;
        }
        return { ok: true, value: { state: next, salvagedIds, rewards } };
    }

    private isReferenced(state: EquipmentState, instanceId: string): boolean {
        return state.loadouts.some((loadout) => Object.values(loadout.slots).includes(instanceId));
    }

    private salvageRewards(instance: EquipmentInstance): Partial<Record<MaterialId, number>> {
        const quality = ["common", "fine", "rare", "epic", "legendary", "mutated"].indexOf(instance.quality);
        return {
            scrap: 15 + instance.level * 5 + instance.strengthen * 8,
            parts: 3 + quality * 3 + instance.strengthen * 2,
            tagSample: quality >= 2 ? 1 : 0,
            evolutionSample: quality >= 3 ? 1 : 0,
        };
    }

    private allowedAffixes(templateId: string, category: AffixCategory | undefined) {
        const template = getTemplate(this.catalog, templateId);
        if (!template) return [];
        return this.catalog.affixes.filter((affix) => (!category || affix.category === category)
            && template.allowedAffixCategories.includes(affix.category)
            && affix.allowedSlots.includes(template.slot)
            && (!affix.allowedWeaponClasses || (template.weaponClass !== undefined && affix.allowedWeaponClasses.includes(template.weaponClass))));
    }

    private normalizedRandom(): number {
        const value = this.random.next();
        return Number.isFinite(value) ? Math.max(0, Math.min(0.999999, value)) : 0;
    }
}
