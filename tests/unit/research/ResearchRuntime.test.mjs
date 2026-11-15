import assert from "node:assert/strict";
import test from "node:test";

import { RESEARCH_DEFINITIONS } from "../../../assets/script/game/research/model/ResearchCatalog.ts";
import { ResearchRuntime } from "../../../assets/script/game/research/model/ResearchRuntime.ts";

class MemoryResearchStorage {
    constructor(initial) {
        this.value = initial;
        this.saves = [];
    }

    load() {
        return this.value;
    }

    save(state) {
        this.value = structuredClone(state);
        this.saves.push(structuredClone(state));
    }
}

const independentNodes = [
    { id: "a", durationSeconds: 10 },
    { id: "b", durationSeconds: 20 },
    { id: "c", durationSeconds: 30 },
    { id: "d", durationSeconds: 40 },
].map((node) => ({
    ...node,
    branch: "mechanical",
    tier: 1,
    name: node.id.toUpperCase(),
    description: "independent test node",
    cost: 1,
    prerequisites: [],
    effects: [{ stat: "maxHealth", add: 1 }],
}));

function save(overrides = {}) {
    return {
        version: 1,
        points: 8,
        completed: [],
        queue: [],
        lastObservedAtMs: 0,
        ...overrides,
    };
}

test("new research runtime starts with eight points", () => {
    const runtime = new ResearchRuntime(RESEARCH_DEFINITIONS, new MemoryResearchStorage());

    assert.equal(runtime.snapshot(1_000).points, 8);
});

test("start research deducts its cost once and queues an absolute finish time", () => {
    const storage = new MemoryResearchStorage();
    const runtime = new ResearchRuntime(RESEARCH_DEFINITIONS, storage);

    const result = runtime.startResearch("mech_plating_1", 1_000_000);

    assert.equal(result.ok, true);
    assert.deepEqual(result.entry, { nodeId: "mech_plating_1", finishAtMs: 1_020_000 });
    assert.equal(runtime.snapshot(1_000_000).points, 7);
    assert.equal(storage.saves.length, 1);
});

test("rejected research commands never mutate points or queue", () => {
    const runtime = new ResearchRuntime(RESEARCH_DEFINITIONS, new MemoryResearchStorage());
    assert.equal(runtime.startResearch("mech_plating_1", 1_000).ok, true);
    const before = runtime.snapshot(1_000);

    assert.deepEqual(runtime.startResearch("missing", 1_000), { ok: false, reason: "unknown" });
    assert.deepEqual(runtime.startResearch("mech_plating_1", 1_000), { ok: false, reason: "queued" });
    assert.deepEqual(runtime.startResearch("mech_servo_2", 1_000), { ok: false, reason: "prerequisite" });
    assert.deepEqual(runtime.snapshot(1_000), before);
});

test("insufficient points reject research without changing state", () => {
    const runtime = new ResearchRuntime(RESEARCH_DEFINITIONS, new MemoryResearchStorage(save({ points: 0 })));
    const before = runtime.snapshot(5_000);

    assert.deepEqual(runtime.startResearch("bio_tissue_1", 5_000), { ok: false, reason: "points" });
    assert.deepEqual(runtime.snapshot(5_000), before);
});

test("the fourth queued research is rejected without charging its cost", () => {
    const runtime = new ResearchRuntime(independentNodes, new MemoryResearchStorage(save({ points: 10 })));
    runtime.startResearch("a", 1_000_000);
    runtime.startResearch("b", 1_000_000);
    runtime.startResearch("c", 1_000_000);
    const before = runtime.snapshot(1_000_000);

    assert.deepEqual(runtime.startResearch("d", 1_000_000), { ok: false, reason: "queue-full" });
    assert.deepEqual(runtime.snapshot(1_000_000), before);
});

