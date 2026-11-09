import assert from "node:assert/strict";
import test from "node:test";

import { chunkArtTemplate } from "../../../assets/script/game/world/infinite/InfiniteChunkTemplate.ts";

const OPEN_ROADS = { north: true, east: true, south: true, west: true };

function hasCell(cells, x, y) {
    return cells.some((cell) => cell.x === x && cell.y === y);
}

test("residential art exposes its visible center and perimeter streets", () => {
    const template = chunkArtTemplate("residential-district-a", OPEN_ROADS);
    assert.equal(hasCell(template.roadCells, 6, 4), true);
    assert.equal(hasCell(template.roadCells, 0, 4), true);
    assert.equal(hasCell(template.roadCells, 13, 2), true);
    assert.equal(hasCell(template.roadCells, 6, 7), true);
    assert.equal(hasCell(template.roadCells, 2, 1), false);
});

test("closed chunk edges are not traversable", () => {
    const template = chunkArtTemplate("residential-district-a", {
        north: false,
        east: false,
        south: false,
        west: false,
    });
    assert.equal(template.roadCells.some((cell) => cell.y === 7), false);
    assert.equal(template.roadCells.some((cell) => cell.x === 13), false);
    assert.equal(template.roadCells.some((cell) => cell.y === 0), false);
    assert.equal(template.roadCells.some((cell) => cell.x === 0), false);
});

test("hospital median blockers are removed from the road mask", () => {
    const template = chunkArtTemplate("hospital-district", OPEN_ROADS);
    assert.deepEqual(template.solidCells, [
        { x: 2, y: 3 },
        { x: 3, y: 3 },
        { x: 9, y: 4 },
        { x: 10, y: 4 },
    ]);
    assert.equal(template.solidCells.every((solid) => !hasCell(template.roadCells, solid.x, solid.y)), true);
    assert.equal(hasCell(template.roadCells, 2, 4), true);
    assert.equal(hasCell(template.roadCells, 9, 3), true);
});
