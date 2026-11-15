import assert from "node:assert/strict";
import test from "node:test";

import { createStarterEquipmentState } from "../../../assets/script/game/equipment/config/StarterEquipment.ts";
import { EquipmentInventory } from "../../../assets/script/game/equipment/model/EquipmentInventory.ts";

test("inventory rejects overflow and material spending is atomic", () => {
    const state = createStarterEquipmentState();
    const first = structuredClone(state.instances[0]);
    const second = { ...structuredClone(state.instances[1]), instanceId: "other" };
    const inventory = new EquipmentInventory({ capacity: 1, instances: [], materials: { ...state.materials, scrap: 10 } });

    assert.equal(inventory.add(first).ok, true);
    assert.deepEqual(inventory.add(second), { ok: false, error: "inventory-full" });
    assert.deepEqual(inventory.spendMaterials({ scrap: 11 }), { ok: false, error: "insufficient-materials" });
    assert.equal(inventory.materialCount("scrap"), 10);
});

test("protected removal and invalid material amounts never mutate inventory", () => {
    const state = createStarterEquipmentState();
    const inventory = new EquipmentInventory({ capacity: state.capacity, instances: state.instances, materials: state.materials });
    const before = inventory.snapshot();

    assert.deepEqual(inventory.remove(state.instances[0].instanceId, () => true), { ok: false, error: "protected-instance" });
    assert.deepEqual(inventory.addMaterials({ scrap: Number.NaN }), { ok: false, error: "invalid-command" });
    assert.deepEqual(inventory.snapshot(), before);
});
