import assert from "node:assert/strict";
import test from "node:test";

import { encounterProfileForChunk } from "../../../assets/script/game/world/infinite/InfiniteEncounterScaling.ts";

test("enemy count increases through the four Ark distance bands", () => {
    assert.equal(encounterProfileForChunk({ x: 0, y: 0 }).enemyCount, 1);
    assert.equal(encounterProfileForChunk({ x: 1, y: 1 }).enemyCount, 1);
    assert.equal(encounterProfileForChunk({ x: 2, y: 0 }).enemyCount, 2);
    assert.equal(encounterProfileForChunk({ x: 4, y: 3 }).enemyCount, 3);
    assert.equal(encounterProfileForChunk({ x: 8, y: 0 }).enemyCount, 4);
});

test("health grows monotonically and caps at three times base", () => {
    const samples = [0, 1, 4, 8, 20, 200].map((x) => encounterProfileForChunk({ x, y: 0 }).healthMultiplier);
    assert.deepEqual(samples, [1, 1.1, 1.4, 1.8, 3, 3]);
    assert.ok(samples.every((value, index) => index === 0 || value >= samples[index - 1]));
});
