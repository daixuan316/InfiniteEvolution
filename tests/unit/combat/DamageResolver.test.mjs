import assert from "node:assert/strict";
import test from "node:test";

import { resolveDamage } from "../../../assets/script/game/combat/DamageResolver.ts";

const validRequest = {
    sourceId: "player",
    targetId: "enemy-0",
    baseDamage: 100,
    defense: 100,
    skillMultiplier: 1,
    additiveBonuses: [0.2, 0.3],
    criticalMultiplier: 1,
    weakpointMultiplier: 1,
    tags: ["physical", "ranged"],
};

test("same-pool bonuses add before defense reduction", () => {
    const result = resolveDamage(validRequest);

    assert.equal(result.accepted, true);
    assert.equal(result.rawDamage, 150);
    assert.equal(result.reduction, 0.5);
    assert.equal(result.amount, 75);
    assert.deepEqual(result.tags, ["physical", "ranged"]);
});

test("a valid hit always deals at least one damage", () => {
    const result = resolveDamage({ ...validRequest, baseDamage: 1, defense: 99999, additiveBonuses: [] });
    assert.equal(result.amount, 1);
});

test("optional multipliers use neutral defaults", () => {
    const result = resolveDamage({
        sourceId: "enemy",
        targetId: "barricade",
        baseDamage: 30,
        defense: 50,
    });

    assert.equal(result.accepted, true);
    assert.equal(result.amount, 20);
});

test("invalid numeric inputs are rejected without damage", () => {
    for (const patch of [
        { baseDamage: -1 },
        { defense: -1 },
        { skillMultiplier: 0 },
        { criticalMultiplier: Number.NaN },
        { additiveBonuses: [Number.POSITIVE_INFINITY] },
        { additiveBonuses: [-1] },
    ]) {
        const result = resolveDamage({ ...validRequest, ...patch });
        assert.equal(result.accepted, false);
        assert.equal(result.reason, "invalid-request");
        assert.equal(result.amount, 0);
    }
});

test("empty source or target identifiers are rejected", () => {
    assert.equal(resolveDamage({ ...validRequest, sourceId: "" }).accepted, false);
    assert.equal(resolveDamage({ ...validRequest, targetId: "" }).accepted, false);
});
