import assert from "node:assert/strict";
import test from "node:test";

import { filledSegments, fitSizeWithin, hallTopBarLeftLayout, isHazardStripeBright } from "../../../assets/script/game/hall/HallLayout.ts";

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

test("keeps the Hall top bar labels separated inside the safe width", () => {
    for (const topWidth of [1278, 1544, 1744, 1894]) {
        const layout = hallTopBarLeftLayout(topWidth);
        const slots = [layout.chapterBadge, layout.chapter, layout.dayIcon, layout.day];

        for (let index = 1; index < slots.length; index += 1) {
            const previousRight = slots[index - 1].centerX + slots[index - 1].width / 2;
            const currentLeft = slots[index].centerX - slots[index].width / 2;
            assert.ok(currentLeft >= previousRight, `${topWidth}: slot ${index} overlaps`);
        }
        assert.ok(slots[0].centerX - slots[0].width / 2 >= -topWidth / 2);
        assert.ok(slots.at(-1).centerX + slots.at(-1).width / 2 <= topWidth / 2);
    }
});

test("alternates bright and dark blocks in the hazard stripe", () => {
    assert.deepEqual(Array.from({ length: 8 }, (_, index) => isHazardStripeBright(index)), [true, false, true, false, true, false, true, false]);
});
