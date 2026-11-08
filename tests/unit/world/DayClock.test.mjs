import assert from "node:assert/strict";
import test from "node:test";

import { DayClock, explorationTimeScale, formatDayTime } from "../../../assets/script/game/world/model/DayClock.ts";

test("day clock enters warning, night, and hunt pressure at configured thresholds", () => {
    const clock = new DayClock(480, 120, 0, -60);

    clock.tick(360, 1);
    assert.equal(clock.remaining, 120);
    assert.equal(clock.pressure, "warning");

    clock.tick(120, 1);
    assert.equal(clock.remaining, 0);
    assert.equal(clock.pressure, "night");

    clock.tick(60, 1);
    assert.equal(clock.remaining, -60);
    assert.equal(clock.pressure, "hunt");
});

test("day clock uses reduced map time scale and freezes at zero time scale", () => {
    const clock = new DayClock(480, 120, 0, -60);

    clock.tick(10, 0.2);
    assert.equal(clock.remaining, 478);

    clock.tick(10, 0);
    assert.equal(clock.remaining, 478);
    assert.equal(clock.remainingRatio, 478 / 480);
});

test("exploration time scale slows for the full map but system pause wins", () => {
    assert.equal(explorationTimeScale(false, false), 1);
    assert.equal(explorationTimeScale(false, true), 0.2);
    assert.equal(explorationTimeScale(true, false), 0);
    assert.equal(explorationTimeScale(true, true), 0);
});

test("day clock ignores invalid backwards time and clamps its progress ratio", () => {
    const clock = new DayClock(10, 4, 0, -2);

    clock.tick(-5, 1);
    clock.tick(Number.NaN, 1);
    clock.tick(20, 1);

    assert.equal(clock.remaining, -10);
    assert.equal(clock.remainingRatio, 0);
});

test("day time display counts whole seconds and shows overtime after sunset", () => {
    assert.equal(formatDayTime(266), "04:26");
    assert.equal(formatDayTime(0.2), "00:01");
    assert.equal(formatDayTime(0), "00:00");
    assert.equal(formatDayTime(-5.2), "+00:06");
});
