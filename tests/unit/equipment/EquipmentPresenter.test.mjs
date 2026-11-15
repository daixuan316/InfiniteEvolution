import assert from "node:assert/strict";
import test from "node:test";

import { EQUIPMENT_CATALOG } from "../../../assets/script/game/equipment/config/EquipmentCatalog.ts";
import { createStarterEquipmentState } from "../../../assets/script/game/equipment/config/StarterEquipment.ts";
import { EquipmentRuntime } from "../../../assets/script/game/equipment/EquipmentRuntime.ts";
import { EquipmentPresenter } from "../../../assets/script/game/equipment/view/EquipmentPresenter.ts";

class MemoryRepository {
    commit(save) { return { ...structuredClone(save), revision: save.revision + 1 }; }
}

test("equipment presenter exposes real inventory, slots, comparison, and actions", () => {
    const runtime = new EquipmentRuntime(EQUIPMENT_CATALOG, createStarterEquipmentState(), new MemoryRepository());
    const candidate = runtime.snapshot().instances.find((item) => item.templateId === "weapon_sniper");
    const model = new EquipmentPresenter(runtime, EQUIPMENT_CATALOG).select(candidate.instanceId).view();

    assert.equal(model.inventory.length, 9);
    assert.equal(model.loadouts.length, 3);
    assert.equal(model.slots.length, 8);
    assert.equal(model.selected.instanceId, candidate.instanceId);
    assert.ok(model.comparison.damage.delta > 0);
    assert.equal(model.actions.equip.enabled, true);
    assert.equal(model.resonances.length, 6);
});

test("equipment presenter changes the real runtime loadout", () => {
    const runtime = new EquipmentRuntime(EQUIPMENT_CATALOG, createStarterEquipmentState(), new MemoryRepository());
    const candidate = runtime.snapshot().instances.find((item) => item.templateId === "weapon_sniper");
    const presenter = new EquipmentPresenter(runtime, EQUIPMENT_CATALOG).select(candidate.instanceId);

    assert.equal(presenter.equipSelected().ok, true);
    assert.equal(runtime.snapshot().loadouts[0].slots.primary1, candidate.instanceId);
});

test("armor category includes every physical armor slot", () => {
    const runtime = new EquipmentRuntime(EQUIPMENT_CATALOG, createStarterEquipmentState(), new MemoryRepository());
    const model = new EquipmentPresenter(runtime, EQUIPMENT_CATALOG).setCategory("armor").view();

    assert.deepEqual(model.inventory.map((item) => item.slot).sort(), ["armor", "boots", "gloves", "helmet"]);
});
