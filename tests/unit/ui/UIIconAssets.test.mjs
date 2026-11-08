import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import { FEATURE_ICON_ASSETS } from "../../../assets/script/game/common/ui/UIIconAssets.ts";

test("every Hall feature icon resolves to a bundled PNG", () => {
    assert.deepEqual(Object.keys(FEATURE_ICON_ASSETS), ["equipment", "workshop", "arkBuild", "research", "crew", "intel"]);
    for (const assetPath of Object.values(FEATURE_ICON_ASSETS)) {
        assert.equal(existsSync(`assets/bundle/gui/ui-icons/${assetPath}.png`), true, assetPath);
        assert.equal(existsSync(`assets/bundle/gui/ui-icons/${assetPath}.png.meta`), true, `${assetPath}.meta`);
    }
});
