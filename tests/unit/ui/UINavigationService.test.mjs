import assert from "node:assert/strict";
import test from "node:test";

import { UINavigationService } from "../../../assets/script/game/common/ui/UINavigationService.ts";

class FakeGateway {
    calls = [];
    failNextOpen = false;

    async open(route, params) {
        this.calls.push(["open", route, params]);
        if (this.failNextOpen) {
            this.failNextOpen = false;
            throw new Error("missing prefab");
        }
    }

    remove(route) {
        this.calls.push(["remove", route]);
    }

    toast(message) {
        this.calls.push(["toast", message]);
    }
}

test("push opens the destination before removing the current page", async () => {
    const gateway = new FakeGateway();
    const service = new UINavigationService(gateway, "Hall");
    await service.enterRoot("Hall");
    gateway.calls.length = 0;

    assert.equal(await service.push("Equipment", { source: "hall" }), true);
    assert.deepEqual(gateway.calls, [
        ["open", "Equipment", { source: "hall" }],
        ["remove", "Hall"],
    ]);
    assert.equal(service.currentRoute, "Equipment");
});

test("a failed push preserves the original page and unlocks navigation", async () => {
    const gateway = new FakeGateway();
    const service = new UINavigationService(gateway, "Hall");
    await service.enterRoot("Hall");
    gateway.calls.length = 0;
    gateway.failNextOpen = true;

    const originalError = console.error;
    console.error = () => { };
    try {
        assert.equal(await service.push("Equipment"), false);
    } finally {
        console.error = originalError;
    }
    assert.equal(service.currentRoute, "Hall");
    assert.deepEqual(gateway.calls.map((call) => call[0]), ["open", "toast"]);
    assert.equal(await service.push("Workshop"), true);
});

test("duplicate pushes are ignored", async () => {
    const gateway = new FakeGateway();
    const service = new UINavigationService(gateway, "Hall");
    await service.enterRoot("Hall");
    await service.push("Equipment");
    gateway.calls.length = 0;

    assert.equal(await service.push("Equipment"), false);
    assert.deepEqual(gateway.calls, []);
});

test("back closes an overlay before restoring a page", async () => {
    const gateway = new FakeGateway();
    const service = new UINavigationService(gateway, "Hall");
    await service.enterRoot("Hall");
    await service.push("Equipment");
    await service.openOverlay("Pause");
    gateway.calls.length = 0;

    assert.equal(await service.back(), true);
    assert.deepEqual(gateway.calls, [["remove", "Pause"]]);
    assert.equal(service.currentRoute, "Equipment");

    gateway.calls.length = 0;
    assert.equal(await service.back(), true);
    assert.deepEqual(gateway.calls, [
        ["open", "Hall", {}],
        ["remove", "Equipment"],
    ]);
    assert.equal(service.currentRoute, "Hall");
});

test("replace clears pages and overlays only after the destination opens", async () => {
    const gateway = new FakeGateway();
    const service = new UINavigationService(gateway, "Hall");
    await service.enterRoot("Hall");
    await service.openOverlay("Pause");
    gateway.calls.length = 0;

    assert.equal(await service.replace("BattleHUD"), true);
    assert.deepEqual(gateway.calls, [
        ["open", "BattleHUD", {}],
        ["remove", "Pause"],
        ["remove", "Hall"],
    ]);
    assert.equal(service.currentRoute, "BattleHUD");
});
