import { getTemplate } from "../config/EquipmentCatalog.ts";
import type {
    EquipmentCatalog,
    EquipmentCommandResult,
    EquipmentInstance,
    MemoryKind,
} from "./EquipmentTypes.ts";

export interface CombatMemoryEvent {
    kind: MemoryKind;
    amount: number;
}

function canEvolve(instance: EquipmentInstance): boolean {
    return instance.quality === "epic" || instance.quality === "legendary" || instance.quality === "mutated";
}

export function recordMemory(instance: EquipmentInstance, event: CombatMemoryEvent): EquipmentInstance {
    const next = structuredClone(instance);
    if (!canEvolve(next) || !Number.isFinite(event.amount) || event.amount <= 0) return next;
    next.memory[event.kind] = Math.max(0, next.memory[event.kind] + event.amount);
    return next;
}

export function availableEvolutionIds(instance: EquipmentInstance, catalog: EquipmentCatalog): string[] {
    if (!canEvolve(instance)) return [];
    const template = getTemplate(catalog, instance.templateId);
    if (!template) return [];
    return template.evolutionIds.filter((id) => {
        const evolution = catalog.evolutions.find((item) => item.id === id);
        return evolution !== undefined && instance.memory[evolution.memory] >= evolution.threshold;
    });
}

export function chooseEvolution(instance: EquipmentInstance, evolutionId: string, catalog: EquipmentCatalog): EquipmentCommandResult<EquipmentInstance> {
    if (instance.evolutionId !== null || !availableEvolutionIds(instance, catalog).includes(evolutionId)) {
        return { ok: false, error: "unavailable-evolution" };
    }
    const next = structuredClone(instance);
    next.evolutionId = evolutionId;
    return { ok: true, value: next };
}

export function resetEvolution(instance: EquipmentInstance, availableSamples: number): EquipmentCommandResult<{ instance: EquipmentInstance; cost: number }> {
    if (!instance.evolutionId) return { ok: false, error: "unavailable-evolution" };
    const cost = 1 + instance.evolutionResetCount * 2;
    if (availableSamples < cost) return { ok: false, error: "insufficient-materials" };
    const next = structuredClone(instance);
    next.evolutionId = null;
    next.evolutionResetCount += 1;
    return { ok: true, value: { instance: next, cost } };
}
