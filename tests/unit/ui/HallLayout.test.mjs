import assert from "node:assert/strict";
import test from "node:test";

import { filledSegments, fitSizeWithin } from "../../../assets/script/game/hall/HallLayout.ts";

test("fits the ark art without changing its aspect ratio", () => {
    assert.deepEqual(fitSizeWithin(768, 512, 650, 360), { width: 540, height: 360 });
    assert.deepEqual(fitSizeWithin(768, 512, 420, 410), { width: 420, height: 280 });
});

test("maps status values to clamped industrial segments", () => {
    assert.equal(filledSegments(920, 1000, 10), 9);
    assert.equal(filledSegments(88, 100, 10), 9);
    assert.equal(filledSegments(5, 7, 7), 5);
    assert.equal(filledSegments(-1, 100, 10), 0);
    assert.equal(filledSegments(120, 100, 10), 10);
});
