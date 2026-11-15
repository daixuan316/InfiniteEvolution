import assert from "node:assert/strict";
import test from "node:test";

import { HordeDirector, buildHorde } from "../../../assets/script/game/monster/model/HordeDirector.ts";

const CATALOG = [
    { id: "walker", cost: 5, special: false },
    { id: "runner", cost: 10, special: false },
    { id: "brute", cost: 20, special: true },
    { id: "spitter", cost: 15, special: true },
    { id: "screamer", cost: 25, special: true },
    { id: "burrower", cost: 30, special: true },
];

function seededRandom(seed) {
    let state = seed >>> 0;
    return () => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
}

test("horde plans stay inside budget and cap special enemy types for 100 seeds", () => {
    for (let seed = 1; seed <= 100; seed++) {
        const plan = buildHorde({ budget: 100, maxSpecialTypes: 3 }, CATALOG, seededRandom(seed));
        const specialTypes = new Set(plan.units.filter((unit) => unit.special).map((unit) => unit.id));

        assert.ok(plan.spent <= 100, `seed ${seed} overspent its budget`);
        assert.ok(specialTypes.size <= 3, `seed ${seed} selected too many special types`);
        assert.ok(plan.units.length > 0, `seed ${seed} should produce a playable plan`);
    }
});

test("horde director advances all six phases and only completes after cleanup", () => {
    const director = new HordeDirector([
        { phase: "warning", duration: 0.2, units: [], spawnInterval: 1 },
        { phase: "probe", duration: 0.3, units: [{ id: "walker", special: false }], spawnInterval: 0.1 },
        { phase: "assault", duration: 0.3, units: [{ id: "runner", special: false }], spawnInterval: 0.1 },
        { phase: "respite", duration: 0.2, units: [], spawnInterval: 1 },
        { phase: "climax", duration: 0.3, units: [{ id: "brute", special: true }], spawnInterval: 0.1 },
        { phase: "cleanup", duration: Number.POSITIVE_INFINITY, units: [], spawnInterval: 1 },
    ]);

    let activeThreats = 0;
    const seenPhases = new Set([director.phase]);
    const spawned = [];
    for (let frame = 0; frame < 40 && director.phase !== "cleanup"; frame++) {
        const result = director.tick(0.1, activeThreats);
        seenPhases.add(director.phase);
        spawned.push(...result.spawns.map((unit) => unit.id));
        activeThreats += result.spawns.length;
    }

    assert.deepEqual([...seenPhases], ["warning", "probe", "assault", "respite", "climax", "cleanup"]);
    assert.deepEqual(spawned, ["walker", "runner", "brute"]);
    assert.equal(director.completed, false);
    assert.equal(director.remainingThreats(activeThreats), 3);

    director.tick(0.1, 0);
    assert.equal(director.completed, true);
    assert.equal(director.remainingThreats(0), 0);
});

test("respite never spawns new enemies while existing threats keep fighting", () => {
    const director = new HordeDirector([
        { phase: "respite", duration: 1, units: [], spawnInterval: 1 },
        { phase: "cleanup", duration: Number.POSITIVE_INFINITY, units: [], spawnInterval: 1 },
    ]);

    const result = director.tick(0.5, 7);

    assert.equal(director.phase, "respite");
    assert.deepEqual(result.spawns, []);
    assert.equal(director.remainingThreats(7), 7);
});
