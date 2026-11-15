import type {
    EquipmentCommandResult,
    EquipmentInstance,
    MaterialId,
} from "./EquipmentTypes.ts";

export interface InventoryState {
    capacity: number;
    instances: EquipmentInstance[];
    materials: Record<MaterialId, number>;
}

function validMaterialDelta(costs: Partial<Record<MaterialId, number>>): boolean {
    return Object.values(costs).every((value) => Number.isFinite(value) && value! >= 0);
}

export class EquipmentInventory {
    private state: InventoryState;

    constructor(state: InventoryState) {
        this.state = structuredClone(state);
    }

    snapshot(): InventoryState {
        return structuredClone(this.state);
    }

    find(instanceId: string): EquipmentInstance | undefined {
        const item = this.state.instances.find((candidate) => candidate.instanceId === instanceId);
        return item ? structuredClone(item) : undefined;
    }

    materialCount(id: MaterialId): number {
        return this.state.materials[id] ?? 0;
    }

    add(instance: EquipmentInstance): EquipmentCommandResult<EquipmentInstance> {
        if (this.state.instances.length >= this.state.capacity) return { ok: false, error: "inventory-full" };
        if (!instance.instanceId || this.state.instances.some((item) => item.instanceId === instance.instanceId)) return { ok: false, error: "invalid-command" };
        const copy = structuredClone(instance);
        this.state.instances.push(copy);
        return { ok: true, value: structuredClone(copy) };
    }

    remove(instanceId: string, protectedBy: (instanceId: string) => boolean = () => false): EquipmentCommandResult<EquipmentInstance> {
        const index = this.state.instances.findIndex((item) => item.instanceId === instanceId);
        if (index < 0) return { ok: false, error: "missing-instance" };
        if (protectedBy(instanceId)) return { ok: false, error: "protected-instance" };
        const [removed] = this.state.instances.splice(index, 1);
        return { ok: true, value: structuredClone(removed) };
    }

    spendMaterials(costs: Partial<Record<MaterialId, number>>): EquipmentCommandResult<Record<MaterialId, number>> {
        if (!validMaterialDelta(costs)) return { ok: false, error: "invalid-command" };
        for (const [id, amount] of Object.entries(costs) as Array<[MaterialId, number]>) {
            if (this.materialCount(id) < amount) return { ok: false, error: "insufficient-materials" };
        }
        for (const [id, amount] of Object.entries(costs) as Array<[MaterialId, number]>) this.state.materials[id] -= amount;
        return { ok: true, value: structuredClone(this.state.materials) };
    }

    addMaterials(rewards: Partial<Record<MaterialId, number>>): EquipmentCommandResult<Record<MaterialId, number>> {
        if (!validMaterialDelta(rewards)) return { ok: false, error: "invalid-command" };
        for (const [id, amount] of Object.entries(rewards) as Array<[MaterialId, number]>) this.state.materials[id] = this.materialCount(id) + amount;
        return { ok: true, value: structuredClone(this.state.materials) };
    }
}
