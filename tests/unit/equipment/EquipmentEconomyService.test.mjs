import assert from "node:assert/strict";
import test from "node:test";

import { EQUIPMENT_CATALOG } from "../../../assets/script/game/equipment/config/EquipmentCatalog.ts";
import { createStarterEquipmentState } from "../../../assets/script/game/equipment/config/StarterEquipment.ts";
import { EquipmentEconomyService } from "../../../assets/script/game/equipment/model/EquipmentEconomyService.ts";

const service = new EquipmentEconomyService(EQUIPMENT_CATALOG, { next: () => 0.25 });

test("failed craft leaves resources and instances unchanged", () => {
    const state = createStarterEquipmentState();
    state.materials.scrap = 0;
    const before = structuredClone(state);

    assert.deepEqual(service.craft(state, "recipe_assault"), { ok: false, error: "insufficient-materials" });
    assert.deepEqual(state, before);
});

test("craft, strengthen, synchronize, and reroll return new atomic states", () => {
    const state = createStarterEquipmentState();
    const crafted = service.craft(state, "recipe_smg");
    assert.equal(crafted.ok, true);
    assert.equal(crafted.value.state.instances.length, state.instances.length + 1);
    assert.equal(state.instances.length + 1, crafted.value.state.instances.length);

    const targetId = state.instances.find((item) => item.templateId === "weapon_assault").instanceId;
    const strengthened = service.strengthen(state, targetId);
    assert.equal(strengthened.ok, true);
    assert.equal(strengthened.value.instance.strengthen, 1);
    const synchronized = service.synchronize(strengthened.value.state, targetId);
    assert.equal(synchronized.ok, true);
    assert.equal(synchronized.value.instance.level, state.roleLevel);
    const rerolled = service.rerollAffix(synchronized.value.state, targetId, 0, "output");
    assert.equal(rerolled.ok, true);
    assert.equal(rerolled.value.instance.rerollCount, 1);
    assert.equal(rerolled.value.instance.rerollSlot, 0);
});

test("bulk salvage skips equipped, favorite, locked, evolved, and legendary items", () => {
    const state = createStarterEquipmentState();
    const free = state.instances.find((item) => item.templateId === "weapon_smg");
    free.quality = "rare";
    free.favorite = false;
    free.locked = false;
    free.evolutionId = null;
    for (const loadout of state.loadouts) {
        for (const slot of Object.keys(loadout.slots)) if (loadout.slots[slot] === free.instanceId) loadout.slots[slot] = null;
    }
    const protectedIds = state.instances.filter((item) => item.instanceId !== free.instanceId).map((item) => item.instanceId);
    state.instances[2].favorite = true;
    state.instances[3].locked = true;
    state.instances[4].evolutionId = "lmg_path_a";
    state.instances[5].quality = "legendary";

    const result = service.salvageMany(state, [free.instanceId, ...protectedIds]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.value.salvagedIds, [free.instanceId]);
    assert.equal(result.value.state.instances.some((item) => item.instanceId === free.instanceId), false);
});
