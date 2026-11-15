import assert from "node:assert/strict";
import test from "node:test";

import { EQUIPMENT_CATALOG } from "../../../assets/script/game/equipment/config/EquipmentCatalog.ts";
import { createStarterEquipmentState } from "../../../assets/script/game/equipment/config/StarterEquipment.ts";
import { EquipmentRuntime } from "../../../assets/script/game/equipment/EquipmentRuntime.ts";

class RecordingRepository {
    constructor(fail = false) { this.fail = fail; this.commits = []; }
    commit(save) {
        if (this.fail) throw new Error("storage unavailable");
        this.commits.push(structuredClone(save));
        return { ...save, revision: save.revision + 1 };
    }
}

test("runtime commits an equip command and emits one new snapshot", () => {
    const repository = new RecordingRepository();
    const runtime = new EquipmentRuntime(EQUIPMENT_CATALOG, createStarterEquipmentState(), repository);
    const helmet = runtime.snapshot().instances.find((item) => item.templateId === "helmet_scout");
    let emissions = 0;
    runtime.subscribe(() => emissions++);

    assert.equal(runtime.equip("loadout-2", "helmet", helmet.instanceId).ok, true);
    assert.equal(repository.commits.length, 1);
    assert.equal(emissions, 1);
});

test("runtime rolls state back when persistence fails", () => {
    const runtime = new EquipmentRuntime(EQUIPMENT_CATALOG, createStarterEquipmentState(), new RecordingRepository(true));
    const before = runtime.snapshot();
    const smg = before.instances.find((item) => item.templateId === "weapon_smg");

    assert.deepEqual(runtime.equip("loadout-1", "primary1", smg.instanceId), { ok: false, error: "save-failed" });
    assert.deepEqual(runtime.snapshot(), before);
});

test("battle memory is idempotent and unlocks evolution progress", () => {
    const runtime = new EquipmentRuntime(EQUIPMENT_CATALOG, createStarterEquipmentState(), new RecordingRepository());
    const assault = runtime.snapshot().instances.find((item) => item.templateId === "weapon_assault");
    const deltas = [{ instanceId: assault.instanceId, kind: "weakpointHit", amount: 25 }];

    assert.equal(runtime.recordBattleMemory("battle-1", deltas).ok, true);
    assert.equal(runtime.recordBattleMemory("battle-1", deltas).ok, true);
    assert.equal(runtime.snapshot().instances.find((item) => item.instanceId === assault.instanceId).memory.weakpointHit, 25);
});

test("evolution reset spends samples atomically and keeps earned memory", () => {
    const state = createStarterEquipmentState();
    const weapon = state.instances.find((item) => item.templateId === "weapon_assault");
    weapon.evolutionId = "assault_path_a";
    weapon.memory.closeHit = 20;
    const runtime = new EquipmentRuntime(EQUIPMENT_CATALOG, state, new RecordingRepository());

    assert.equal(runtime.resetEvolution(weapon.instanceId).ok, true);
    const next = runtime.snapshot();
    const reset = next.instances.find((item) => item.instanceId === weapon.instanceId);
    assert.equal(next.materials.evolutionSample, state.materials.evolutionSample - 1);
    assert.equal(reset.evolutionId, null);
    assert.equal(reset.evolutionResetCount, 1);
    assert.equal(reset.memory.closeHit, 20);
});

test("runtime continues the loaded save revision", () => {
    const repository = new RecordingRepository();
    const state = createStarterEquipmentState();
    const runtime = new EquipmentRuntime(EQUIPMENT_CATALOG, state, repository, 7);
    const itemId = state.instances[0].instanceId;

    assert.equal(runtime.toggleFavorite(itemId).ok, true);
    assert.equal(runtime.toggleFavorite(itemId).ok, true);
    assert.deepEqual(repository.commits.map((save) => save.revision), [7, 8]);
});
