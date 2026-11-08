import assert from "node:assert/strict";
import test from "node:test";

import { WorldDeltaStore } from "../../../assets/script/game/world/infinite/WorldDeltaStore.ts";

test("snapshot stores only changed objects and round-trips signed chunks", () => {
    const store = new WorldDeltaStore(1907);
    store.setObjectDelta("-8:3", "loot:lot:2:5", { opened: true });
    store.setObjectDelta("-8:3", "barrier:west", { destroyed: true });
    store.markLandmarkDiscovered("hospital:-8:3");

    const serialized = JSON.parse(JSON.stringify(store.snapshot()));
    const restored = WorldDeltaStore.restore(serialized);

    assert.deepEqual(restored.getObjectDelta("-8:3", "loot:lot:2:5"), { opened: true });
    assert.deepEqual(restored.getObjectDelta("-8:3", "barrier:west"), { destroyed: true });
    assert.equal(restored.isLandmarkDiscovered("hospital:-8:3"), true);
    assert.equal(restored.snapshot().chunks["0:0"], undefined);
});

test("empty changes are removed instead of bloating the save", () => {
    const store = new WorldDeltaStore(77);
    store.setObjectDelta("2:-4", "loot:a", { opened: true });
    store.setObjectDelta("2:-4", "loot:a", {});
    assert.equal(store.getObjectDelta("2:-4", "loot:a"), undefined);
    assert.equal(store.snapshot().chunks["2:-4"], undefined);
});

test("returned deltas and snapshots cannot mutate live state", () => {
    const store = new WorldDeltaStore(77);
    store.setObjectDelta("1:1", "event:signal", { eventStage: "active" });

    const delta = store.getObjectDelta("1:1", "event:signal");
    delta.eventStage = "complete";
    const snapshot = store.snapshot();
    snapshot.chunks["1:1"]["event:signal"].eventStage = "failed";

    assert.deepEqual(store.getObjectDelta("1:1", "event:signal"), { eventStage: "active" });
});

test("restore rejects incompatible or malformed snapshots", () => {
    assert.throws(() => WorldDeltaStore.restore({ schemaVersion: 2 }), /schema/);
    assert.throws(() => WorldDeltaStore.restore({
        schemaVersion: 1,
        generationVersion: 1,
        worldSeed: 1,
        chunks: { "bad-key": {} },
        discoveredLandmarks: [],
    }), /chunk key/);
    assert.throws(() => WorldDeltaStore.restore({
        schemaVersion: 1,
        generationVersion: 1,
        worldSeed: 1,
        chunks: { "0:0": { "": { opened: true } } },
        discoveredLandmarks: [],
    }), /object id/);
});
