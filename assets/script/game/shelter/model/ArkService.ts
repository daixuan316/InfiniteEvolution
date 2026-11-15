import { arkEvolutionById, arkModuleById, createDefaultArkState } from "./ArkCatalog.ts";
import { buildArkBattleSnapshot, deriveArkState, validatePlacement } from "./ArkRules.ts";
import type {
    ArkBattleSettlement,
    ArkBattleSnapshot,
    ArkDerivedState,
    ArkLayoutId,
    ArkResourceId,
    ArkResult,
    ArkState,
    PowerPriority,
} from "./ArkTypes.ts";

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class ArkService {
    private state: ArkState;

    constructor(initialState: ArkState = createDefaultArkState()) {
        this.state = clone(initialState);
    }

    snapshot(): ArkState {
        return clone(this.state);
    }

    derived(): ArkDerivedState {
        return deriveArkState(this.state);
    }

    createBattleSnapshot(): ArkBattleSnapshot {
        return buildArkBattleSnapshot(this.state);
    }

    replace(state: ArkState): void {
        this.state = clone(state);
    }

    install(layoutId: ArkLayoutId, slotId: string, instanceId: string): ArkResult<ArkDerivedState> {
        const next = clone(this.state);
        const validation = validatePlacement(next, layoutId, slotId, instanceId);
        if ("error" in validation) return { ok: false, error: validation.error };
        const instance = next.modules.find((item) => item.instanceId === instanceId)!;
        const definition = arkModuleById(instance.definitionId)!;
        if (!instance.commissioned) {
            for (const entry of definition.cost) {
                if (next.resources[entry.resource] < entry.amount) return { ok: false, error: "insufficient_resources" };
            }
            for (const entry of definition.cost) next.resources[entry.resource] -= entry.amount;
            instance.commissioned = true;
        }
        next.layouts[layoutId].slots[slotId] = instanceId;
        return this.commit(next);
    }

    remove(layoutId: ArkLayoutId, slotId: string): ArkResult<ArkDerivedState> {
        const next = clone(this.state);
        if (!next.layouts[layoutId]) return { ok: false, error: "invalid_layout" };
        if (!(slotId in next.layouts[layoutId].slots)) return { ok: false, error: "unknown_slot" };
        next.layouts[layoutId].slots[slotId] = null;
        return this.commit(next);
    }

    move(layoutId: ArkLayoutId, fromSlotId: string, toSlotId: string): ArkResult<ArkDerivedState> {
        const next = clone(this.state);
        const layout = next.layouts[layoutId];
        if (!layout) return { ok: false, error: "invalid_layout" };
        const instanceId = layout.slots[fromSlotId];
        if (!instanceId) return { ok: false, error: "unknown_module" };
        layout.slots[fromSlotId] = null;
        const validation = validatePlacement(next, layoutId, toSlotId, instanceId);
        if ("error" in validation) return { ok: false, error: validation.error };
        layout.slots[toSlotId] = instanceId;
        return this.commit(next);
    }

    setPriority(instanceId: string, priority: PowerPriority): ArkResult<ArkDerivedState> {
        const next = clone(this.state);
        const instance = next.modules.find((item) => item.instanceId === instanceId);
        if (!instance) return { ok: false, error: "unknown_module" };
        instance.priority = priority;
        return this.commit(next);
    }

    switchLayout(layoutId: ArkLayoutId): ArkResult<ArkDerivedState> {
        const next = clone(this.state);
        const layout = next.layouts[layoutId];
        if (!layout) return { ok: false, error: "invalid_layout" };
        const known = new Set(next.modules.map((item) => item.instanceId));
        if (Object.values(layout.slots).some((id) => id !== null && !known.has(id))) return { ok: false, error: "invalid_layout" };
        next.activeLayoutId = layoutId;
        return this.commit(next);
    }

    enqueueRepair(instanceId: string): ArkResult<ArkDerivedState> {
        const next = clone(this.state);
        const instance = next.modules.find((item) => item.instanceId === instanceId);
        const definition = instance ? arkModuleById(instance.definitionId) : undefined;
        if (!instance || !definition) return { ok: false, error: "unknown_module" };
        if (instance.durability >= definition.maxDurability) return { ok: false, error: "repair_not_needed" };
        if (!next.repairQueue.includes(instanceId)) next.repairQueue.push(instanceId);
        return this.commit(next);
    }

    processRepair(maxPoints = 100, night = false): ArkResult<ArkDerivedState> {
        const next = clone(this.state);
        const instanceId = next.repairQueue[0];
        const instance = next.modules.find((item) => item.instanceId === instanceId);
        const definition = instance ? arkModuleById(instance.definitionId) : undefined;
        if (!instance || !definition) return { ok: false, error: "repair_not_needed" };
        const repairPoints = Math.min(Math.max(0, maxPoints), definition.maxDurability - instance.durability, 200 - next.repairSpentToday);
        if (repairPoints <= 0) return { ok: false, error: "repair_cap_reached" };
        const scrap = Math.ceil(repairPoints / 10);
        const parts = Math.ceil(repairPoints / 25);
        if (next.resources.scrap < scrap || next.resources.parts < parts || (night && next.resources.energyCell < 2)) {
            return { ok: false, error: "insufficient_resources" };
        }
        next.resources.scrap -= scrap;
        next.resources.parts -= parts;
        if (night) next.resources.energyCell -= 2;
        instance.durability += repairPoints;
        next.repairSpentToday += repairPoints;
        if (instance.durability >= definition.maxDurability) next.repairQueue.shift();
        return this.commit(next);
    }

    applyEvolution(instanceId: string, evolutionId: string): ArkResult<ArkDerivedState> {
        const next = clone(this.state);
        const instance = next.modules.find((item) => item.instanceId === instanceId);
        if (!instance) return { ok: false, error: "unknown_module" };
        if (instance.evolutionId) return { ok: false, error: "already_evolved" };
        const evolution = arkEvolutionById(evolutionId);
        if (!evolution || !evolution.compatibleDefinitionIds.includes(instance.definitionId)) return { ok: false, error: "evolution_incompatible" };
        if (next.resources.mutationCore < 1) return { ok: false, error: "insufficient_resources" };
        next.resources.mutationCore -= 1;
        instance.evolutionId = evolutionId;
        return this.commit(next);
    }

    removeEvolution(instanceId: string): ArkResult<ArkDerivedState> {
        const next = clone(this.state);
        const instance = next.modules.find((item) => item.instanceId === instanceId);
        if (!instance) return { ok: false, error: "unknown_module" };
        if (!instance.evolutionId) return { ok: false, error: "evolution_incompatible" };
        instance.evolutionId = null;
        next.resources.mutationCore += 0.5;
        return this.commit(next);
    }

    applyBattleSettlement(settlement: ArkBattleSettlement): ArkResult<ArkDerivedState> {
        const next = clone(this.state);
        if (next.appliedBattleIds.includes(settlement.battleId)) return { ok: false, error: "settlement_already_applied" };
        for (const update of settlement.moduleDurability) {
            const instance = next.modules.find((item) => item.instanceId === update.instanceId);
            const definition = instance ? arkModuleById(instance.definitionId) : undefined;
            if (instance && definition) instance.durability = Math.max(0, Math.min(definition.maxDurability, update.durability));
        }
        for (const [resource, delta] of Object.entries(settlement.resourceDeltas) as [ArkResourceId, number][]) {
            if (Number.isFinite(delta)) next.resources[resource] = Math.max(0, next.resources[resource] + delta);
        }
        next.coreDurability = Math.max(0, Math.min(next.coreMaxDurability, settlement.coreDurability));
        next.appliedBattleIds.push(settlement.battleId);
        if (next.appliedBattleIds.length > 20) next.appliedBattleIds.shift();
        return this.commit(next);
    }

    private commit(next: ArkState): ArkResult<ArkDerivedState> {
        this.state = next;
        return { ok: true, value: deriveArkState(next) };
    }
}

