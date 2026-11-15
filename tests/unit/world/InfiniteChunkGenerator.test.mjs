import assert from "node:assert/strict";
import test from "node:test";

import {
    generateInfiniteChunk,
    isRareLandmarkAnchor,
} from "../../../assets/script/game/world/infinite/InfiniteChunkGenerator.ts";

const WORLD_SEED = 1907;

test("chunk generation is deterministic and independent of call order", () => {
    const target = generateInfiniteChunk(WORLD_SEED, { x: -9, y: 14 });
    generateInfiniteChunk(WORLD_SEED, { x: 90, y: -3 });
    generateInfiniteChunk(WORLD_SEED, { x: -8, y: 14 });
    assert.deepEqual(generateInfiniteChunk(WORLD_SEED, { x: -9, y: 14 }), target);
});

test("neighboring chunks independently agree on shared road exits", () => {
    for (let y = -20; y <= 20; y++) {
        for (let x = -20; x <= 20; x++) {
            const here = generateInfiniteChunk(WORLD_SEED, { x, y });
            const east = generateInfiniteChunk(WORLD_SEED, { x: x + 1, y });
            const north = generateInfiniteChunk(WORLD_SEED, { x, y: y + 1 });
            assert.equal(here.roads.east, east.roads.west, `east edge mismatch at ${x}:${y}`);
            assert.equal(here.roads.north, north.roads.south, `north edge mismatch at ${x}:${y}`);
            assert.ok(Object.values(here.roads).some(Boolean), `chunk ${x}:${y} needs a road exit`);
        }
    }
});

test("shared road edges produce deterministic open and closed connector variants", () => {
    let openNorth = 0;
    let closedNorth = 0;
    const exitCounts = new Set();
    for (let y = -12; y <= 12; y++) {
        for (let x = -12; x <= 12; x++) {
            const roads = generateInfiniteChunk(WORLD_SEED, { x, y }).roads;
            exitCounts.add(Object.values(roads).filter(Boolean).length);
            if (roads.north) openNorth++;
            else closedNorth++;
        }
    }
    assert.ok(openNorth > 0);
    assert.ok(closedNorth > 0);
    assert.deepEqual([...exitCounts].sort(), [1, 2, 3, 4]);
});

test("road cells connect every enabled portal through the chunk center", () => {
    const chunk = generateInfiniteChunk(WORLD_SEED, { x: 3, y: -6 });
    const roadKeys = new Set(chunk.roadCells.map((cell) => `${cell.x}:${cell.y}`));
    const portals = [];
    if (chunk.roads.west) portals.push({ x: 0, y: 3 });
    if (chunk.roads.east) portals.push({ x: 13, y: 3 });
    if (chunk.roads.south) portals.push({ x: 6, y: 0 });
    if (chunk.roads.north) portals.push({ x: 6, y: 7 });
    for (const portal of portals) assert.equal(roadKeys.has(`${portal.x}:${portal.y}`), true);
    assert.equal(roadKeys.has("6:3"), true);
    if (!chunk.roads.south) assert.equal(roadKeys.has("6:0"), false);
    if (!chunk.roads.north) assert.equal(roadKeys.has("6:7"), false);
});

test("ten thousand chunks keep residential lots dominant", () => {
    const counts = { residential: 0, commercial: 0, industrial: 0, open: 0, landmark: 0 };
    for (let y = -50; y < 50; y++) {
        for (let x = -50; x < 50; x++) {
            const chunk = generateInfiniteChunk(WORLD_SEED, { x, y });
            for (const lot of chunk.buildingLots) counts[lot.kind]++;
        }
    }
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    const residentialRatio = counts.residential / total;
    assert.ok(residentialRatio >= 0.60 && residentialRatio <= 0.72, `residential ratio ${residentialRatio}`);
    assert.ok(counts.commercial > counts.landmark * 8);
    assert.ok(counts.residential > counts.commercial * 2);
});

test("hospital landmarks are rare, deterministic, and separated", () => {
    const landmarks = [];
    for (let y = -50; y < 50; y++) {
        for (let x = -50; x < 50; x++) {
            const coordinate = { x, y };
            if (isRareLandmarkAnchor(WORLD_SEED, coordinate, "hospital")) landmarks.push(coordinate);
        }
    }
    assert.ok(landmarks.length >= 285 && landmarks.length <= 400, `landmark count ${landmarks.length}`);
    for (let left = 0; left < landmarks.length; left++) {
        for (let right = left + 1; right < landmarks.length; right++) {
            const dx = Math.abs(landmarks[left].x - landmarks[right].x);
            const dy = Math.abs(landmarks[left].y - landmarks[right].y);
            if (dx > 4 || dy > 4) continue;
            assert.ok(Math.max(dx, dy) >= 4, `landmarks too close: ${JSON.stringify([landmarks[left], landmarks[right]])}`);
        }
    }
});

test("building lots own stable local ids and never overlap road cells", () => {
    const chunk = generateInfiniteChunk(WORLD_SEED, { x: 12, y: 8 });
    const roadKeys = new Set(chunk.roadCells.map((cell) => `${cell.x}:${cell.y}`));
    assert.equal(new Set(chunk.buildingLots.map((lot) => lot.id)).size, chunk.buildingLots.length);
    for (const lot of chunk.buildingLots) {
        assert.ok(lot.cell.x >= 0 && lot.cell.y >= 0);
        assert.ok(lot.cell.x + lot.width <= 14 && lot.cell.y + lot.height <= 8);
        for (let y = lot.cell.y; y < lot.cell.y + lot.height; y++) {
            for (let x = lot.cell.x; x < lot.cell.x + lot.width; x++) {
                assert.equal(roadKeys.has(`${x}:${y}`), false, `${lot.id} overlaps road ${x}:${y}`);
            }
        }
    }
});
