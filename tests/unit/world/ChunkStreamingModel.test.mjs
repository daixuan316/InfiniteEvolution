import assert from "node:assert/strict";
import test from "node:test";

import {
    ChunkStreamingModel,
    toChunkCoordinate,
    toLocalRenderPoint,
} from "../../../assets/script/game/world/infinite/ChunkStreamingModel.ts";

test("streaming exposes 3x3 active and 5x5 preload sets", () => {
    const model = new ChunkStreamingModel();
    const diff = model.update({ x: 0, y: 0 });
    assert.equal(model.activeKeys.size, 9);
    assert.equal(model.preloadedKeys.size, 25);
    assert.equal(diff.load.length, 25);
    assert.equal(diff.activate.length, 9);
    assert.equal(diff.unload.length, 0);
});

test("moving one chunk loads and unloads one preload column", () => {
    const model = new ChunkStreamingModel();
    model.update({ x: 0, y: 0 });
    const diff = model.update({ x: 1344, y: 0 });
    assert.equal(diff.load.length, 5);
    assert.equal(diff.unload.length, 5);
    assert.equal(diff.activate.length, 3);
    assert.equal(diff.deactivate.length, 3);
});

test("negative world positions use floor division", () => {
    assert.deepEqual(toChunkCoordinate({ x: -1, y: -1 }), { x: -1, y: -1 });
    assert.deepEqual(toChunkCoordinate({ x: -1344, y: -768 }), { x: -1, y: -1 });
    assert.deepEqual(toChunkCoordinate({ x: -1345, y: -769 }), { x: -2, y: -2 });
});

test("floating origin shifts in whole chunks and preserves local precision", () => {
    const model = new ChunkStreamingModel();
    model.update({ x: 0, y: 0 });
    const permanent = { x: 1344 * 3 + 19, y: -768 * 4 + 27 };
    const diff = model.update(permanent);
    assert.deepEqual(diff.originShift, { x: 1344 * 3, y: -768 * 4 });
    assert.deepEqual(model.renderOrigin, { x: 1344 * 3, y: -768 * 4 });
    assert.deepEqual(toLocalRenderPoint(permanent, model.renderOrigin), { x: 19, y: 27 });
});

test("updating inside the same chunk produces no lifecycle churn", () => {
    const model = new ChunkStreamingModel();
    model.update({ x: 10, y: 10 });
    const diff = model.update({ x: 1200, y: 700 });
    assert.deepEqual(diff.load, []);
    assert.deepEqual(diff.unload, []);
    assert.deepEqual(diff.activate, []);
    assert.deepEqual(diff.deactivate, []);
    assert.equal(diff.originShift, undefined);
});
