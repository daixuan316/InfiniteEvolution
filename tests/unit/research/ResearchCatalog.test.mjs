import assert from "node:assert/strict";
import test from "node:test";

import {
    RESEARCH_DEFINITIONS,
    researchById,
    validateResearchCatalog,
} from "../../../assets/script/game/research/model/ResearchCatalog.ts";

const baseNode = {
    id: "base",
    branch: "mechanical",
    tier: 1,
    name: "基础节点",
    description: "测试目录节点",
    cost: 1,
    durationSeconds: 20,
    prerequisites: [],
    effects: [{ stat: "maxHealth", add: 10 }],
};

test("initial catalog exposes four branches and twelve valid nodes", () => {
    assert.equal(RESEARCH_DEFINITIONS.length, 12);
    assert.deepEqual(
        new Set(RESEARCH_DEFINITIONS.map((node) => node.branch)),
        new Set(["mechanical", "survival", "biochemical", "hybrid"]),
    );
    assert.doesNotThrow(() => validateResearchCatalog(RESEARCH_DEFINITIONS));
});

test("catalog lookup returns a stable node definition", () => {
    const node = researchById("mech_plating_1");

    assert.equal(node?.name, "复合装甲");
    assert.equal(node?.durationSeconds, 20);
    assert.deepEqual(node?.effects, [{ stat: "maxShield", add: 30 }]);
    assert.equal(researchById("missing"), undefined);
});

test("catalog rejects duplicate ids", () => {
    assert.throws(
        () => validateResearchCatalog([baseNode, { ...baseNode }]),
        /duplicate/i,
    );
});

test("catalog rejects invalid costs, durations, and effect values", () => {
    assert.throws(
        () => validateResearchCatalog([{ ...baseNode, cost: 0 }]),
        /cost/i,
    );
    assert.throws(
        () => validateResearchCatalog([{ ...baseNode, durationSeconds: Number.NaN }]),
        /duration/i,
    );
    assert.throws(
        () => validateResearchCatalog([{ ...baseNode, effects: [{ stat: "moveSpeed", multiplier: 0 }] }]),
        /effect/i,
    );
});

test("catalog rejects missing prerequisites and dependency cycles", () => {
    assert.throws(
        () => validateResearchCatalog([{ ...baseNode, prerequisites: ["missing"] }]),
        /prerequisite/i,
    );
    assert.throws(
        () => validateResearchCatalog([
            { ...baseNode, id: "a", prerequisites: ["b"] },
            { ...baseNode, id: "b", prerequisites: ["a"] },
        ]),
        /cycle/i,
    );
});
