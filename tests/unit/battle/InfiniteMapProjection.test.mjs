import assert from "node:assert/strict";
import test from "node:test";

import { discoveredMapPosition, localMapPosition } from "../../../assets/script/game/battle/InfiniteMapProjection.ts";

test("local map projection keeps the player at the center", () => {
    assert.deepEqual(localMapPosition({ x: 9000, y: -4000 }, { x: 9000, y: -4000 }, 2000, 800, 440), { x: 0, y: 0 });
});

test("local map projection maps the configured radius to canvas edges", () => {
    assert.deepEqual(localMapPosition({ x: 11_000, y: -2000 }, { x: 9000, y: -4000 }, 2000, 800, 440), { x: 400, y: 220 });
    assert.deepEqual(localMapPosition({ x: 7000, y: -6000 }, { x: 9000, y: -4000 }, 2000, 800, 440), { x: -400, y: -220 });
});

test("local map projection preserves off-canvas positions for caller clipping", () => {
    assert.deepEqual(localMapPosition({ x: 5000, y: 0 }, { x: 0, y: 0 }, 1000, 200, 100), { x: 500, y: 0 });
});

test("discovered map projection fits signed explored chunks independently of the player", () => {
    const chunks = ["-2:1", "1:3"];
    const leftBottom = discoveredMapPosition({ x: -2 * 1344, y: 1 * 768 }, chunks, 1344, 768, 800, 440);
    const rightTop = discoveredMapPosition({ x: 2 * 1344, y: 4 * 768 }, chunks, 1344, 768, 800, 440);
    assert.ok(leftBottom.x < 0 && leftBottom.y < 0);
    assert.ok(rightTop.x > 0 && rightTop.y > 0);
    assert.ok(Math.abs(leftBottom.x) <= 400 && Math.abs(rightTop.x) <= 400);
    assert.ok(Math.abs(leftBottom.y) <= 220 && Math.abs(rightTop.y) <= 220);
});
