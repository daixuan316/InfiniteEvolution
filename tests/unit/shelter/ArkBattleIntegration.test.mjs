import assert from "node:assert/strict";
import test from "node:test";

import { createArkDefenseMap } from "../../../assets/script/game/battle/ArkDefenseMap.ts";
import { BattleSimulation } from "../../../assets/script/game/battle/BattleSimulation.ts";
import { createDefaultArkState } from "../../../assets/script/game/shelter/model/ArkCatalog.ts";
import { buildArkBattleSnapshot } from "../../../assets/script/game/shelter/model/ArkRules.ts";

function advance(simulation, seconds, step = 1 / 60) {
    for (let elapsed = 0; elapsed < seconds; elapsed += step) simulation.update(step);
}

test("night defense materializes installed Ark modules and powered turret fires", () => {
    const map = createArkDefenseMap();
    const snapshot = buildArkBattleSnapshot(createDefaultArkState());
    const simulation = new BattleSimulation(map, {
        spawnInitialEnemies: false,
        arkSnapshot: snapshot,
        arkCore: { position: map.cellToWorld(map.extraction), maxHealth: snapshot.coreMaxDurability, defense: 35, radius: 88 },
    });

    assert.deepEqual(simulation.arkModules.map((item) => item.instanceId), ["armor-1", "turret-mg-1", "generator-1"]);
    simulation.startHorde(1);
    advance(simulation, 14);
    assert.ok(simulation.hitEvents.some((event) => event.sourceId === "turret-mg-1") || simulation.enemies.some((enemy) => !enemy.vitality.active));
});

test("emergency power, remote repair and settlement preserve module identity", () => {
    const map = createArkDefenseMap();
    const state = createDefaultArkState();
    state.modules.find((item) => item.instanceId === "turret-mg-1").durability = 10;
    const snapshot = buildArkBattleSnapshot(state);
    const simulation = new BattleSimulation(map, {
        spawnInitialEnemies: false,
        arkSnapshot: snapshot,
        arkCore: { position: map.cellToWorld(map.extraction), maxHealth: 1000, defense: 35, radius: 88 },
    });

    assert.equal(simulation.tryRemoteRepair("turret-mg-1"), true);
    assert.ok(simulation.arkModules.find((item) => item.instanceId === "turret-mg-1").vitality.currentHealth > 10);
    const settlement = simulation.createArkSettlement("night-test");
    assert.equal(settlement.battleId, "night-test");
    assert.ok(settlement.moduleDurability.some((item) => item.instanceId === "turret-mg-1"));
});

test("higher Ark noise creates a larger deterministic horde budget", () => {
    const map = createArkDefenseMap();
    const quiet = buildArkBattleSnapshot(createDefaultArkState());
    const loud = { ...quiet, hordeMultiplier: 1.5 };
    const quietBattle = new BattleSimulation(map, { spawnInitialEnemies: false, arkSnapshot: quiet });
    const loudBattle = new BattleSimulation(map, { spawnInitialEnemies: false, arkSnapshot: loud });
    quietBattle.startHorde(9);
    loudBattle.startHorde(9);
    assert.ok(loudBattle.remainingHordeThreats > quietBattle.remainingHordeThreats);
});

test("battle settlement only charges energy cells that emergency actions consumed", () => {
    const map = createArkDefenseMap();
    const snapshot = buildArkBattleSnapshot(createDefaultArkState());
    const untouched = new BattleSimulation(map, { spawnInitialEnemies: false, arkSnapshot: snapshot });
    assert.equal(untouched.createArkSettlement("untouched").resourceDeltas.energyCell, 0);

    const repaired = new BattleSimulation(map, { spawnInitialEnemies: false, arkSnapshot: snapshot });
    const turret = repaired.arkModules.find((item) => item.instanceId === "turret-mg-1");
    turret.vitality.applyDamage(10);
    assert.equal(repaired.tryRemoteRepair(turret.instanceId), true);
    assert.equal(repaired.createArkSettlement("repaired").resourceDeltas.energyCell, -1);
});

test("powered weapon modules can consume emergency energy for a timed overload", () => {
    const map = createArkDefenseMap();
    const snapshot = buildArkBattleSnapshot(createDefaultArkState());
    const simulation = new BattleSimulation(map, { spawnInitialEnemies: false, arkSnapshot: snapshot });
    const turret = simulation.arkModules.find((item) => item.instanceId === "turret-mg-1");
    assert.equal(simulation.tryOverload(turret.instanceId), true);
    assert.ok(turret.overloadRemaining > 0);
    assert.equal(simulation.tryOverload(turret.instanceId), false);
    assert.equal(simulation.createArkSettlement("overload").resourceDeltas.energyCell, -1);
});
