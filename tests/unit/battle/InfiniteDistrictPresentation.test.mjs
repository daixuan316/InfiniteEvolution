import assert from "node:assert/strict";
import test from "node:test";

import { districtPresentation } from "../../../assets/script/game/battle/InfiniteDistrictPresentation.ts";

test("every procedural district has a distinct readable label and accent", () => {
    const presentations = ["residential", "community", "industrial", "open-space"]
        .map((district) => districtPresentation(district, false));
    assert.deepEqual(presentations.map((entry) => entry.label), ["住宅区", "社区商业区", "工业区", "荒废空地"]);
    assert.equal(new Set(presentations.map((entry) => entry.accent.join(":"))).size, presentations.length);
    assert.equal(presentations.every((entry) => entry.tint[3] > 0 && entry.tint[3] < 80), true);
});

test("hospital landmark overrides its underlying district presentation", () => {
    const hospital = districtPresentation("residential", true);
    assert.equal(hospital.label, "战地医院");
    assert.deepEqual(hospital.accent, [238, 86, 92, 255]);
});
