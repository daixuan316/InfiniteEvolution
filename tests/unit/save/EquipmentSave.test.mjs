import assert from "node:assert/strict";
import test from "node:test";

import { EQUIPMENT_CATALOG } from "../../../assets/script/game/equipment/config/EquipmentCatalog.ts";
import { createStarterEquipmentState } from "../../../assets/script/game/equipment/config/StarterEquipment.ts";
import { SAVE_SCHEMA_VERSION, createNewCampaignSave, migrateCampaignSave } from "../../../assets/script/game/save/model/CampaignEquipmentSave.ts";
import { SaveRepository } from "../../../assets/script/game/save/SaveRepository.ts";

class MemoryStore {
    constructor(values = {}) { this.values = new Map(Object.entries(values)); }
    get(key) { return this.values.get(key) ?? null; }
    set(key, value) { this.values.set(key, value); }
    remove(key) { this.values.delete(key); }
}

test("migration preserves valid equipment and repairs dangling loadout ids", () => {
    const equipment = createStarterEquipmentState();
    equipment.instances = equipment.instances.filter((item) => item.instanceId !== equipment.loadouts[0].slots.helmet);
    const migrated = migrateCampaignSave({ schemaVersion: 0, revision: 4, equipment }, EQUIPMENT_CATALOG);

    assert.equal(migrated.save.schemaVersion, SAVE_SCHEMA_VERSION);
    assert.equal(migrated.save.revision, 4);
    assert.equal(migrated.save.equipment.loadouts[0].slots.helmet, null);
    assert.ok(migrated.diagnostics.some((message) => message.includes("dangling")));
});

test("repository keeps previous and falls back when current is corrupt", () => {
    const valid = createNewCampaignSave();
    const store = new MemoryStore({
        "campaign:current": "{",
        "campaign:previous": JSON.stringify(valid),
    });
    const repository = new SaveRepository(store, "campaign", EQUIPMENT_CATALOG);

    assert.equal(repository.load().source, "previous");
    repository.commit({ ...valid, revision: 8 });
    assert.equal(JSON.parse(store.get("campaign:current")).revision, 9);
    assert.notEqual(store.get("campaign:previous"), null);
});
