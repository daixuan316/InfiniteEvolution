import assert from "node:assert/strict";
import test from "node:test";

import { DayPhaseFlow } from "../../../assets/script/game/world/model/DayPhaseFlow.ts";

test("day phase flow requests one shelter return when night begins", () => {
    const flow = new DayPhaseFlow();

    assert.equal(flow.update("safe"), "continue");
    assert.equal(flow.update("warning"), "continue");
    assert.equal(flow.update("night"), "return-to-shelter");
    assert.equal(flow.update("night"), "continue");
    assert.equal(flow.update("hunt"), "continue");
});

test("day phase flow still returns when a large time step skips directly to hunt", () => {
    const flow = new DayPhaseFlow();

    assert.equal(flow.update("hunt"), "return-to-shelter");
});
