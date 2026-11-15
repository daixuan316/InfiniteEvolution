import assert from "node:assert/strict";
import test from "node:test";

import { formatCountdown } from "../../../assets/script/game/research/model/ResearchPresentation.ts";

test("research countdown rounds up and clamps invalid or elapsed time", () => {
    assert.equal(formatCountdown(60_001), "01:01");
    assert.equal(formatCountdown(60_000), "01:00");
    assert.equal(formatCountdown(1), "00:01");
    assert.equal(formatCountdown(0), "00:00");
    assert.equal(formatCountdown(-1_000), "00:00");
    assert.equal(formatCountdown(Number.NaN), "00:00");
});
