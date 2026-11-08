import assert from "node:assert/strict";
import test from "node:test";

import {
    ARK_MODULES,
    ARK_SLOTS,
    createDefaultArkState,
} from "../../../assets/script/game/shelter/model/ArkCatalog.ts";

test("default Ark owns ten modules and exposes seven fixed slots", () => {
    const state = createDefaultArkState();

    assert.equal(ARK_MODULES.length, 10);
    assert.equal(ARK_SLOTS.length, 7);
    assert.equal(new Set(state.modules.map((item) => item.instanceId)).size, 10);
    assert.deepEqual(Object.keys(state.layouts), ["alpha", "beta", "gamma"]);
    assert.equal(state.layouts.alpha.slots.internal, "generator-1");
    assert.equal(state.layouts.alpha.slots["top-left"], "turret-mg-1");
});
