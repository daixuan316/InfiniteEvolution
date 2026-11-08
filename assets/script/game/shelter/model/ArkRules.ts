import {
    ARK_SLOTS,
    arkEvolutionById,
    arkModuleById,
    arkSlotById,
} from "./ArkCatalog.ts";
import type {
    ArkAdjacencyBonus,
    ArkBattleModuleSnapshot,
    ArkBattleSnapshot,
    ArkDerivedState,
    ArkLayoutId,
    ArkResult,
    ArkState,
    NoiseTier,
} from "./ArkTypes.ts";

const PRIORITY_RANK = { core: 0, important: 1, normal: 2 } as const;
const HORDE_MULTIPLIER: Readonly<Record<NoiseTier, number>> = { hidden: 0.85, noticed: 1, danger: 1.25, bait: 1.5 };
const REWARD_MULTIPLIER: Readonly<Record<NoiseTier, number>> = { hidden: 1, noticed: 1, danger: 1.2, bait: 1.5 };

export function classifyNoise(value: number): NoiseTier {
    if (value >= 100) return "bait";
    if (value >= 60) return "danger";
    if (value >= 25) return "noticed";
    return "hidden";
}

export function validatePlacement(state: ArkState, layoutId: ArkLayoutId, slotId: string, instanceId: string): ArkResult<true> {
    const layout = state.layouts[layoutId];
    if (!layout) return { ok: false, error: "invalid_layout" };
    const slot = arkSlotById(slotId);
    if (!slot) return { ok: false, error: "unknown_slot" };
    const instance = state.modules.find((item) => item.instanceId === instanceId);
    if (!instance) return { ok: false, error: "unknown_module" };
    const definition = arkModuleById(instance.definitionId);
    if (!definition) return { ok: false, error: "unknown_module" };
    if (!definition.acceptedSlots.includes(slot.kind)) return { ok: false, error: "slot_rejects_module" };
    if (layout.slots[slotId]) return { ok: false, error: "slot_occupied" };
    if (Object.values(layout.slots).includes(instanceId)) return { ok: false, error: "instance_already_installed" };
    return { ok: true, value: true };
}

function evolutionDeltas(state: ArkState, instanceId: string): { power: number; noise: number } {
    const instance = state.modules.find((item) => item.instanceId === instanceId);
    const evolution = instance?.evolutionId ? arkEvolutionById(instance.evolutionId) : undefined;
    return { power: evolution?.powerDelta ?? 0, noise: evolution?.noiseDelta ?? 0 };
}

function installedEntries(state: ArkState) {
    const layout = state.layouts[state.activeLayoutId];
    return ARK_SLOTS.flatMap((slot) => {
        const instanceId = layout.slots[slot.id];
        if (!instanceId) return [];
        const instance = state.modules.find((item) => item.instanceId === instanceId);
        const definition = instance ? arkModuleById(instance.definitionId) : undefined;
        return instance && definition ? [{ slot, instance, definition }] : [];
    });
}

function adjacencyBonuses(state: ArkState): ArkAdjacencyBonus[] {
    const layout = state.layouts[state.activeLayoutId];
    const output: ArkAdjacencyBonus[] = [];
    const seen = new Set<string>();
    for (const slot of ARK_SLOTS) {
        const leftId = layout.slots[slot.id];
        if (!leftId) continue;
        const left = state.modules.find((item) => item.instanceId === leftId);
        const leftDefinition = left ? arkModuleById(left.definitionId) : undefined;
        if (!leftDefinition) continue;
        for (const neighborSlotId of slot.neighbors) {
            const pairKey = [slot.id, neighborSlotId].sort().join(":");
            if (seen.has(pairKey)) continue;
            seen.add(pairKey);
            const rightId = layout.slots[neighborSlotId];
            const right = state.modules.find((item) => item.instanceId === rightId);
            const rightDefinition = right ? arkModuleById(right.definitionId) : undefined;
            if (!right || !rightDefinition) continue;
            const tags = new Set([...leftDefinition.tags, ...rightDefinition.tags]);
            let bonusId = "";
            let label = "";
            if (tags.has("generator") && tags.has("battery")) {
                bonusId = "generator-battery";
                label = "储能协同：应急能源 +1";
            } else if (tags.has("repair") && tags.has("armor")) {
                bonusId = "repair-armor";
                label = "维护通道：维修效率 +15%";
            } else if (leftDefinition.tags.includes("weapon") && rightDefinition.tags.includes("weapon")) {
                bonusId = "weapon-network";
                label = "火控联动：攻击间隔 -8%";
            }
            if (!bonusId) continue;
            if (output.filter((item) => item.instanceId === leftId).length < 2) output.push({ instanceId: leftId, neighborInstanceId: rightId, bonusId, label });
            if (output.filter((item) => item.instanceId === rightId).length < 2) output.push({ instanceId: rightId, neighborInstanceId: leftId, bonusId, label });
        }
    }
    return output;
}

