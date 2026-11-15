import assert from "node:assert/strict";
import test from "node:test";

import { createHospitalDistrictMap } from "../../../assets/script/game/battle/BattleMapModel.ts";
import { findIntelTarget } from "../../../assets/script/game/intel/model/IntelCatalog.ts";
import { IntelTargetTracker } from "../../../assets/script/game/intel/model/IntelTargetTracker.ts";

test("tracker reports arrival exactly once while retaining reached state", () => {
    const map = createHospitalDistrictMap();
    const target = findIntelTarget("hospital");
    assert.ok(target);
    const tracker = new IntelTargetTracker(target, map);
    const destination = map.cellToWorld(target.cell);

    const approaching = tracker.update({ x: destination.x + 181, y: destination.y });
    assert.equal(approaching.reached, false);
    assert.equal(approaching.becameReached, false);

    const arrival = tracker.update(destination);
    assert.equal(arrival.reached, true);
    assert.equal(arrival.becameReached, true);
    assert.equal(arrival.distanceMeters, 0);

    const repeated = tracker.update(destination);
    assert.equal(repeated.reached, true);
    assert.equal(repeated.becameReached, false);
});
