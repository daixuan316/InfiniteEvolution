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

test("the hospital footprint blocks the full building instead of inheriting the road band", () => {
    const map = createHospitalDistrictMap();

    for (const { x: offsetX, y: offsetY } of [{ x: 0, y: 0 }, { x: 14, y: 8 }, { x: 28, y: 16 }]) {
        for (let y = offsetY + 3; y <= offsetY + 6; y++) {
            for (let x = offsetX + 1; x <= offsetX + 6; x++) {
                assert.equal(map.isWalkable({ x, y }), false, `hospital cell ${x},${y} must be blocked`);
                assert.equal(map.isWorldWalkable(map.cellToWorld({ x, y })), false, `hospital world cell ${x},${y} must be blocked`);
            }
        }
    }

    assert.equal(map.isWalkable({ x: 7, y: 4 }), true, "the road beside the hospital must remain open");
});

test("hospital district places reachable loot and exploration points", () => {
    const map = createHospitalDistrictMap();
    const pathfinder = new GridPathfinder(map);

    assert.equal(map.loot.length, 4);
    assert.equal(map.explorationPoints.length, 3);
    assert.equal(new Set(map.loot.map((item) => item.id)).size, map.loot.length);
    assert.equal(new Set(map.explorationPoints.map((item) => item.id)).size, map.explorationPoints.length);

    for (const item of [...map.loot, ...map.explorationPoints]) {
        assert.equal(map.isWalkable(item.cell), true, `${item.id} must be walkable`);
        assert.ok(pathfinder.findPath(map.start, item.cell).length > 0, `${item.id} must be reachable`);
        assert.deepEqual(map.worldToCell(map.cellToWorld(item.cell)), item.cell);
    }
});

test("breakable barrier owns dynamic blocked cells and opens them once destroyed", () => {
    const map = createHospitalDistrictMap();
    const barrier = map.barriers[0];

    assert.ok(barrier.blockedCells.length >= 4);
    for (const cell of barrier.blockedCells) assert.equal(map.isWalkable(cell), false);
    assert.equal(map.setBarrierBlocking("missing", false), false);
    assert.equal(map.setBarrierBlocking(barrier.id, false), true);
    for (const cell of barrier.blockedCells) assert.equal(map.isWalkable(cell), true);
});
