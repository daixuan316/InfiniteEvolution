import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("main Canvas uses the same 1334x750 coordinate space as runtime UI", () => {
    const scene = JSON.parse(readFileSync("assets/main.scene", "utf8"));
    const canvasTransform = scene.find((entry) => entry._name === "Canvas<UITransform>");
    const canvasNode = scene.find((entry) => entry._name === "gui");

    assert.deepEqual(canvasTransform._contentSize, {
        __type__: "cc.Size",
        width: 1334,
        height: 750,
    });
    assert.equal(canvasNode._lpos.x, 667);
    assert.equal(canvasNode._lpos.y, 375);
});
