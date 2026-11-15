import assert from "node:assert/strict";
import test from "node:test";

import { EQUIPMENT_CATALOG } from "../../../assets/script/game/equipment/config/EquipmentCatalog.ts";
import { createStarterEquipmentState } from "../../../assets/script/game/equipment/config/StarterEquipment.ts";
import { resolveRoleCombatSnapshot } from "../../../assets/script/game/equipment/model/EquipmentResolver.ts";
import { DualWeaponRuntime } from "../../../assets/script/game/equipment/model/WeaponRuntime.ts";

function weaponSnapshot(templateId) {
    const state = createStarterEquipmentState();
    const instance = state.instances.find((item) => item.templateId === templateId);
    for (const slot of Object.keys(state.loadouts[0].slots)) state.loadouts[0].slots[slot] = null;
    state.loadouts[0].slots.primary1 = instance.instanceId;
    state.loadouts[0].slots.primary2 = instance.instanceId;
    return resolveRoleCombatSnapshot(state, EQUIPMENT_CATALOG).weapons[0];
}

test("weapons preserve independent magazines and cool while inactive", () => {
    const flame = weaponSnapshot("weapon_flame");
    const assault = weaponSnapshot("weapon_assault");
    const runtime = new DualWeaponRuntime([flame, assault], { next: () => 0.9 });

    runtime.tryFire({ distance: 100, moving: false });
    const heat = runtime.status.heat;
    runtime.swap();
    runtime.update(1);
    runtime.swap();
    assert.ok(runtime.status.heat < heat);
    assert.equal(runtime.status.magazine, flame.magazine - 1);
});

test("empty magazines reload with infinite reserve ammunition", () => {
    const weapon = { ...weaponSnapshot("weapon_sniper"), magazine: 1, reload: 0.5, interval: 0.1 };
    const runtime = new DualWeaponRuntime([weapon, weapon], { next: () => 0.9 });

    assert.equal(runtime.tryFire({ distance: 200, moving: false }).ok, true);
    runtime.update(0.1);
    assert.equal(runtime.tryFire({ distance: 200, moving: false }).error, "reloading");
    runtime.update(0.5);
    assert.equal(runtime.status.magazine, 1);
    assert.equal(runtime.tryFire({ distance: 200, moving: false }).ok, true);
});

test("all nine classes emit their distinct shot mechanics", () => {
    const expected = {
        weapon_assault: { projectileCount: 1 },
        weapon_smg: { mobileDamageBonus: 0.15 },
        weapon_shotgun: { projectileCount: 6 },
        weapon_sniper: { penetration: 2 },
        weapon_lmg: { suppression: 1 },
        weapon_grenade: { splashRadius: 115 },
        weapon_flame: { status: "burn" },
        weapon_arc: { chainTargets: 2 },
        weapon_bio: { status: "infection", pollutionCost: 1.5 },
    };
    for (const [templateId, partial] of Object.entries(expected)) {
        const weapon = weaponSnapshot(templateId);
        const runtime = new DualWeaponRuntime([weapon, weapon], { next: () => 0 });
        const result = runtime.tryFire({ distance: Math.max(100, weapon.minimumRange ?? 0), moving: true });
        assert.equal(result.ok, true, templateId);
        for (const [key, value] of Object.entries(partial)) assert.equal(result.value[key], value, `${templateId}:${key}`);
    }
});
