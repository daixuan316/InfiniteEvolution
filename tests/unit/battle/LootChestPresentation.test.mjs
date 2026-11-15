import assert from "node:assert/strict";
import test from "node:test";

import {
    LOOT_CHEST_OPENING_SECONDS,
    advanceLootChestOpening,
    lootChestEffectProfile,
    lootChestVisualState,
} from "../../../assets/script/game/battle/LootChestPresentation.ts";

test("opening transitions to opened after the fixed window", () => {
    assert.equal(LOOT_CHEST_OPENING_SECONDS, 0.48);
    assert.equal(lootChestVisualState(false, 0), "closed");
    assert.equal(lootChestVisualState(true, 0.2), "opening");
    assert.equal(lootChestVisualState(true, 0), "opened");
    assert.equal(advanceLootChestOpening(0.42, 0.5), 0);
    assert.equal(advanceLootChestOpening(0.42, -1), 0.42);
});

test("effect profiles distinguish normal tech bio and rare loot", () => {
    assert.deepEqual(lootChestEffectProfile("supply-crate"), {
        ring: "interaction-gold-ring",
        burst: "opening-radial-flash",
    });
    assert.equal(lootChestEffectProfile("energy-cell-crate").ring, "technology-cyan-ring");
    assert.equal(lootChestEffectProfile("bio-crate").ring, "pollution-magenta-ring");
    assert.equal(lootChestEffectProfile("heavy-safe").burst, "rare-white-gold-star");
});
