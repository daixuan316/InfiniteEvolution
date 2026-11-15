import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
    LOOT_CHEST_EFFECTS,
    LOOT_CHEST_IDS,
    lootChestAssetPath,
    lootChestEffectPath,
} from "../../../assets/script/game/common/ui/LootChestAssets.ts";

test("loot chest catalog covers 16 stable ids and every state", () => {
    assert.equal(LOOT_CHEST_IDS.length, 16);
    assert.equal(new Set(LOOT_CHEST_IDS).size, 16);
    for (const id of LOOT_CHEST_IDS) {
        for (const layer of ["world", "icons"]) {
            for (const state of ["closed", "opening", "opened"]) {
                assert.equal(
                    lootChestAssetPath(id, layer, state),
                    `gui/loot-chests/${layer}/${id}/${state}`,
                );
            }
        }
    }
});

test("all catalog assets exist after slicing", () => {
    for (const id of LOOT_CHEST_IDS) {
        for (const layer of ["world", "icons"]) {
            for (const state of ["closed", "opening", "opened"]) {
                const assetPath = lootChestAssetPath(id, layer, state);
                assert.equal(existsSync(`assets/bundle/${assetPath}.png`), true, assetPath);
            }
        }
    }

    assert.equal(LOOT_CHEST_EFFECTS.length, 8);
    for (const effect of LOOT_CHEST_EFFECTS) {
        const assetPath = lootChestEffectPath(effect);
        assert.equal(existsSync(`assets/bundle/${assetPath}.png`), true, assetPath);
    }
});
