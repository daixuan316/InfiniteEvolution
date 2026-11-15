import { createStarterEquipmentState } from "../../equipment/config/StarterEquipment.ts";
import { EQUIPMENT_SLOTS, type EquipmentCatalog, type EquipmentState, type MaterialId } from "../../equipment/model/EquipmentTypes.ts";

export const SAVE_SCHEMA_VERSION = 1;

export interface CampaignEquipmentSave {
    schemaVersion: 1;
    revision: number;
    equipment: EquipmentState;
}

export interface MigrationResult {
    save: CampaignEquipmentSave;
    diagnostics: string[];
}

export function createNewCampaignSave(): CampaignEquipmentSave {
    return { schemaVersion: SAVE_SCHEMA_VERSION, revision: 0, equipment: createStarterEquipmentState() };
}

export function migrateCampaignSave(raw: unknown, catalog: EquipmentCatalog): MigrationResult {
    const diagnostics: string[] = [];
    const source = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    const candidate = source.equipment && typeof source.equipment === "object"
        ? structuredClone(source.equipment as EquipmentState)
        : createStarterEquipmentState();
    const templateIds = new Set(catalog.templates.map((item) => item.id));
    const seen = new Set<string>();
    candidate.instances = Array.isArray(candidate.instances) ? candidate.instances.filter((item) => {
        const valid = Boolean(item?.instanceId && item?.templateId && templateIds.has(item.templateId) && !seen.has(item.instanceId));
        if (!valid) diagnostics.push(`removed invalid equipment instance: ${item?.instanceId ?? "unknown"}`);
        if (valid) seen.add(item.instanceId);
        return valid;
    }) : [];
    const starter = createStarterEquipmentState();
    candidate.capacity = Number.isFinite(candidate.capacity) && candidate.capacity >= candidate.instances.length ? candidate.capacity : Math.max(80, candidate.instances.length);
    candidate.materials = { ...starter.materials, ...(candidate.materials ?? {}) };
    for (const id of Object.keys(candidate.materials) as MaterialId[]) {
        if (!Number.isFinite(candidate.materials[id]) || candidate.materials[id] < 0) candidate.materials[id] = 0;
    }
    candidate.loadouts = Array.isArray(candidate.loadouts) && candidate.loadouts.length > 0 ? candidate.loadouts.slice(0, 3) : starter.loadouts;
    const instanceIds = new Set(candidate.instances.map((item) => item.instanceId));
    for (const loadout of candidate.loadouts) {
        loadout.slots = { ...starter.loadouts[0].slots, ...(loadout.slots ?? {}) };
        for (const slot of EQUIPMENT_SLOTS) {
            const instanceId = loadout.slots[slot];
            if (instanceId !== null && !instanceIds.has(instanceId)) {
                diagnostics.push(`cleared dangling ${slot} reference: ${instanceId}`);
                loadout.slots[slot] = null;
            }
        }
    }
    while (candidate.loadouts.length < 3) candidate.loadouts.push(structuredClone(starter.loadouts[candidate.loadouts.length]));
    if (!candidate.loadouts.some((item) => item.id === candidate.activeLoadoutId)) candidate.activeLoadoutId = candidate.loadouts[0].id;
    candidate.roleLevel = Number.isFinite(candidate.roleLevel) && candidate.roleLevel > 0 ? candidate.roleLevel : starter.roleLevel;
    candidate.chapterLevelCap = Number.isFinite(candidate.chapterLevelCap) && candidate.chapterLevelCap > 0 ? candidate.chapterLevelCap : starter.chapterLevelCap;
    candidate.workshopLevel = Number.isFinite(candidate.workshopLevel) && candidate.workshopLevel > 0 ? candidate.workshopLevel : starter.workshopLevel;
    candidate.nextInstanceId = Number.isInteger(candidate.nextInstanceId) && candidate.nextInstanceId > 0 ? candidate.nextInstanceId : starter.nextInstanceId;
    candidate.processedBattleIds = Array.isArray(candidate.processedBattleIds) ? candidate.processedBattleIds.filter((id) => typeof id === "string").slice(-50) : [];
    return {
        save: {
            schemaVersion: SAVE_SCHEMA_VERSION,
            revision: Number.isInteger(source.revision) && Number(source.revision) >= 0 ? Number(source.revision) : 0,
            equipment: candidate,
        },
        diagnostics,
    };
}