export function deriveArkState(state: ArkState): ArkDerivedState {
    const installed = installedEntries(state);
    const operational = installed.filter(({ instance }) => instance.durability > 0);
    const powerCapacity = operational.reduce((sum, { definition }) => sum + definition.powerCapacity, 0);
    const requests = operational
        .map(({ instance, definition }) => ({ instance, definition, demand: definition.powerDemand + evolutionDeltas(state, instance.instanceId).power }))
        .sort((a, b) => PRIORITY_RANK[a.instance.priority] - PRIORITY_RANK[b.instance.priority] || a.instance.instanceId.localeCompare(b.instance.instanceId));
    let remaining = powerCapacity;
    const powered: string[] = [];
    const unpowered: string[] = [];
    let powerDemand = 0;
    for (const request of requests) {
        powerDemand += request.demand;
        if (request.demand <= remaining) {
            powered.push(request.instance.instanceId);
            remaining -= request.demand;
        } else {
            unpowered.push(request.instance.instanceId);
        }
    }
    const poweredSet = new Set(powered);
    const noise = operational.reduce((sum, { instance, definition }) => poweredSet.has(instance.instanceId)
        ? sum + definition.noise + evolutionDeltas(state, instance.instanceId).noise
        : sum, 0);
    return Object.freeze({
        installedInstanceIds: Object.freeze(installed.map(({ instance }) => instance.instanceId)),
        poweredInstanceIds: Object.freeze(powered),
        unpoweredInstanceIds: Object.freeze(unpowered),
        powerCapacity,
        powerDemand,
        powerUsed: powerCapacity - remaining,
        noise,
        noiseTier: classifyNoise(noise),
        adjacencies: Object.freeze(adjacencyBonuses(state).map((entry) => Object.freeze(entry))),
    });
}

export function buildArkBattleSnapshot(state: ArkState): ArkBattleSnapshot {
    const derived = deriveArkState(state);
    const powered = new Set(derived.poweredInstanceIds);
    const entries: ArkBattleModuleSnapshot[] = installedEntries(state).map(({ slot, instance, definition }) => {
        const evolution = instance.evolutionId ? arkEvolutionById(instance.evolutionId) : undefined;
        return Object.freeze({
            instanceId: instance.instanceId,
            definitionId: definition.id,
            name: definition.name,
            slotId: slot.id,
            category: definition.category,
            durability: instance.durability,
            maxDurability: definition.maxDurability,
            powered: powered.has(instance.instanceId),
            operational: instance.durability > 0 && powered.has(instance.instanceId),
            battle: Object.freeze({ ...definition.battle }),
            abilityId: evolution?.abilityId ?? null,
            visualMarker: evolution?.visualMarker ?? null,
        });
    });
    const batteryBonus = derived.adjacencies.some((entry) => entry.bonusId === "generator-battery") ? 1 : 0;
    return Object.freeze({
        modules: Object.freeze(entries),
        noiseTier: derived.noiseTier,
        hordeMultiplier: HORDE_MULTIPLIER[derived.noiseTier],
        rewardMultiplier: REWARD_MULTIPLIER[derived.noiseTier],
        emergencyEnergy: Math.floor(state.resources.energyCell) + batteryBonus,
        coreDurability: state.coreDurability,
        coreMaxDurability: state.coreMaxDurability,
    });
}
