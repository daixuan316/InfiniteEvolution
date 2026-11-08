import assert from "node:assert/strict";
import test from "node:test";

import { textureAssetPath } from "../../../assets/script/game/common/ui/TextureAssetPath.ts";

test("adds the Cocos Texture2D subresource suffix once", () => {
    assert.equal(textureAssetPath("gui/hall/texture/ark-garage"), "gui/hall/texture/ark-garage/texture");
    assert.equal(textureAssetPath("gui/hall/texture/ark-garage/texture"), "gui/hall/texture/ark-garage/texture");
});
