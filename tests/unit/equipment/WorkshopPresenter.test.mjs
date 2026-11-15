import assert from "node:assert/strict";
import test from "node:test";

import { EQUIPMENT_CATALOG } from "../../../assets/script/game/equipment/config/EquipmentCatalog.ts";
import { createStarterEquipmentState } from "../../../assets/script/game/equipment/config/StarterEquipment.ts";
import { EquipmentRuntime } from "../../../assets/script/game/equipment/EquipmentRuntime.ts";
import { WorkshopPresenter } from "../../../assets/script/game/equipment/view/WorkshopPresenter.ts";

class MemoryRepository {
    commit(save) { return { ...structuredClone(save), revision: save.revision + 1 }; }
}

test("workshop presenter previews real recipe costs and executes crafting", () => {
    const runtime = new EquipmentRuntime(EQUIPMENT_CATALOG, createStarterEquipmentState(), new MemoryRepository());
    const presenter = new WorkshopPresenter(runtime, EQUIPMENT_CATALOG).selectRecipe("recipe_sniper");
    const before = runtime.snapshot().instances.length;
    const model = presenter.view();

    assert.equal(model.mode, "craft");
    assert.equal(model.selectedRecipe.id, "recipe_sniper");
    assert.equal(model.action.enabled, true);
    assert.equal(presenter.confirm().ok, true);
    assert.equal(runtime.snapshot().instances.length, before + 1);
});

test("workshop reports protected salvage instead of deleting equipped items", () => {
    const runtime = new EquipmentRuntime(EQUIPMENT_CATALOG, createStarterEquipmentState(), new MemoryRepository());
    const equippedId = runtime.snapshot().loadouts[0].slots.primary1;
    const presenter = new WorkshopPresenter(runtime, EQUIPMENT_CATALOG).setMode("salvage").selectInstance(equippedId);

    assert.equal(presenter.view().action.enabled, false);
    assert.equal(presenter.view().action.reason, "方案正在使用该装备");
    assert.deepEqual(presenter.confirm(), { ok: false, error: "protected-instance" });
});
