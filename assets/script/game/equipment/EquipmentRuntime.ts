import { EQUIPMENT_CATALOG } from "./config/EquipmentCatalog.ts";
import { createStarterEquipmentState } from "./config/StarterEquipment.ts";
import { chooseEvolution, recordMemory, resetEvolution as resetEvolutionState, type CombatMemoryEvent } from "./model/CombatMemory.ts";
import { EquipmentEconomyService } from "./model/EquipmentEconomyService.ts";
import { resolveRoleCombatSnapshot } from "./model/EquipmentResolver.ts";
import { LoadoutCollection } from "./model/LoadoutCollection.ts";
import type {
    AffixCategory,
    EquipmentCatalog,
    EquipmentCommandResult,
    EquipmentSlot,
    EquipmentState,
    MemoryKind,
    RoleCombatSnapshot,
} from "./model/EquipmentTypes.ts";
import type { CampaignEquipmentSave } from "../save/model/CampaignEquipmentSave.ts";
import type { CampaignSaveRepository } from "../save/SaveRepository.ts";

export interface BattleMemoryDelta extends CombatMemoryEvent {
    instanceId: string;
}

type StateMutation<T> = (draft: EquipmentState) => EquipmentCommandResult<{ state: EquipmentState; value: T }>;

export class EquipmentRuntime {
    private state: EquipmentState;
    private revision: number;
    private readonly catalog: EquipmentCatalog;
    private readonly repository: CampaignSaveRepository;
    private readonly economy: EquipmentEconomyService;
    private readonly listeners = new Set<(state: EquipmentState) => void>();

    constructor(catalog: EquipmentCatalog, state: EquipmentState, repository: CampaignSaveRepository, revision = 0) {
        this.catalog = catalog;
        this.state = structuredClone(state);
        this.repository = repository;
        this.revision = Number.isInteger(revision) && revision >= 0 ? revision : 0;
        this.economy = new EquipmentEconomyService(catalog);
    }

    snapshot(): EquipmentState {
        return structuredClone(this.state);
    }

    combatSnapshot(): RoleCombatSnapshot {
        return resolveRoleCombatSnapshot(this.state, this.catalog);
    }

