import assert from "node:assert/strict";
import test from "node:test";

import { WorldDeltaStore } from "../../../assets/script/game/world/infinite/WorldDeltaStore.ts";

test("snapshot stores only changed objects and round-trips signed chunks", () => {
    const store = new WorldDeltaStore(1907);
    store.setObjectDelta("-8:3", "loot:lot:2:5", { opened: true });
    store.setObjectDelta("-8:3", "barrier:west", { destroyed: true });
    store.markLandmarkDiscovered("hospital:-8:3");
    store.markChunkDiscovered("-8:3", { roadCells: [{ x: 0, y: 3 }], landmarkIds: ["hospital:-8:3"] });
    store.setPlayerPosition({ x: -10_420, y: 2_496 });

    const serialized = JSON.parse(JSON.stringify(store.snapshot()));
    const restored = WorldDeltaStore.restore(serialized);

    assert.deepEqual(restored.getObjectDelta("-8:3", "loot:lot:2:5"), { opened: true });
    assert.deepEqual(restored.getObjectDelta("-8:3", "barrier:west"), { destroyed: true });
    assert.equal(restored.isLandmarkDiscovered("hospital:-8:3"), true);
    assert.deepEqual(restored.playerPosition(), { x: -10_420, y: 2_496 });
    assert.deepEqual(restored.discoveredChunkKeys(), ["-8:3"]);
    assert.deepEqual(restored.discoveredChunkMap("-8:3"), { roadCells: [{ x: 0, y: 3 }], landmarkIds: ["hospital:-8:3"] });
    assert.equal(restored.snapshot().chunks["0:0"], undefined);
});

test("version one snapshots migrate without discarding sparse changes", () => {
    const restored = WorldDeltaStore.restore({
        schemaVersion: 1,
        generationVersion: 1,
        worldSeed: 1907,
        chunks: { "2:-1": { "loot:a": { opened: true } } },
        discoveredLandmarks: ["hospital:2:-1"],
    });
    assert.deepEqual(restored.getObjectDelta("2:-1", "loot:a"), { opened: true });
    assert.equal(restored.isLandmarkDiscovered("hospital:2:-1"), true);
    assert.equal(restored.playerPosition(), null);
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
    assert.throws(() => WorldDeltaStore.restore({ schemaVersion: 3 }), /schema/);
    assert.throws(() => WorldDeltaStore.restore({
        schemaVersion: 2,
        generationVersion: 1,
        worldSeed: 1,
        playerPosition: null,
        discoveredChunks: [],
        chunks: { "bad-key": {} },
        discoveredLandmarks: [],
    }), /chunk key/);
    assert.throws(() => WorldDeltaStore.restore({
        schemaVersion: 2,
        generationVersion: 1,
        worldSeed: 1,
        playerPosition: null,
        discoveredChunks: [],
        chunks: { "0:0": { "": { opened: true } } },
        discoveredLandmarks: [],
    }), /object id/);
});
