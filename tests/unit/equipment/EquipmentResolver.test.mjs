import assert from "node:assert/strict";
import test from "node:test";

import { EQUIPMENT_CATALOG } from "../../../assets/script/game/equipment/config/EquipmentCatalog.ts";
import { createStarterEquipmentState } from "../../../assets/script/game/equipment/config/StarterEquipment.ts";
import { resolveRoleCombatSnapshot } from "../../../assets/script/game/equipment/model/EquipmentResolver.ts";

test("resolver applies equipped armor and a three-piece resonance exactly once", () => {
    const state = createStarterEquipmentState();
    for (const item of state.instances) item.affixIds = [];
    const helmet = state.instances.find((item) => item.templateId === "helmet_scout");
    helmet.tags.push("thunder", "thunder");

    const snapshot = resolveRoleCombatSnapshot(state, EQUIPMENT_CATALOG);
    assert.equal(snapshot.maxHealth, 510);
    assert.equal(snapshot.maxShield, 205);
    assert.equal(snapshot.defense, 38);
    assert.equal(snapshot.moveSpeed, 325);
    assert.equal(snapshot.resonances.find((item) => item.tag === "thunder").count, 3);
    assert.equal(snapshot.resonances.find((item) => item.tag === "thunder").tier, 3);
    assert.equal(snapshot.weapons[1].chainTargets, 4);
});

test("same-pool damage bonuses add before they modify the weapon", () => {
    const state = createStarterEquipmentState();
    for (const item of state.instances) item.affixIds = [];
    const assault = state.instances.find((item) => item.templateId === "weapon_assault");
    assault.affixIds = ["affix_damage_08", "affix_ark_damage_06"];

    const snapshot = resolveRoleCombatSnapshot(state, EQUIPMENT_CATALOG);
    assert.equal(snapshot.weapons[0].additiveDamageBonus, 0.14);
    assert.equal(snapshot.weapons[0].damage, 39.9);
});
