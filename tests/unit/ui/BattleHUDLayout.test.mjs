import assert from "node:assert/strict";
import test from "node:test";

import * as battleLayout from "../../../assets/script/game/battle/BattleHUDLayout.ts";

const { battleControlLayout, rectanglesOverlap } = battleLayout;

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

test("player status text stays inside the plate and aligns with its bars", () => {
    assert.equal(typeof battleLayout.playerStatusLayout, "function", "player status layout should be explicit and testable");
    const layout = battleLayout.playerStatusLayout();

    assert.equal(layout.healthText.centerY, layout.healthBar.centerY);
    assert.equal(layout.shieldText.centerY, layout.shieldBar.centerY);

    for (const text of [layout.healthText, layout.shieldText, layout.pollutionText, layout.downedText]) {
        assert.ok(text.left >= layout.content.left);
        assert.ok(text.right <= layout.content.right);
        assert.ok(text.top <= layout.content.top);
        assert.ok(text.bottom >= layout.content.bottom);
    }
    assert.equal(rectanglesOverlap(layout.pollutionText, layout.downedText), false);
});
