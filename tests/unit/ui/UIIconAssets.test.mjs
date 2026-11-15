import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { BATTLE_HUD_ICON_ASSETS, FEATURE_ICON_ASSETS } from "../../../assets/script/game/common/ui/UIIconAssets.ts";

test("every Hall feature icon resolves to a bundled PNG", () => {
    assert.deepEqual(Object.keys(FEATURE_ICON_ASSETS), ["equipment", "workshop", "arkBuild", "research", "crew", "intel"]);
    for (const assetPath of Object.values(FEATURE_ICON_ASSETS)) {
        assert.equal(existsSync(`assets/bundle/gui/ui-icons/${assetPath}.png`), true, assetPath);
        assert.equal(existsSync(`assets/bundle/gui/ui-icons/${assetPath}.png.meta`), true, `${assetPath}.meta`);
    }
});

test("every battle HUD icon resolves to a bundled PNG and Cocos meta", () => {
    assert.deepEqual(BATTLE_HUD_ICON_ASSETS, {
        health: "hud-combat/01-health",
        shield: "hud-combat/02-shield",
        pollution: "hud-combat/04-pollution",
        dayTimer: "hud-combat/05-day-timer",
        minimap: "hud-combat/06-minimap",
        returnArk: "hud-combat/07-ark-return",
        dodge: "hud-combat/08-dodge",
        sprint: "attributes-crafting/06-speed",
        objective: "map-actions/07-objective-pin",
        pause: "system-nav/10-pause",
        map: "system-nav/01-map",
    });
    for (const assetPath of Object.values(BATTLE_HUD_ICON_ASSETS)) {
        assert.equal(existsSync(`assets/bundle/gui/ui-icons/${assetPath}.png`), true, assetPath);
        assert.equal(existsSync(`assets/bundle/gui/ui-icons/${assetPath}.png.meta`), true, `${assetPath}.meta`);
    }
});
