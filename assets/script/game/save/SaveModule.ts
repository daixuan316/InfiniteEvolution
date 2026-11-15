import { EQUIPMENT_CATALOG } from "../equipment/config/EquipmentCatalog.ts";
import { EquipmentRuntime, getEquipmentRuntime, installEquipmentRuntime } from "../equipment/EquipmentRuntime.ts";
import { OopsStorageAdapter } from "./OopsStorageAdapter.ts";
import { SaveRepository } from "./SaveRepository.ts";

let initialized = false;

/** Versioned campaign save boundary. */
export class SaveModule {
    readonly repository = new SaveRepository(new OopsStorageAdapter(), "campaign", EQUIPMENT_CATALOG);

    initialize(): EquipmentRuntime {
        if (initialized) return getEquipmentRuntime();
        const loaded = this.repository.load();
        initialized = true;
        return installEquipmentRuntime(new EquipmentRuntime(EQUIPMENT_CATALOG, loaded.save.equipment, this.repository, loaded.save.revision));
    }
}

export const saveModule = new SaveModule();

export function persistentEquipmentRuntime(): EquipmentRuntime {
    return saveModule.initialize();
}
