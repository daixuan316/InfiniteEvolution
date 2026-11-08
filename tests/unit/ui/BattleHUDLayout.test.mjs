import assert from "node:assert/strict";
import test from "node:test";

import { battleControlLayout, rectanglesOverlap } from "../../../assets/script/game/battle/BattleHUDLayout.ts";

for (const frame of [
    { left: -639, right: 639, top: 347, bottom: -347 },
    { left: -639, right: 639, top: 295, bottom: -295 },
]) {
    test(`return control stays clear of touch actions at frame height ${frame.top - frame.bottom}`, () => {
        const layout = battleControlLayout(frame);

        assert.equal(rectanglesOverlap(layout.returnArk, layout.primaryAction), false);
        assert.equal(rectanglesOverlap(layout.returnArk, layout.skillAction), false);
        assert.equal(rectanglesOverlap(layout.returnArk, layout.dodgeAction), false);
        assert.ok(layout.returnArk.right <= frame.right);
        assert.ok(layout.returnArk.top <= frame.top);
    });
}
