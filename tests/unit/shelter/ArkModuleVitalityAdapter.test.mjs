import assert from "node:assert/strict";
import test from "node:test";

import {
    damageArkModule,
    repairArkModule,
} from "../../../assets/script/game/shelter/model/ArkModuleVitalityAdapter.ts";

test("Ark module stops at zero without permanent destruction", () => {
    const result = damageArkModule({
        id: "turret-1",
        durability: 10,
        maxDurability: 100,
        operational: true,
        destroyed: false,
    }, 25);

    assert.deepEqual(result, {
        id: "turret-1",
        durability: 0,
        maxDurability: 100,
        operational: false,
        destroyed: false,
    });
});

test("repair reactivates a disabled Ark module", () => {
    const result = repairArkModule({
        id: "turret-1",
        durability: 0,
        maxDurability: 100,
        operational: false,
        destroyed: false,
    }, 30);

    assert.equal(result.durability, 30);
    assert.equal(result.operational, true);
    assert.equal(result.destroyed, false);
});

test("invalid amounts preserve durability and repair clamps to the maximum", () => {
    const base = {
        id: "core",
        durability: 25,
        maxDurability: 100,
        operational: true,
        destroyed: false,
    };

    assert.deepEqual(damageArkModule(base, Number.NaN), base);
    assert.equal(repairArkModule(base, 1000).durability, 100);
});

test("adapter always clears permanent destruction", () => {
    const repaired = repairArkModule({
        id: "core",
        durability: 0,
        maxDurability: 100,
        operational: false,
        destroyed: true,
    }, 10);

    assert.equal(repaired.destroyed, false);
    assert.equal(repaired.operational, true);
});

test("adapter preserves additional serializable module fields", () => {
    const result = damageArkModule({
        id: "generator-2",
        level: 3,
        durability: 50,
        maxDurability: 100,
        operational: true,
        destroyed: false,
    }, 10);

    assert.equal(result.id, "generator-2");
    assert.equal(result.level, 3);
    assert.equal(result.durability, 40);
});
