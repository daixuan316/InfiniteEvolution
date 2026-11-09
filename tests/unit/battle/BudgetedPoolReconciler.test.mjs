import assert from "node:assert/strict";
import test from "node:test";

import { reconcileBudgetedEntries } from "../../../assets/script/game/battle/BudgetedPoolReconciler.ts";

test("reconciliation releases outgoing entries before bounded acquisition", () => {
    const events = [];
    const pool = [];
    const previous = new Map([
        ["a", { id: "a", node: "node-a" }],
        ["b", { id: "b", node: "node-b" }],
    ]);
    const desiredIds = ["b", "c", "d", "e", "f"];

    const next = reconcileBudgetedEntries(
        previous,
        desiredIds,
        (entry) => {
            events.push(`release:${entry.id}`);
            pool.push(entry.node);
        },
        (index, allowCreate) => {
            const id = desiredIds[index];
            const reused = pool.shift();
            if (reused) {
                events.push(`reuse:${id}`);
                return { value: { id, node: reused }, created: false };
            }
            if (!allowCreate) return null;
            events.push(`create:${id}`);
            return { value: { id, node: `node-${id}` }, created: true };
        },
        2,
    );

    assert.deepEqual(events, ["release:a", "reuse:c", "create:d", "create:e"]);
    assert.equal(next[0].node, "node-b");
    assert.equal(next[1].node, "node-a");
    assert.equal(next[2].node, "node-d");
    assert.equal(next[3].node, "node-e");
    assert.equal(next[4], null);
});
