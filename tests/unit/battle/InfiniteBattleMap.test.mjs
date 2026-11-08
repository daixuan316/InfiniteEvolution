import assert from "node:assert/strict";
import test from "node:test";

import { createInfiniteExplorationMap } from "../../../assets/script/game/battle/InfiniteBattleMap.ts";
import { GridPathfinder } from "../../../assets/script/game/battle/GridPathfinder.ts";

test("infinite map converts negative and distant cells without clamping", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    for (const cell of [{ x: -200, y: 17 }, { x: 900, y: -500 }, { x: 0, y: 0 }]) {
        assert.deepEqual(map.worldToCell(map.cellToWorld(cell)), cell);
    }
});

test("infinite map refreshes a 3x3 active chunk window", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    assert.equal(map.infinite, true);
    assert.equal(map.activeChunks.length, 9);
    const revision = map.revision;
    assert.equal(map.refreshAround({ x: 1344 + 10, y: 20 }), true);
    assert.ok(map.revision > revision);
    assert.equal(map.activeChunks.length, 9);
    assert.equal(map.refreshAround({ x: 1344 + 20, y: 30 }), false);
});

test("pathfinder reaches a nearby goal across a chunk boundary", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    const start = { x: 12, y: 3 };
    const goal = { x: 16, y: 3 };
    const path = new GridPathfinder(map).findPath(start, goal);
    assert.deepEqual(path[0], start);
    assert.deepEqual(path.at(-1), goal);
});

test("infinite world collision works at signed chunk coordinates", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    assert.equal(map.isWalkable({ x: -14, y: 3 }), true);
    assert.equal(map.isWalkable({ x: -10, y: 1 }), false);
    assert.equal(map.isWorldWalkable(map.cellToWorld({ x: -14, y: 3 })), true);
});
