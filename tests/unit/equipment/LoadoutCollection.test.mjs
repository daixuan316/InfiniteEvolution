import assert from "node:assert/strict";
import test from "node:test";

import { EQUIPMENT_CATALOG } from "../../../assets/script/game/equipment/config/EquipmentCatalog.ts";
import { createStarterEquipmentState } from "../../../assets/script/game/equipment/config/StarterEquipment.ts";
import { LoadoutCollection } from "../../../assets/script/game/equipment/model/LoadoutCollection.ts";

test("loadouts enforce slots, allow cross-loadout reuse, and swap primaries", () => {
    const state = createStarterEquipmentState();
    const loadouts = new LoadoutCollection(state.loadouts, EQUIPMENT_CATALOG);
    const assault = state.instances.find((item) => item.templateId === "weapon_assault");
    const smg = state.instances.find((item) => item.templateId === "weapon_smg");

    assert.equal(loadouts.equip("loadout-1", "primary1", assault).ok, true);
    assert.equal(loadouts.equip("loadout-2", "primary1", assault).ok, true);
    assert.deepEqual(loadouts.equip("loadout-1", "helmet", assault), { ok: false, error: "slot-mismatch" });
    assert.equal(loadouts.equip("loadout-1", "primary2", smg).ok, true);
    assert.equal(loadouts.swapPrimary("loadout-1").ok, true);
    assert.equal(loadouts.get("loadout-1").slots.primary1, smg.instanceId);
});

test("one instance cannot occupy two slots in one loadout and names are normalized", () => {
    const state = createStarterEquipmentState();
    const loadouts = new LoadoutCollection(state.loadouts, EQUIPMENT_CATALOG);
    const assault = state.instances.find((item) => item.templateId === "weapon_assault");

    assert.deepEqual(loadouts.equip("loadout-1", "primary2", assault), { ok: false, error: "duplicate-slot" });
    assert.equal(loadouts.rename("loadout-1", "  超长测试方案名称ABCDEFGHIJ  ").ok, true);
    assert.equal([...loadouts.get("loadout-1").name].length, 12);
    assert.deepEqual(loadouts.select("missing"), { ok: false, error: "missing-loadout" });
});
