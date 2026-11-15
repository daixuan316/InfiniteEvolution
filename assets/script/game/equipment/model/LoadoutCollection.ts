import { getTemplate } from "../config/EquipmentCatalog.ts";
import type {
    EquipmentCatalog,
    EquipmentCommandResult,
    EquipmentInstance,
    EquipmentLoadout,
    EquipmentSlot,
    TemplateSlot,
} from "./EquipmentTypes.ts";

function slotType(slot: EquipmentSlot): TemplateSlot {
    return slot === "primary1" || slot === "primary2" ? "weapon" : slot;
}

export class LoadoutCollection {
    private loadouts: EquipmentLoadout[];
    private activeId: string;
    private readonly catalog: EquipmentCatalog;

    constructor(loadouts: EquipmentLoadout[], catalog: EquipmentCatalog, activeId = loadouts[0]?.id ?? "") {
        this.loadouts = structuredClone(loadouts);
        this.activeId = activeId;
        this.catalog = catalog;
    }

    snapshot(): EquipmentLoadout[] {
        return structuredClone(this.loadouts);
    }

    get activeLoadoutId(): string {
        return this.activeId;
    }

    get(id: string): EquipmentLoadout {
        const loadout = this.loadouts.find((item) => item.id === id);
        if (!loadout) throw new Error(`missing loadout: ${id}`);
        return structuredClone(loadout);
    }

    select(id: string): EquipmentCommandResult<EquipmentLoadout> {
        const loadout = this.loadouts.find((item) => item.id === id);
        if (!loadout) return { ok: false, error: "missing-loadout" };
        this.activeId = id;
        return { ok: true, value: structuredClone(loadout) };
    }

    rename(id: string, requestedName: string): EquipmentCommandResult<EquipmentLoadout> {
        const loadout = this.loadouts.find((item) => item.id === id);
        if (!loadout) return { ok: false, error: "missing-loadout" };
        const normalized = [...requestedName.trim()].slice(0, 12).join("");
        if (!normalized) return { ok: false, error: "invalid-command" };
        loadout.name = normalized;
        return { ok: true, value: structuredClone(loadout) };
    }

    equip(id: string, slot: EquipmentSlot, instance: EquipmentInstance): EquipmentCommandResult<EquipmentLoadout> {
        const loadout = this.loadouts.find((item) => item.id === id);
        if (!loadout) return { ok: false, error: "missing-loadout" };
        const template = getTemplate(this.catalog, instance.templateId);
        if (!template) return { ok: false, error: "missing-instance" };
        if (template.slot !== slotType(slot)) return { ok: false, error: "slot-mismatch" };
        for (const [candidateSlot, instanceId] of Object.entries(loadout.slots)) {
            if (candidateSlot !== slot && instanceId === instance.instanceId) return { ok: false, error: "duplicate-slot" };
        }
        loadout.slots[slot] = instance.instanceId;
        return { ok: true, value: structuredClone(loadout) };
    }

    unequip(id: string, slot: EquipmentSlot): EquipmentCommandResult<EquipmentLoadout> {
        const loadout = this.loadouts.find((item) => item.id === id);
        if (!loadout) return { ok: false, error: "missing-loadout" };
        loadout.slots[slot] = null;
        return { ok: true, value: structuredClone(loadout) };
    }

    swapPrimary(id: string): EquipmentCommandResult<EquipmentLoadout> {
        const loadout = this.loadouts.find((item) => item.id === id);
        if (!loadout) return { ok: false, error: "missing-loadout" };
        const primary1 = loadout.slots.primary1;
        loadout.slots.primary1 = loadout.slots.primary2;
        loadout.slots.primary2 = primary1;
        return { ok: true, value: structuredClone(loadout) };
    }

    references(instanceId: string): boolean {
        return this.loadouts.some((loadout) => Object.values(loadout.slots).includes(instanceId));
    }

    missingReferences(instances: readonly EquipmentInstance[]): string[] {
        const ids = new Set(instances.map((item) => item.instanceId));
        return [...new Set(this.loadouts.flatMap((loadout) => Object.values(loadout.slots).filter((id): id is string => id !== null && !ids.has(id))))];
    }
}
