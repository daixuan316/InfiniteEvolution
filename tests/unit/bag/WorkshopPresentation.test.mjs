import assert from "node:assert/strict";
import test from "node:test";

import { actionTextForReason, formatRemainingTime } from "../../../assets/script/game/bag/workshop/WorkshopPresentation.ts";

test("remaining workshop time uses a stable MM:SS display", () => {
    assert.equal(formatRemainingTime(65_000), "01:05");
    assert.equal(formatRemainingTime(999), "00:01");
    assert.equal(formatRemainingTime(-1), "00:00");
});

test("craft availability maps to explicit player-facing action text", () => {
    assert.equal(actionTextForReason(null), "开始制造");
    assert.equal(actionTextForReason("materials-missing"), "材料不足");
    assert.equal(actionTextForReason("queue-full"), "队列已满");
    assert.equal(actionTextForReason("output-full"), "仓库空间不足");
    assert.equal(actionTextForReason("recipe-locked"), "配方未解锁");
    assert.equal(actionTextForReason("recipe-missing"), "配方不存在");
});
