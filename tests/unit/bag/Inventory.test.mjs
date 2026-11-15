import assert from "node:assert/strict";
import test from "node:test";

import { Inventory } from "../../../assets/script/game/bag/workshop/Inventory.ts";
import { ITEM_DEFINITIONS } from "../../../assets/script/game/bag/workshop/WorkshopCatalog.ts";

test("inventory stacks materials and counts occupied slots", () => {
    const inventory = new Inventory(3, ITEM_DEFINITIONS);

    assert.equal(inventory.add("scrap", 100), true);
    assert.equal(inventory.usedSlots, 2);
    assert.equal(inventory.count("scrap"), 100);
});

test("failed additions and removals leave the inventory unchanged", () => {
    const inventory = new Inventory(1, ITEM_DEFINITIONS, { scrap: 99 });

    assert.equal(inventory.add("assault_rifle", 1), false);
    assert.equal(inventory.remove("scrap", 100), false);
    assert.deepEqual(inventory.toSnapshot(), { scrap: 99 });
});

test("capacity simulation includes queued output reservations", () => {
    const inventory = new Inventory(2, ITEM_DEFINITIONS, { scrap: 99 });

    assert.equal(inventory.canFit({ assault_rifle: 1 }), true);
    assert.equal(inventory.canFit({ assault_rifle: 1, shotgun: 1 }), false);
    assert.deepEqual(inventory.toSnapshot(), { scrap: 99 });
});

test("invalid item IDs and amounts never mutate inventory", () => {
    const inventory = new Inventory(2, ITEM_DEFINITIONS, { scrap: 5 });

    assert.equal(inventory.add("missing", 1), false);
    assert.equal(inventory.add("scrap", Number.NaN), false);
    assert.equal(inventory.remove("scrap", -1), false);
    assert.deepEqual(inventory.toSnapshot(), { scrap: 5 });
});
