import assert from "node:assert/strict";
import test from "node:test";

import { createArkDefenseMap } from "../../../assets/script/game/battle/ArkDefenseMap.ts";
import { BattleSimulation } from "../../../assets/script/game/battle/BattleSimulation.ts";

function advance(simulation, seconds, step = 1 / 60) {
    for (let elapsed = 0; elapsed < seconds; elapsed += step) simulation.update(step);
}

test("night defense begins at the Ark with no exploration enemies before warning", () => {
    const map = createArkDefenseMap();
    const simulation = new BattleSimulation(map, {
        spawnInitialEnemies: false,
        arkCore: { position: map.cellToWorld(map.extraction), maxHealth: 1800, defense: 35, radius: 88 },
    });

    assert.equal(simulation.enemies.length, 0);
    assert.equal(simulation.structures.length, 1);
    assert.equal(simulation.structures[0].kind, "ark-core");
    assert.equal(simulation.playerTarget, null);
    assert.equal(simulation.startHorde(1), true);

    advance(simulation, 4.8);
    assert.equal(simulation.enemies.length, 0);
    advance(simulation, 0.5);
    assert.ok(simulation.enemies.length > 0);
});

test("player auto-fire never treats the Ark core as a hostile target", () => {
    const map = createArkDefenseMap();
    const simulation = new BattleSimulation(map, {
        spawnInitialEnemies: false,
        arkCore: { position: map.cellToWorld(map.extraction), maxHealth: 1800, defense: 35, radius: 88 },
    });

    simulation.update(1 / 60);

    assert.equal(simulation.playerTarget, null);
    assert.equal(simulation.projectiles.length, 0);
});
