import assert from "node:assert/strict";
import test from "node:test";

import { LocalStorageWorkshopRepository } from "../../../assets/script/game/bag/workshop/WorkshopRepository.ts";

class MapStore {
    values;

    constructor(initial = {}) {
        this.values = new Map(Object.entries(initial));
    }

    getItem(key) {
        return this.values.get(key) ?? null;
    }

    setItem(key, value) {
        this.values.set(key, value);
    }

    removeItem(key) {
        this.values.delete(key);
    }
}

test("local repository round-trips a versioned snapshot", () => {
    const store = new MapStore();
    const repository = new LocalStorageWorkshopRepository(store);
    const expected = {
        version: 1,
        initialized: true,
        workshopLevel: 1,
        inventory: { scrap: 7 },
        tasks: [],
    };

    repository.save(expected);

    assert.deepEqual(repository.load(), expected);
});

test("corrupt JSON keeps the separate initialized marker", () => {
    const store = new MapStore({
        "infinite-evolution.workshop.v1": "{bad",
        "infinite-evolution.workshop.initialized": "1",
    });

    assert.deepEqual(new LocalStorageWorkshopRepository(store).load(), {
        version: 1,
        initialized: true,
        workshopLevel: 1,
        inventory: {},
        tasks: [],
    });
});

test("missing data returns null when a save was never initialized", () => {
    assert.equal(new LocalStorageWorkshopRepository(new MapStore()).load(), null);
});
