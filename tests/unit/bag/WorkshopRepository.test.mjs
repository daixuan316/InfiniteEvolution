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

class MarkerFailingStore extends MapStore {
    setItem(key, value) {
        if (key === "infinite-evolution.workshop.initialized") throw new Error("marker unavailable");
        super.setItem(key, value);
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

test("any existing corrupt payload prevents starter inventory duplication", () => {
    const store = new MapStore({ "infinite-evolution.workshop.v1": "{bad" });

    assert.equal(new LocalStorageWorkshopRepository(store).load().initialized, true);
});

test("the durable snapshot overrides a conflicting false initialized flag", () => {
    const raw = JSON.stringify({ version: 1, initialized: false, workshopLevel: 1, inventory: { scrap: 4 }, tasks: [] });
    const store = new MapStore({
        "infinite-evolution.workshop.v1": raw,
        "infinite-evolution.workshop.initialized": "1",
    });

    const loaded = new LocalStorageWorkshopRepository(store).load();
    assert.equal(loaded.initialized, true);
    assert.deepEqual(loaded.inventory, { scrap: 4 });
});

test("a marker write failure never turns a committed snapshot into a failed save", () => {
    const store = new MarkerFailingStore();
    const repository = new LocalStorageWorkshopRepository(store);
    const expected = { version: 1, initialized: true, workshopLevel: 1, inventory: { scrap: 9 }, tasks: [] };

    assert.doesNotThrow(() => repository.save(expected));
    assert.deepEqual(repository.load(), expected);
});
