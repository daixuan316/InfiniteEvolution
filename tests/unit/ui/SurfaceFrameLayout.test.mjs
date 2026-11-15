import assert from "node:assert/strict";
import test from "node:test";

import {
    shouldComposeLargeSurface,
    surfaceFramePieces,
} from "../../../assets/script/game/common/ui/SurfaceFrameLayout.ts";

test("keeps side decorations at authored size on tall large panels", () => {
    const pieces = surfaceFramePieces(258, 500);
    const left = pieces.find((piece) => piece.name === "left-module");
    const right = pieces.find((piece) => piece.name === "right-module");

    assert.deepEqual(
        { width: left.width, height: left.height },
        { width: 51, height: 71 },
    );
    assert.deepEqual(
        { width: right.width, height: right.height },
        { width: 41, height: 71 },
    );
    assert.equal(left.x, -103);
    assert.equal(right.x, 109);
});

test("uniformly scales decorations on shallow wide panels", () => {
    const pieces = surfaceFramePieces(1278, 82);
    const top = pieces.find((piece) => piece.name === "top-badge");
    const caution = pieces.find((piece) => piece.name === "bottom-caution");

    assert.deepEqual(
        { width: top.width, height: top.height, x: top.x, y: top.y },
        { width: 76, height: 37, x: 0, y: 23 },
    );
    assert.deepEqual(
        { width: caution.width, height: caution.height, x: caution.x, y: caution.y },
        { width: 90, height: 38, x: 0, y: -22 },
    );
    assert.ok(Math.abs(top.width / top.source.width - top.height / top.source.height) < 0.02);
});

test("keeps every composed frame piece inside its target bounds", () => {
    for (const [width, height] of [[1278, 82], [258, 500], [610, 330], [930, 610]]) {
        for (const piece of surfaceFramePieces(width, height)) {
            assert.ok(piece.x - piece.width / 2 >= -width / 2 - 0.5, `${piece.name} exceeds left at ${width}x${height}`);
            assert.ok(piece.x + piece.width / 2 <= width / 2 + 0.5, `${piece.name} exceeds right at ${width}x${height}`);
            assert.ok(piece.y - piece.height / 2 >= -height / 2 - 0.5, `${piece.name} exceeds bottom at ${width}x${height}`);
            assert.ok(piece.y + piece.height / 2 <= height / 2 + 0.5, `${piece.name} exceeds top at ${width}x${height}`);
        }
    }
});

test("rejects invalid or too-small composite targets", () => {
    assert.equal(shouldComposeLargeSurface(1278, 82), true);
    assert.equal(shouldComposeLargeSurface(258, 500), true);
    assert.equal(shouldComposeLargeSurface(100, 50), false);
    assert.equal(shouldComposeLargeSurface(Number.NaN, 500), false);
    assert.deepEqual(surfaceFramePieces(Number.NaN, 500), []);
});
