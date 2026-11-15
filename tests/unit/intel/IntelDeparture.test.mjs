import assert from "node:assert/strict";
import test from "node:test";

import { decideIntelDeparture } from "../../../assets/script/game/intel/model/IntelDeparture.ts";
import { findIntelTarget } from "../../../assets/script/game/intel/model/IntelCatalog.ts";

test("departure redirects to Intel when no target is selected", () => {
    assert.deepEqual(decideIntelDeparture(null), { destination: "intel" });
});

test("departure carries the selected target into battle", () => {
    const target = findIntelTarget("signal");
    assert.ok(target);

    assert.deepEqual(decideIntelDeparture(target), { destination: "battle", targetId: "signal" });
});
