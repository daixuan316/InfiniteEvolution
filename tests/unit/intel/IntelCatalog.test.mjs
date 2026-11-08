import assert from "node:assert/strict";
import test from "node:test";

import { createHospitalDistrictMap } from "../../../assets/script/game/battle/BattleMapModel.ts";
import {
    INTEL_EVENTS,
    INTEL_TARGETS,
    findIntelTarget,
    intelTargetDistanceMeters,
    intelTargetWorldPoint,
    isIntelTargetReached,
} from "../../../assets/script/game/intel/model/IntelCatalog.ts";

test("intel targets map one-to-one to playable hospital district POIs", () => {
    const map = createHospitalDistrictMap();

    assert.deepEqual(INTEL_TARGETS.map((target) => target.id), ["hospital", "depot", "signal"]);
    assert.equal(new Set(INTEL_TARGETS.map((target) => target.id)).size, INTEL_TARGETS.length);

    for (const target of INTEL_TARGETS) {
        const point = map.pointsOfInterest.find((candidate) => candidate.id === target.id);
        assert.ok(point, `${target.id} must exist on the battle map`);
        assert.deepEqual(target.cell, point.cell);
        assert.equal(map.isWalkable(target.cell), true);
        assert.ok(target.rewardLabels.length > 0);
        assert.ok(target.estimatedMinutes > 0);
    }
});

test("target distance and arrival use the same map world point", () => {
    const map = createHospitalDistrictMap();
    const target = findIntelTarget("depot");
    assert.ok(target);

    const point = intelTargetWorldPoint(target, map);
    assert.ok(intelTargetDistanceMeters(target, map) > 0);
    assert.equal(isIntelTargetReached(target, point, map), true);
    assert.equal(isIntelTargetReached(target, { x: point.x + 181, y: point.y }, map), false);
});

test("hidden cache event never exposes a map cell", () => {
    const hidden = INTEL_EVENTS.find((event) => event.id === "hidden-cache");

    assert.ok(hidden);
    assert.equal("cell" in hidden, false);
    assert.equal(hidden.status, "undetected");
});
