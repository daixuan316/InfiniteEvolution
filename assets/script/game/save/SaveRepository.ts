import { createNewCampaignSave, migrateCampaignSave, type CampaignEquipmentSave } from "./model/CampaignEquipmentSave.ts";
import type { EquipmentCatalog } from "../equipment/model/EquipmentTypes.ts";

export interface KeyValueStore {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
}

export interface SaveLoadResult {
    save: CampaignEquipmentSave;
    source: "current" | "previous" | "starter";
    diagnostics: string[];
}

export interface CampaignSaveRepository {
    commit(save: CampaignEquipmentSave): CampaignEquipmentSave;
}

export class SaveRepository implements CampaignSaveRepository {
    private readonly store: KeyValueStore;
    private readonly prefix: string;
    private readonly catalog: EquipmentCatalog;

    constructor(store: KeyValueStore, prefix: string, catalog: EquipmentCatalog) {
        this.store = store;
        this.prefix = prefix;
        this.catalog = catalog;
    }

    load(): SaveLoadResult {
        const diagnostics: string[] = [];
        for (const source of ["current", "previous"] as const) {
            const text = this.store.get(`${this.prefix}:${source}`);
            if (!text) continue;
            try {
                const migrated = migrateCampaignSave(JSON.parse(text), this.catalog);
                return { save: migrated.save, source, diagnostics: [...diagnostics, ...migrated.diagnostics] };
            } catch (error) {
                diagnostics.push(`${source} snapshot invalid: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        return { save: createNewCampaignSave(), source: "starter", diagnostics };
    }

    commit(save: CampaignEquipmentSave): CampaignEquipmentSave {
        const next = { ...structuredClone(save), revision: save.revision + 1 } as CampaignEquipmentSave;
        const text = JSON.stringify(next);
        const validated = migrateCampaignSave(JSON.parse(text), this.catalog).save;
        const currentKey = `${this.prefix}:current`;
        const previousKey = `${this.prefix}:previous`;
        const tempKey = `${this.prefix}:temp`;
        this.store.set(tempKey, JSON.stringify(validated));
        const current = this.store.get(currentKey);
        if (current) this.store.set(previousKey, current);
        this.store.set(currentKey, this.store.get(tempKey)!);
        this.store.remove(tempKey);
        return validated;
    }
}
