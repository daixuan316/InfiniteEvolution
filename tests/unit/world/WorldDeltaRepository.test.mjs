import assert from "node:assert/strict";
import test from "node:test";

import { WorldDeltaRepository } from "../../../assets/script/game/world/infinite/WorldDeltaRepository.ts";

class MemoryStore {
    values = new Map();
    get(key) { return this.values.get(key) ?? null; }
    set(key, value) { this.values.set(key, value); }
    remove(key) { this.values.delete(key); }
}

test("world repository persists only the seed snapshot and sparse deltas", () => {
    const storage = new MemoryStore();
    const repository = new WorldDeltaRepository(storage, "world:test");
    const deltas = repository.load(1907);
    deltas.setObjectDelta("12:-8", "loot:cache", { opened: true });
    repository.save(deltas);

    const serialized = JSON.parse(storage.get("world:test:1907"));
    assert.deepEqual(Object.keys(serialized.chunks), ["12:-8"]);
    assert.equal(serialized.activeChunks, undefined);
    assert.deepEqual(repository.load(1907).getObjectDelta("12:-8", "loot:cache"), { opened: true });
});

test("world repository safely starts a new seed when data is corrupt or incompatible", () => {
    const storage = new MemoryStore();
    const repository = new WorldDeltaRepository(storage, "world:test");
    storage.set("world:test:7", "not-json");
    assert.equal(repository.load(7).worldSeed, 7);
    assert.equal(storage.get("world:test:7"), "not-json");
    assert.equal(storage.get("world:test:7:incompatible"), "not-json");

    const oldSeed = repository.load(11);
    repository.save(oldSeed);
    assert.equal(repository.load(12).worldSeed, 12);
    assert.deepEqual(Object.keys(repository.load(12).snapshot().chunks), []);
    assert.notEqual(storage.get("world:test:11"), null);
});
