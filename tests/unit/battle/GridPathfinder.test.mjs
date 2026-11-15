import assert from "node:assert/strict";
import test from "node:test";

import { GridPathfinder } from "../../../assets/script/game/battle/GridPathfinder.ts";

function grid(width, height, blocked) {
    return {
        columns: width,
        rows: height,
        isWalkable: ({ x, y }) => x >= 0 && y >= 0 && x < width && y < height && !blocked.has(`${x},${y}`),
    };
}

test("A* routes through the only opening in a wall", () => {
    const blocked = new Set(["3,0", "3,1", "3,2", "3,4", "3,5", "3,6"]);
    const map = grid(8, 7, blocked);
    const path = new GridPathfinder(map).findPath({ x: 1, y: 1 }, { x: 6, y: 5 });

    assert.deepEqual(path[0], { x: 1, y: 1 });
    assert.deepEqual(path.at(-1), { x: 6, y: 5 });
    assert.ok(path.some((cell) => cell.x === 3 && cell.y === 3));
    assert.equal(path.some((cell) => blocked.has(`${cell.x},${cell.y}`)), false);
});

test("diagonal movement never cuts between two blocked corners", () => {
    const blocked = new Set(["1,0", "0,1"]);
    const map = grid(3, 3, blocked);

    assert.deepEqual(new GridPathfinder(map).findPath({ x: 0, y: 0 }, { x: 2, y: 2 }), []);
});

test("blocked destinations resolve to the nearest reachable cell", () => {
    const blocked = new Set(["4,4"]);
    const map = grid(6, 6, blocked);
    const path = new GridPathfinder(map).findPathToNearest({ x: 0, y: 0 }, { x: 4, y: 4 });

    assert.ok(path.length > 0);
    assert.notDeepEqual(path.at(-1), { x: 4, y: 4 });
    assert.equal(map.isWalkable(path.at(-1)), true);
});

test("unbounded grids search signed coordinates within a finite work budget", () => {
    const map = {
        columns: 0,
        rows: 0,
        infinite: true,
        isWalkable: ({ x, y }) => y === -2 && x >= -30 && x <= 30,
    };
    const path = new GridPathfinder(map).findPath({ x: -20, y: -2 }, { x: 20, y: -2 });
    assert.deepEqual(path[0], { x: -20, y: -2 });
    assert.deepEqual(path.at(-1), { x: 20, y: -2 });
});

test("unbounded nearest search does not scan a nonexistent global grid", () => {
    const map = {
        columns: 0,
        rows: 0,
        infinite: true,
        isWalkable: ({ x, y }) => y === 0 && x >= -20 && x <= 20,
    };
    const path = new GridPathfinder(map).findPathToNearest({ x: -10, y: 0 }, { x: 4, y: 3 });
    assert.deepEqual(path.at(-1), { x: 4, y: 0 });
});