test("queued research uses one sequential worker", () => {
    const runtime = new ResearchRuntime(independentNodes, new MemoryResearchStorage(save({ points: 10 })));

    runtime.startResearch("a", 1_000_000);
    runtime.startResearch("b", 1_000_000);
    runtime.startResearch("c", 1_000_000);

    assert.deepEqual(runtime.snapshot(1_000_000).queue, [
        { nodeId: "a", finishAtMs: 1_010_000 },
        { nodeId: "b", finishAtMs: 1_030_000 },
        { nodeId: "c", finishAtMs: 1_060_000 },
    ]);
});

test("offline reconciliation completes every elapsed queue head in order", () => {
    const runtime = new ResearchRuntime(independentNodes, new MemoryResearchStorage(save({ points: 10 })));
    runtime.startResearch("a", 1_000_000);
    runtime.startResearch("b", 1_000_000);
    runtime.startResearch("c", 1_000_000);

    assert.deepEqual(runtime.reconcile(1_035_000), ["a", "b"]);
    const snapshot = runtime.snapshot(1_035_000);
    assert.deepEqual(snapshot.completed, ["a", "b"]);
    assert.deepEqual(snapshot.queue, [{ nodeId: "c", finishAtMs: 1_060_000 }]);
    assert.equal(runtime.nodeStatus("c", 1_035_000), "researching");
});

test("clock rollback never reduces progress or completes research twice", () => {
    const runtime = new ResearchRuntime(independentNodes, new MemoryResearchStorage(save({ points: 10 })));
    runtime.startResearch("a", 1_000_000);
    runtime.startResearch("b", 1_000_000);
    assert.deepEqual(runtime.reconcile(1_015_000), ["a"]);
    const before = runtime.snapshot(1_015_000);

    assert.deepEqual(runtime.reconcile(900_000), []);
    assert.deepEqual(runtime.snapshot(900_000), before);
});

test("save normalization drops unknown duplicate completed and excess queue entries", () => {
    const storage = new MemoryResearchStorage(save({
        points: -4.8,
        completed: ["a", "a", "missing"],
        queue: [
            { nodeId: "a", finishAtMs: 20_000 },
            { nodeId: "b", finishAtMs: 30_000 },
            { nodeId: "b", finishAtMs: 40_000 },
            { nodeId: "missing", finishAtMs: 50_000 },
            { nodeId: "c", finishAtMs: 60_000 },
            { nodeId: "d", finishAtMs: 70_000 },
        ],
        lastObservedAtMs: 10_000,
    }));
    const runtime = new ResearchRuntime(independentNodes, storage);

    assert.deepEqual(runtime.snapshot(10_000), {
        version: 1,
        points: 0,
        completed: ["a"],
        queue: [
            { nodeId: "b", finishAtMs: 30_000 },
            { nodeId: "c", finishAtMs: 60_000 },
            { nodeId: "d", finishAtMs: 70_000 },
        ],
        lastObservedAtMs: 10_000,
    });
});

test("completed nodes aggregate additive multiplicative and bio-load effects", () => {
    const runtime = new ResearchRuntime(RESEARCH_DEFINITIONS, new MemoryResearchStorage(save({
        completed: ["mech_plating_1", "mech_capacitor_3", "bio_tissue_1", "bio_synapse_2"],
        queue: [{ nodeId: "bio_carapace_3", finishAtMs: 100_000 }],
    })));

    assert.deepEqual(runtime.modifiers(10_000), {
        maxHealthAdd: 80,
        maxShieldAdd: 30,
        attackDamageMultiplier: 1.15 * 1.10,
        moveSpeedMultiplier: 1,
    });
    assert.equal(runtime.bioLoad(10_000), 18);
    assert.equal(runtime.nodeStatus("mech_plating_1", 10_000), "completed");
    assert.equal(runtime.nodeStatus("bio_carapace_3", 10_000), "researching");
    assert.equal(runtime.nodeStatus("hybrid_interface_1", 10_000), "available");
    assert.equal(runtime.nodeStatus("hybrid_overdrive_2", 10_000), "locked");
});
