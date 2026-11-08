import assert from "node:assert/strict";
import test from "node:test";

import { createInfiniteExplorationMap } from "../../../assets/script/game/battle/InfiniteBattleMap.ts";
import { BattleSimulation } from "../../../assets/script/game/battle/BattleSimulation.ts";

test("moving across active windows refreshes content without duplicate stable ids", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    const simulation = new BattleSimulation(map, { spawnInitialEnemies: false });
    const firstIds = new Set(simulation.loot.map((item) => item.id));
    const initialRevision = simulation.worldRevision;

    simulation.player.x += 1344 * 3;
    simulation.update(0);

    assert.ok(simulation.worldRevision > initialRevision);
    assert.equal(new Set(simulation.loot.map((item) => item.id)).size, simulation.loot.length);
    assert.ok([...firstIds].every((id) => !simulation.loot.some((item) => item.id === id)));
});

test("opened loot survives chunk recycling through sparse deltas", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    const simulation = new BattleSimulation(map, { spawnInitialEnemies: false });
    const target = simulation.loot[0];
    simulation.player.x = target.x;
    simulation.player.y = target.y;
    simulation.update(0);
    assert.equal(simulation.interact(target.id).accepted, true);
    assert.equal(map.deltas.getObjectDelta(target.id.split(":loot:")[0], target.id)?.opened, true);

    simulation.player.x += 1344 * 4;
    simulation.update(0);
    assert.equal(simulation.loot.some((item) => item.id === target.id), false);

    simulation.player.x = target.x;
    simulation.player.y = target.y;
    simulation.update(0);
    const restored = simulation.loot.find((item) => item.id === target.id);
    assert.ok(restored);
    assert.equal(restored.opened, true);
    assert.equal(simulation.interact(target.id).accepted, false);
});

test("streamed enemies use coordinate-stable ids and do not respawn on same-window updates", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    const simulation = new BattleSimulation(map);
    const initialIds = simulation.enemies.map((enemy) => enemy.id);
    simulation.update(0);
    simulation.update(0);
    assert.deepEqual(simulation.enemies.map((enemy) => enemy.id), initialIds);
    assert.equal(new Set(initialIds).size, initialIds.length);
    assert.ok(initialIds.every((id) => id.startsWith("chunk-enemy:")));
});

test("defeated streamed enemies stay cleared after leaving and revisiting a chunk", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    const simulation = new BattleSimulation(map);
    const victim = simulation.enemies[0];
    const victimCell = map.worldToCell(victim);
    victim.vitality.applyDamage(99_999);

    simulation.player.x += 1344 * 4;
    simulation.update(0);
    assert.equal(map.readObjectDelta(victimCell, victim.id)?.destroyed, true);

    simulation.player.x = map.cellToWorld(map.start).x;
    simulation.update(0);
    assert.equal(simulation.enemies.some((enemy) => enemy.id === victim.id), false);
});
