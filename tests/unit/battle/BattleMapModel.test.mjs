import assert from "node:assert/strict";
import test from "node:test";

import { createHospitalDistrictMap } from "../../../assets/script/game/battle/BattleMapModel.ts";
import { GridPathfinder } from "../../../assets/script/game/battle/GridPathfinder.ts";

test("hospital district exposes a large, connected playable map", () => {
    const map = createHospitalDistrictMap();
    const pathfinder = new GridPathfinder(map);

    assert.ok(map.worldWidth >= 3_800);
    assert.ok(map.worldHeight >= 2_000);
    assert.equal(map.isWalkable(map.start), true);
    assert.equal(map.isWalkable(map.extraction), true);

    for (const point of map.pointsOfInterest) {
        assert.equal(map.isWalkable(point.cell), true, `${point.id} must be walkable`);
        assert.ok(pathfinder.findPath(map.start, point.cell).length > 0, `${point.id} must be reachable`);
    }
    assert.ok(pathfinder.findPath(map.start, map.extraction).length > 10);
});

test("world and grid coordinate conversion round-trips every important point", () => {
    const map = createHospitalDistrictMap();
    const cells = [map.start, map.extraction, ...map.enemySpawns, ...map.pointsOfInterest.map((point) => point.cell)];

    for (const cell of cells) {
        assert.deepEqual(map.worldToCell(map.cellToWorld(cell)), cell);
    }
});