    subscribe(listener: (state: EquipmentState) => void): () => void {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    equip(loadoutId: string, slot: EquipmentSlot, instanceId: string): EquipmentCommandResult<EquipmentState> {
        return this.commit((draft) => {
            const instance = draft.instances.find((item) => item.instanceId === instanceId);
            if (!instance) return { ok: false, error: "missing-instance" };
            const loadouts = new LoadoutCollection(draft.loadouts, this.catalog, draft.activeLoadoutId);
            const result = loadouts.equip(loadoutId, slot, instance);
            if (result.ok === false) return { ok: false, error: result.error };
            draft.loadouts = loadouts.snapshot();
            return { ok: true, value: { state: draft, value: draft } };
        });
    }

    unequip(loadoutId: string, slot: EquipmentSlot): EquipmentCommandResult<EquipmentState> {
        return this.commit((draft) => {
            const loadouts = new LoadoutCollection(draft.loadouts, this.catalog, draft.activeLoadoutId);
            const result = loadouts.unequip(loadoutId, slot);
            if (result.ok === false) return { ok: false, error: result.error };
            draft.loadouts = loadouts.snapshot();
            return { ok: true, value: { state: draft, value: draft } };
        });
    }

    selectLoadout(loadoutId: string): EquipmentCommandResult<EquipmentState> {
        return this.commit((draft) => {
            const loadouts = new LoadoutCollection(draft.loadouts, this.catalog, draft.activeLoadoutId);
            const result = loadouts.select(loadoutId);
            if (result.ok === false) return { ok: false, error: result.error };
            draft.activeLoadoutId = loadoutId;
            return { ok: true, value: { state: draft, value: draft } };
        });
    }

    swapPrimaries(loadoutId = this.state.activeLoadoutId): EquipmentCommandResult<EquipmentState> {
        return this.commit((draft) => {
            const loadouts = new LoadoutCollection(draft.loadouts, this.catalog, draft.activeLoadoutId);
            const result = loadouts.swapPrimary(loadoutId);
            if (result.ok === false) return { ok: false, error: result.error };
            draft.loadouts = loadouts.snapshot();
            return { ok: true, value: { state: draft, value: draft } };
        });
    }

    toggleFavorite(instanceId: string): EquipmentCommandResult<EquipmentState> {
        return this.mutateInstance(instanceId, (item) => { item.favorite = !item.favorite; });
    }

    toggleLock(instanceId: string): EquipmentCommandResult<EquipmentState> {
        return this.mutateInstance(instanceId, (item) => { item.locked = !item.locked; });
    }

    craft(recipeId: string): EquipmentCommandResult<EquipmentState> {
        return this.economyCommand((draft) => this.economy.craft(draft, recipeId));
    }

    strengthen(instanceId: string): EquipmentCommandResult<EquipmentState> {
        return this.economyCommand((draft) => this.economy.strengthen(draft, instanceId));
    }

    synchronize(instanceId: string): EquipmentCommandResult<EquipmentState> {
        return this.economyCommand((draft) => this.economy.synchronize(draft, instanceId));
    }

    rerollAffix(instanceId: string, slot: number, category: AffixCategory): EquipmentCommandResult<EquipmentState> {
        return this.economyCommand((draft) => this.economy.rerollAffix(draft, instanceId, slot, category));
    }

    salvage(instanceId: string, confirmed = false): EquipmentCommandResult<EquipmentState> {
        return this.economyCommand((draft) => this.economy.salvageOne(draft, instanceId, confirmed));
    }

    chooseEvolution(instanceId: string, evolutionId: string): EquipmentCommandResult<EquipmentState> {
        return this.commit((draft) => {
            const index = draft.instances.findIndex((item) => item.instanceId === instanceId);
            if (index < 0) return { ok: false, error: "missing-instance" };
            const result = chooseEvolution(draft.instances[index], evolutionId, this.catalog);
            if (result.ok === false) return { ok: false, error: result.error };
            draft.instances[index] = result.value;
            return { ok: true, value: { state: draft, value: draft } };
        });
    }

    resetEvolution(instanceId: string): EquipmentCommandResult<EquipmentState> {
        return this.commit((draft) => {
            const index = draft.instances.findIndex((item) => item.instanceId === instanceId);
            if (index < 0) return { ok: false, error: "missing-instance" };
            const result = resetEvolutionState(draft.instances[index], draft.materials.evolutionSample);
            if (result.ok === false) return { ok: false, error: result.error };
            draft.instances[index] = result.value.instance;
            draft.materials.evolutionSample -= result.value.cost;
            return { ok: true, value: { state: draft, value: draft } };
        });
    }

    recordBattleMemory(battleId: string, deltas: readonly BattleMemoryDelta[]): EquipmentCommandResult<EquipmentState> {
        if (this.state.processedBattleIds.includes(battleId)) return { ok: true, value: this.snapshot() };
        return this.commit((draft) => {
            for (const delta of deltas) {
                const index = draft.instances.findIndex((item) => item.instanceId === delta.instanceId);
                if (index >= 0) draft.instances[index] = recordMemory(draft.instances[index], delta);
            }
            draft.processedBattleIds = [...draft.processedBattleIds, battleId].slice(-50);
            return { ok: true, value: { state: draft, value: draft } };
        });
    }

    private mutateInstance(instanceId: string, mutation: (item: EquipmentState["instances"][number]) => void): EquipmentCommandResult<EquipmentState> {
        return this.commit((draft) => {
            const item = draft.instances.find((candidate) => candidate.instanceId === instanceId);
            if (!item) return { ok: false, error: "missing-instance" };
            mutation(item);
            return { ok: true, value: { state: draft, value: draft } };
        });
    }

    private economyCommand(operation: (draft: EquipmentState) => EquipmentCommandResult<{ state: EquipmentState }>): EquipmentCommandResult<EquipmentState> {
        return this.commit((draft) => {
            const result = operation(draft);
            if (result.ok === false) return { ok: false, error: result.error };
            return { ok: true, value: { state: result.value.state, value: result.value.state } };
        });
    }

    private commit<T>(mutation: StateMutation<T>): EquipmentCommandResult<T> {
        const result = mutation(structuredClone(this.state));
        if (result.ok === false) return { ok: false, error: result.error };
        try {
            const save: CampaignEquipmentSave = { schemaVersion: 1, revision: this.revision, equipment: result.value.state };
            const committed = this.repository.commit(save);
            this.revision = committed.revision;
            this.state = structuredClone(committed.equipment);
            const snapshot = this.snapshot();
            for (const listener of this.listeners) listener(snapshot);
            return { ok: true, value: result.value.value };
        } catch {
            return { ok: false, error: "save-failed" };
        }
    }
}

class MemoryRepository implements CampaignSaveRepository {
    commit(save: CampaignEquipmentSave): CampaignEquipmentSave {
        return { ...structuredClone(save), revision: save.revision + 1 };
    }
}

let activeEquipmentRuntime = new EquipmentRuntime(EQUIPMENT_CATALOG, createStarterEquipmentState(), new MemoryRepository());

export function getEquipmentRuntime(): EquipmentRuntime {
    return activeEquipmentRuntime;
}

export function installEquipmentRuntime(runtime: EquipmentRuntime): EquipmentRuntime {
    activeEquipmentRuntime = runtime;
    return activeEquipmentRuntime;
}

export function memoryKindLabel(kind: MemoryKind): string {
    const labels: Record<MemoryKind, string> = { closeHit: "近距战斗", weakpointHit: "弱点命中", swapChain: "连续换枪", arkDefenseKill: "方舟防守", statusProc: "异常触发", highPollutionUse: "高污染使用" };
    return labels[kind];
}
