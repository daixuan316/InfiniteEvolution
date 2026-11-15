import assert from "node:assert/strict";
import test from "node:test";

import { textureFrameLayout } from "../../../assets/script/game/common/ui/TextureFrameLayout.ts";

test("trims generated panel art to its visible pixels and preserves nine-slice borders", () => {
    assert.deepEqual(textureFrameLayout("gui/ui-p0/texture/common/01-panel-large"), {
        x: 10,
        y: 81,
        width: 246,
        height: 175,
        borderTop: 32,
        borderBottom: 32,
        borderLeft: 36,
        borderRight: 36,
    });
});

test("compact resource rails exclude the detached left-side canvas remnant", () => {
    assert.deepEqual(textureFrameLayout("gui/ui-p0/texture/common/03-card-compact"), {
        x: 61,
        y: 86,
        width: 161,
        height: 170,
        borderTop: 28,
        borderBottom: 28,
        borderLeft: 28,
        borderRight: 28,
    });
});

test("trims HUD plates without forcing nine-slice borders", () => {
    assert.deepEqual(textureFrameLayout("gui/ui-p0/texture/exploration-hud/01-player-health-frame"), {
        x: 20,
        y: 112,
        width: 236,
        height: 89,
    });
});

test("leaves full-screen and ordinary sprite art untrimmed", () => {
    assert.equal(textureFrameLayout("gui/battle-hud/texture/hospital-district"), undefined);
    assert.equal(textureFrameLayout("gui/ui-icons/system-nav/10-pause"), undefined);
});
