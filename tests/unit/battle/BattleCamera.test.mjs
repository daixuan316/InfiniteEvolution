import assert from "node:assert/strict";
import test from "node:test";

import { cameraTargetFor } from "../../../assets/script/game/battle/BattleCamera.ts";

test("camera follows the player in the center and clamps at all map edges", () => {
    const map = { worldWidth: 4032, worldHeight: 2304 };
    const viewport = { width: 1334, height: 750 };

    assert.deepEqual(cameraTargetFor({ x: 120, y: -80 }, map, viewport), { x: 120, y: -80 });
    assert.deepEqual(cameraTargetFor({ x: 9999, y: 9999 }, map, viewport), { x: 1349, y: 777 });
    assert.deepEqual(cameraTargetFor({ x: -9999, y: -9999 }, map, viewport), { x: -1349, y: -777 });
});

test("camera stays centered when the map is smaller than the viewport", () => {
    assert.deepEqual(
        cameraTargetFor({ x: 100, y: 100 }, { worldWidth: 600, worldHeight: 400 }, { width: 800, height: 600 }),
        { x: 0, y: 0 },
    );
});
