import assert from "node:assert/strict";
import test from "node:test";

import { createHospitalDistrictMap } from "../../../assets/script/game/battle/BattleMapModel.ts";
import { BattleSimulation } from "../../../assets/script/game/battle/BattleSimulation.ts";
import { EQUIPMENT_CATALOG } from "../../../assets/script/game/equipment/config/EquipmentCatalog.ts";
import { createStarterEquipmentState } from "../../../assets/script/game/equipment/config/StarterEquipment.ts";
import { resolveRoleCombatSnapshot } from "../../../assets/script/game/equipment/model/EquipmentResolver.ts";

function snapshotWith(primaryTemplate, secondaryTemplate = "weapon_assault") {
    const state = createStarterEquipmentState();
    const loadout = state.loadouts[0];
    loadout.slots.primary1 = state.instances.find((item) => item.templateId === primaryTemplate).instanceId;
    loadout.slots.primary2 = state.instances.find((item) => item.templateId === secondaryTemplate).instanceId;
    return resolveRoleCombatSnapshot(state, EQUIPMENT_CATALOG);
}

function advance(simulation, seconds) {
    for (let elapsed = 0; elapsed < seconds; elapsed += 1 / 60) simulation.update(1 / 60);
}

test("battle actor and weapon status use the supplied equipment snapshot", () => {
    const snapshot = snapshotWith("weapon_sniper", "weapon_smg");
    const simulation = new BattleSimulation(createHospitalDistrictMap(), { equipmentSnapshot: snapshot, random: { next: () => 0.99 } });

    assert.equal(simulation.player.vitality.maxHealth, snapshot.maxHealth);
    assert.equal(simulation.player.vitality.maxShield, snapshot.maxShield);
    assert.equal(simulation.player.defense, snapshot.defense);
    assert.equal(simulation.player.speed, snapshot.moveSpeed);
    assert.equal(simulation.weaponStatus.name, snapshot.weapons[0].name);
    assert.equal(simulation.switchWeapon().name, snapshot.weapons[1].name);
});

test("grenade splash damages nearby enemies through the shared damage resolver", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap(), { equipmentSnapshot: snapshotWith("weapon_grenade"), random: { next: () => 0.99 } });
    const [first, second] = simulation.enemies;
    first.x = simulation.player.x + 140;
    first.y = simulation.player.y;
    second.x = first.x + 35;
    second.y = first.y;
    const before = second.vitality.currentHealth;

    advance(simulation, 0.3);
    assert.ok(second.vitality.currentHealth < before);
});

test("arc shots chain and battle memory can be drained only once", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap(), { equipmentSnapshot: snapshotWith("weapon_arc"), random: { next: () => 0 } });
    const [first, second] = simulation.enemies;
    first.x = simulation.player.x + 120;
    first.y = simulation.player.y;
    second.x = first.x + 45;
    second.y = first.y;
    const before = second.vitality.currentHealth;

    advance(simulation, 0.5);
    assert.ok(second.vitality.currentHealth < before);
    assert.ok(simulation.drainEquipmentMemoryDeltas().some((item) => item.kind === "statusProc"));
    assert.deepEqual(simulation.drainEquipmentMemoryDeltas(), []);
});

test("bio weapon raises pollution and records high-pollution use", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap(), { equipmentSnapshot: snapshotWith("weapon_bio"), random: { next: () => 0 } });
    simulation.playerPollution = 59;
    simulation.enemies[0].x = simulation.player.x + 120;
    simulation.enemies[0].y = simulation.player.y;

    advance(simulation, 0.5);

    assert.ok(simulation.playerPollution > 59);
    assert.ok(simulation.drainEquipmentMemoryDeltas().some((item) => item.kind === "highPollutionUse"));
});
