import assert from "node:assert/strict";
import test from "node:test";

import { EQUIPMENT_CATALOG, validateEquipmentCatalog } from "../../../assets/script/game/equipment/config/EquipmentCatalog.ts";
import { createStarterEquipmentState } from "../../../assets/script/game/equipment/config/StarterEquipment.ts";

test("catalog ships all nine distinct weapon classes and valid references", () => {
    assert.deepEqual(
        EQUIPMENT_CATALOG.templates
            .filter((item) => item.slot === "weapon")
            .map((item) => item.weaponClass)
            .sort(),
        ["arc", "assault", "bio", "flame", "grenade", "lmg", "shotgun", "smg", "sniper"],
    );
    assert.deepEqual(validateEquipmentCatalog(EQUIPMENT_CATALOG), []);
});

test("starter state has unique instances, three loadouts, and all eight slots", () => {
    const state = createStarterEquipmentState();
    assert.equal(new Set(state.instances.map((item) => item.instanceId)).size, state.instances.length);
    assert.equal(state.loadouts.length, 3);
    assert.deepEqual(Object.keys(state.loadouts[0].slots).sort(), [
        "armor", "boots", "gloves", "helmet", "organ", "primary1", "primary2", "tactical",
    ]);
    assert.equal(state.materials.scrap > 0, true);
});

test("catalog validation rejects duplicate ids and non-positive weapon values", () => {
    const broken = {
        ...EQUIPMENT_CATALOG,
        templates: [
            ...EQUIPMENT_CATALOG.templates,
            {
                ...EQUIPMENT_CATALOG.templates[0],
                weapon: { ...EQUIPMENT_CATALOG.templates[0].weapon, damage: 0 },
            },
        ],
    };
    const errors = validateEquipmentCatalog(broken);
    assert.ok(errors.includes(`duplicate template id: ${EQUIPMENT_CATALOG.templates[0].id}`));
    assert.ok(errors.includes(`invalid weapon damage: ${EQUIPMENT_CATALOG.templates[0].id}`));
});
