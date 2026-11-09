import assert from "node:assert/strict";
import test from "node:test";

import { createInfiniteExplorationMap } from "../../../assets/script/game/battle/InfiniteBattleMap.ts";
import { BattleSimulation } from "../../../assets/script/game/battle/BattleSimulation.ts";
import { WorldDeltaStore } from "../../../assets/script/game/world/infinite/WorldDeltaStore.ts";
import { CHUNK_COLUMNS, CHUNK_ROWS } from "../../../assets/script/game/world/infinite/InfiniteWorldTypes.ts";

function simulationAtChunk(x, y) {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    const position = map.cellToWorld({ x: x * CHUNK_COLUMNS + 7, y: y * CHUNK_ROWS + 3 });
    map.refreshAround(position);
    return new BattleSimulation(map, { playerPosition: position });
}

test("a reconstructed simulation resumes its permanent position and filters defeated initial enemies", () => {
    const deltas = new WorldDeltaStore(1907);
    const position = { x: 1344 * 5 + 720, y: -768 * 3 + 336 };
    deltas.setPlayerPosition(position);
    const map = createInfiniteExplorationMap({ worldSeed: 1907, deltas });
    map.refreshAround(position);
    const defeatedSpawn = map.enemySpawns[0];
    const defeatedId = `chunk-enemy:${defeatedSpawn.x}:${defeatedSpawn.y}`;
    map.writeObjectDelta(defeatedSpawn, defeatedId, { destroyed: true });

    const restoredMap = createInfiniteExplorationMap({ worldSeed: 1907, deltas: WorldDeltaStore.restore(deltas.snapshot()) });
    const simulation = new BattleSimulation(restoredMap, { playerPosition: position });
    assert.deepEqual({ x: simulation.player.x, y: simulation.player.y }, position);
    assert.equal(simulation.enemies.some((enemy) => enemy.id === defeatedId), false);
    assert.ok(restoredMap.activeChunks.some((chunk) => chunk.coordinate.x === 5 && chunk.coordinate.y === -3));
});

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

test("one simulation frame never spends more than the shared preload budget", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    const simulation = new BattleSimulation(map, { spawnInitialEnemies: false });
    const generatedBeforeFrame = map.preloadGeneratedCount;

    simulation.player.x += 1344 * 3;
    simulation.update(0);

    assert.ok(map.preloadGeneratedCount - generatedBeforeFrame <= 6);
});

test("a distant click continues through loaded portal windows instead of generating an unbounded A star", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    const simulation = new BattleSimulation(map, { spawnInitialEnemies: false });
    const destination = map.cellToWorld({ x: CHUNK_COLUMNS * 6 + 7, y: 3 });
    assert.equal(simulation.setPlayerDestination(destination), true);
    for (let step = 0; step < 400; step++) simulation.update(0.1);
    assert.ok(simulation.player.x > CHUNK_COLUMNS * 5 * map.tileSize);
    assert.ok(Math.abs(simulation.player.y - destination.y) < map.tileSize);
});

test("portal routing keeps a destination when the direct preload band has no matching exit", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    const start = map.cellToWorld({ x: CHUNK_COLUMNS * 99 + 7, y: -100 * CHUNK_ROWS + 3 });
    const destination = map.cellToWorld({ x: CHUNK_COLUMNS * 99 + 7, y: -94 * CHUNK_ROWS + 3 });
    const simulation = new BattleSimulation(map, { spawnInitialEnemies: false, playerPosition: start });
    const generatedBeforePath = map.preloadedChunks.length;
    assert.equal(simulation.setPlayerDestination(destination), true);
    assert.equal(map.preloadedChunks.length, generatedBeforePath);
    map.advancePreload(0);
    assert.equal(map.preloadedChunks.length, generatedBeforePath);
    map.advancePreload(1);
    assert.equal(map.preloadedChunks.length, generatedBeforePath + 1);
    assert.ok(simulation.playerPath.length > 1);
    for (let step = 0; step < 500; step++) simulation.update(0.1);
    assert.ok(Math.hypot(simulation.player.x - destination.x, simulation.player.y - destination.y) <= map.tileSize);
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

test("undefeated streamed enemies keep their seeded kind after recycling", () => {
    const map = createInfiniteExplorationMap({ worldSeed: 1907 });
    const simulation = new BattleSimulation(map);
    const initialKinds = new Map(simulation.enemies.map((enemy) => [enemy.id, enemy.kind]));

    simulation.player.x += 1344 * 4;
    simulation.update(0);
    simulation.player.x = map.cellToWorld(map.start).x;
    simulation.update(0);

    for (const enemy of simulation.enemies) {
        assert.equal(enemy.kind, initialKinds.get(enemy.id), enemy.id);
    }
});

test("streamed enemy health scales from its chunk while combat stats stay fixed", () => {
    const nearEnemies = simulationAtChunk(0, 0).enemies;
    const farEnemies = simulationAtChunk(8, 0).enemies;
    const near = nearEnemies.find((candidate) => farEnemies.some((enemy) => enemy.kind === candidate.kind));
    assert.ok(near);
    const far = farEnemies.find((candidate) => candidate.kind === near.kind);
    assert.ok(far);
    assert.ok(far.vitality.maxHealth > near.vitality.maxHealth);
    assert.ok(far.vitality.maxHealth <= near.vitality.maxHealth * 3);
    assert.equal(far.attackDamage, near.attackDamage);
    assert.equal(far.speed, near.speed);
    assert.equal(far.defense, near.defense);
});

test("exploration actors use compact collision radii for two-cell streets", () => {
    const simulation = simulationAtChunk(0, 0);
    assert.equal(simulation.player.radius, 22);
    const expectedRadius = { walker: 18, runner: 18, mutant: 20, brute: 28 };
    for (const enemy of simulation.enemies) assert.equal(enemy.radius, expectedRadius[enemy.kind]);
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
