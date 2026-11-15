import assert from "node:assert/strict";
import test from "node:test";

import { syncDayTimerView } from "../../../assets/script/game/battle/DayTimerViewState.ts";

test("day timer sync skips an incomplete runtime-built view", () => {
    let progressUpdates = 0;
    const synced = syncDayTimerView(
        { timeLabel: null, pressureLabel: null, progressBar: null },
        { timeText: "07:59", pressureText: "安全探索", remainingRatio: 0.99, color: "cyan" },
        () => { progressUpdates++; },
    );

    assert.equal(synced, false);
    assert.equal(progressUpdates, 0);
});

test("day timer sync updates every bound view element", () => {
    const timeLabel = { string: "", color: "white" };
    const pressureLabel = { string: "", color: "orange" };
    const progressBar = { ratio: 0 };

    const synced = syncDayTimerView(
        { timeLabel, pressureLabel, progressBar },
        { timeText: "02:00", pressureText: "日落警戒", remainingRatio: 0.25, color: "danger" },
        (bar, ratio) => { bar.ratio = ratio; },
    );

    assert.equal(synced, true);
    assert.deepEqual(timeLabel, { string: "02:00", color: "danger" });
    assert.deepEqual(pressureLabel, { string: "日落警戒", color: "danger" });
    assert.equal(progressBar.ratio, 0.25);
});
