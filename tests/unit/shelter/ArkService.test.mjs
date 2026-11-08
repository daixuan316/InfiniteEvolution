import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultArkState } from "../../../assets/script/game/shelter/model/ArkCatalog.ts";
import { ArkService } from "../../../assets/script/game/shelter/model/ArkService.ts";

test("failed install is atomic", () => {
    const service = new ArkService(createDefaultArkState());
    const before = service.snapshot();
    assert.equal(service.install("alpha", "top-left", "generator-1").ok, false);
    assert.deepEqual(service.snapshot(), before);
});

test("first install charges once and reinstall does not charge again", () => {
    const state = createDefaultArkState();
    const module = state.modules.find((item) => item.instanceId === "turret-shotgun-1");
    module.commissioned = false;
    const service = new ArkService(state);
    const before = service.snapshot().resources.scrap;

    assert.equal(service.install("alpha", "top-right", module.instanceId).ok, true);
    const afterFirst = service.snapshot().resources.scrap;
    assert.ok(afterFirst < before);
    assert.equal(service.remove("alpha", "top-right").ok, true);
    assert.equal(service.install("alpha", "top-right", module.instanceId).ok, true);
    assert.equal(service.snapshot().resources.scrap, afterFirst);
});

test("repair queue restores a disabled module and charges resources", () => {
    const state = createDefaultArkState();
    state.modules.find((item) => item.instanceId === "turret-mg-1").durability = 0;
    const service = new ArkService(state);
    const before = service.snapshot().resources.scrap;

    assert.equal(service.enqueueRepair("turret-mg-1").ok, true);
    assert.equal(service.processRepair(100).ok, true);
    assert.ok(service.snapshot().modules.find((item) => item.instanceId === "turret-mg-1").durability > 0);
    assert.ok(service.snapshot().resources.scrap < before);
});

test("layouts, priority, evolution and settlement mutate through commands", () => {
    const service = new ArkService(createDefaultArkState());
    assert.equal(service.setPriority("turret-mg-1", "core").ok, true);
    assert.equal(service.applyEvolution("turret-mg-1", "hunter-gland").ok, true);
    assert.equal(service.snapshot().resources.mutationCore, 1);
    assert.equal(service.removeEvolution("turret-mg-1").ok, true);
    assert.equal(service.snapshot().resources.mutationCore, 1.5);
    assert.equal(service.switchLayout("beta").ok, true);
    assert.equal(service.snapshot().activeLayoutId, "beta");

    const settlement = { battleId: "night-1", moduleDurability: [{ instanceId: "armor-1", durability: 12 }], resourceDeltas: { scrap: 5 }, coreDurability: 800 };
    assert.equal(service.applyBattleSettlement(settlement).ok, true);
    assert.equal(service.applyBattleSettlement(settlement).ok, false);
    assert.equal(service.snapshot().resources.scrap, 373);
    assert.equal(service.snapshot().coreDurability, 800);
});

