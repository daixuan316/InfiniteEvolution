import assert from "node:assert/strict";
import test from "node:test";

import { createInfiniteExplorationMap } from "../../../assets/script/game/battle/InfiniteBattleMap.ts";
import { GridPathfinder } from "../../../assets/script/game/battle/GridPathfinder.ts";
import { encounterProfileForChunk } from "../../../assets/script/game/world/infinite/InfiniteEncounterScaling.ts";
import { CHUNK_COLUMNS, CHUNK_ROWS } from "../../../assets/script/game/world/infinite/InfiniteWorldTypes.ts";

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

test("preload generation advances through a bounded per-frame budget", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    assert.equal(map.activeChunks.length, 9);
    assert.ok(map.preloadedChunks.length >= 9 && map.preloadedChunks.length < 25);
    map.advancePreload(6);
    map.advancePreload(6);
    assert.equal(map.preloadedChunks.length, 25);
});

test("active chunks and visible landmarks enter the persistent discovery index", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    assert.equal(map.deltas.discoveredChunkKeys().length, 9);
    map.refreshAround({ x: 100, y: 768 * 2 + 100 });
    assert.ok(map.deltas.discoveredChunkKeys().length > 9);
    assert.equal(map.deltas.isLandmarkDiscovered("hospital:0:2"), true);
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

test("visible hospital median cells block movement while the adjacent lane remains open", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    const hospitalY = 2 * CHUNK_ROWS;
    assert.equal(map.getChunkAt({ x: 0, y: 2 }).backgroundId, "hospital-district");
    assert.equal(map.isWalkable({ x: 2, y: hospitalY + 3 }), false);
    assert.equal(map.isWalkable({ x: 2, y: hospitalY + 4 }), true);
});

test("active chunks expose deterministic walkable enemy counts for their Ark distance", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    const center = map.cellToWorld({ x: 8 * CHUNK_COLUMNS + 7, y: 3 });
    map.refreshAround(center);
    const firstSpawns = map.enemySpawns.map((cell) => ({ ...cell }));
    const uniqueSpawns = new Set(firstSpawns.map((cell) => `${cell.x}:${cell.y}`));
    assert.equal(uniqueSpawns.size, firstSpawns.length);
    assert.equal(firstSpawns.every((cell) => map.isWalkable(cell)), true);

    for (const chunk of map.activeChunks) {
        const count = firstSpawns.filter((cell) =>
            Math.floor(cell.x / CHUNK_COLUMNS) === chunk.coordinate.x
            && Math.floor(cell.y / CHUNK_ROWS) === chunk.coordinate.y).length;
        assert.equal(count, encounterProfileForChunk(chunk.coordinate).enemyCount, chunk.key);
    }

    const repeat = createInfiniteExplorationMap({ worldSeed: 1907 });
    repeat.refreshAround(center);
    assert.deepEqual(repeat.enemySpawns, firstSpawns);
    for (const spawn of firstSpawns) {
        const coordinate = {
            x: Math.floor(spawn.x / CHUNK_COLUMNS),
            y: Math.floor(spawn.y / CHUNK_ROWS),
        };
        assert.equal(map.enemyHealthMultiplier(spawn), encounterProfileForChunk(coordinate).healthMultiplier);
    }
});
