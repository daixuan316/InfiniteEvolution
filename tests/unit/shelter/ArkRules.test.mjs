import assert from "node:assert/strict";
import test from "node:test";

import {
    ARK_MODULES,
    ARK_SLOTS,
    createDefaultArkState,
} from "../../../assets/script/game/shelter/model/ArkCatalog.ts";
import {
    buildArkBattleSnapshot,
    classifyNoise,
    deriveArkState,
    validatePlacement,
} from "../../../assets/script/game/shelter/model/ArkRules.ts";

test("default Ark owns ten modules and exposes seven fixed slots", () => {
    const state = createDefaultArkState();

    assert.equal(ARK_MODULES.length, 10);
    assert.equal(ARK_SLOTS.length, 7);
    assert.equal(new Set(state.modules.map((item) => item.instanceId)).size, 10);
    assert.deepEqual(Object.keys(state.layouts), ["alpha", "beta", "gamma"]);
    assert.equal(state.layouts.alpha.slots.internal, "generator-1");
    assert.equal(state.layouts.alpha.slots["top-left"], "turret-mg-1");
});

test("placement rejects incompatible slots and duplicate installed instances", () => {
    const state = createDefaultArkState();
    assert.deepEqual(validatePlacement(state, "alpha", "top-right", "generator-1"), {
        ok: false,
        error: "slot_rejects_module",
    });
    assert.deepEqual(validatePlacement(state, "alpha", "top-right", "turret-mg-1"), {
        ok: false,
        error: "instance_already_installed",
    });
});

test("power allocation is deterministic and keeps higher priority online", () => {
    const state = createDefaultArkState();
    state.layouts.alpha.slots["top-right"] = "turret-shotgun-1";
    state.layouts.alpha.slots.side = "radar-1";
    state.modules.find((item) => item.instanceId === "turret-shotgun-1").priority = "normal";
    state.modules.find((item) => item.instanceId === "radar-1").priority = "core";

    const derived = deriveArkState(state);
    assert.deepEqual(derived.poweredInstanceIds, ["generator-1", "radar-1", "armor-1", "turret-mg-1", "turret-shotgun-1"]);
    assert.equal(derived.powerCapacity, 18);
    assert.equal(derived.powerUsed, 16);
});

test("noise exposes all four tiers", () => {
    assert.equal(classifyNoise(0), "hidden");
    assert.equal(classifyNoise(25), "noticed");
    assert.equal(classifyNoise(60), "danger");
    assert.equal(classifyNoise(100), "bait");
});

test("generator and battery adjacency is visible and capped", () => {
    const state = createDefaultArkState();
    state.layouts.alpha.slots.side = "battery-1";
    const derived = deriveArkState(state);
    assert.ok(derived.adjacencies.some((entry) => entry.bonusId === "generator-battery"));
    assert.ok(derived.adjacencies.filter((entry) => entry.instanceId === "battery-1").length <= 2);
});

test("battle snapshot is immutable and excludes uninstalled modules", () => {
    const snapshot = buildArkBattleSnapshot(createDefaultArkState());
    assert.equal(Object.isFrozen(snapshot), true);
    assert.equal(Object.isFrozen(snapshot.modules), true);
    assert.deepEqual(snapshot.modules.map((item) => item.instanceId), ["armor-1", "turret-mg-1", "generator-1"]);
    assert.equal(snapshot.modules.every((item) => Object.isFrozen(item)), true);
});
