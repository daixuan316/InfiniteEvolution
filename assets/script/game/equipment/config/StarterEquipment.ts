import { EQUIPMENT_CATALOG } from "./EquipmentCatalog.ts";
import {
    createEmptyMemory,
    createEmptySlots,
    type EquipmentInstance,
    type EquipmentQuality,
    type EquipmentState,
    type MaterialId,
} from "../model/EquipmentTypes.ts";

function instance(templateId: string, index: number, quality: EquipmentQuality = "rare"): EquipmentInstance {
    const template = EQUIPMENT_CATALOG.templates.find((item) => item.id === templateId)!;
    const affixCount = quality === "common" ? 0 : quality === "fine" ? 1 : quality === "rare" ? 2 : 3;
    const allowed = EQUIPMENT_CATALOG.affixes.filter((affix) => affix.allowedSlots.includes(template.slot)
        && (!affix.allowedWeaponClasses || (template.weaponClass !== undefined && affix.allowedWeaponClasses.includes(template.weaponClass))));
    return {
        instanceId: `starter-${index}`,
        templateId,
        level: 1,
        strengthen: 0,
        quality,
        affixIds: allowed.slice(0, affixCount).map((item) => item.id),
        tags: [...template.tags],
        favorite: false,
        locked: false,
        rerollCount: 0,
        rerollSlot: null,
        evolutionId: null,
        evolutionResetCount: 0,
        memory: createEmptyMemory(),
    };
}

export function createStarterEquipmentState(): EquipmentState {
    const templates = EQUIPMENT_CATALOG.templates.map((item) => item.id);
    const instances = templates.map((templateId, index) => instance(templateId, index + 1, index < 9 ? (index < 2 ? "epic" : "rare") : "rare"));
    const byTemplate = (templateId: string) => instances.find((item) => item.templateId === templateId)!.instanceId;
    const base = createEmptySlots();
    const slots = {
        ...base,
        primary1: byTemplate("weapon_assault"),
        primary2: byTemplate("weapon_arc"),
        helmet: byTemplate("helmet_scout"),
        armor: byTemplate("armor_bulwark"),
        gloves: byTemplate("gloves_loader"),
        boots: byTemplate("boots_runner"),
        tactical: byTemplate("tactical_drone"),
        organ: byTemplate("organ_arc"),
    };
    const materials: Record<MaterialId, number> = { gold: 1200, scrap: 600, parts: 180, electronics: 90, tissue: 45, tagSample: 4, evolutionSample: 2 };
    return {
        capacity: 80,
        instances,
        materials,
        loadouts: [
            { id: "loadout-1", name: "探索方案", slots: { ...slots } },
            { id: "loadout-2", name: "守夜方案", slots: { ...slots, primary1: byTemplate("weapon_lmg"), primary2: byTemplate("weapon_grenade") } },
            { id: "loadout-3", name: "异化方案", slots: { ...slots, primary1: byTemplate("weapon_flame"), primary2: byTemplate("weapon_bio") } },
        ],
        activeLoadoutId: "loadout-1",
        roleLevel: 10,
        chapterLevelCap: 10,
        workshopLevel: 3,
        nextInstanceId: 100,
        processedBattleIds: [],
    };
}
