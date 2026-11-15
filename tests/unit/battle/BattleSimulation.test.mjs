import assert from "node:assert/strict";
import test from "node:test";

import { createHospitalDistrictMap } from "../../../assets/script/game/battle/BattleMapModel.ts";
import { BattleSimulation } from "../../../assets/script/game/battle/BattleSimulation.ts";

function advance(simulation, seconds, step = 1 / 60) {
    for (let elapsed = 0; elapsed < seconds; elapsed += step) simulation.update(step);
}

test("finite hospital map keeps its authored enemy composition", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    assert.deepEqual(simulation.enemies.map((enemy) => enemy.kind), ["walker", "runner", "mutant", "brute"]);
});

test("research modifiers change only player combat stats", () => {
    const base = new BattleSimulation(createHospitalDistrictMap());
    const upgraded = new BattleSimulation(createHospitalDistrictMap(), {
        playerModifiers: {
            maxHealthAdd: 80,
            maxShieldAdd: 50,
            attackDamageMultiplier: 1.15,
            moveSpeedMultiplier: 1.08,
        },
    });

    assert.equal(upgraded.player.vitality.maxHealth, 500);
    assert.equal(upgraded.player.vitality.maxShield, 230);
    assert.equal(upgraded.playerAttackDamage, 35 * 1.15);
    assert.equal(upgraded.player.speed, 270 * 1.08);
    assert.equal(upgraded.enemies[0].vitality.maxHealth, base.enemies[0].vitality.maxHealth);
    assert.equal(upgraded.structures[0].vitality.maxHealth, base.structures[0].vitality.maxHealth);
});

test("player follows a cached route to a distant destination", () => {
    const map = createHospitalDistrictMap();
    const simulation = new BattleSimulation(map);
    const target = map.cellToWorld(map.pointsOfInterest.at(-1).cell);

    assert.equal(simulation.setPlayerDestination(target), true);
    assert.ok(simulation.playerPath.length > 2);
    advance(simulation, 25);

    assert.ok(Math.hypot(simulation.player.x - target.x, simulation.player.y - target.y) < map.tileSize * 0.35);
    assert.equal(map.isWorldWalkable(simulation.player, simulation.playerRadius), true);
});

test("direct movement is axis-resolved and cannot enter blocked map cells", () => {
    const map = createHospitalDistrictMap();
    const simulation = new BattleSimulation(map);
    simulation.setMoveInput(-1, -1);
    advance(simulation, 20);

    assert.equal(map.isWorldWalkable(simulation.player, simulation.playerRadius), true);
    assert.ok(simulation.player.x >= -map.worldWidth / 2);
    assert.ok(simulation.player.y >= -map.worldHeight / 2);
});

test("enemies pursue the player through walkable routes", () => {
    const map = createHospitalDistrictMap();
    const simulation = new BattleSimulation(map);
    const enemy = simulation.enemies[0];
    const before = Math.hypot(enemy.x - simulation.player.x, enemy.y - simulation.player.y);

    advance(simulation, 8);
    const after = Math.hypot(enemy.x - simulation.player.x, enemy.y - simulation.player.y);

    assert.ok(after < before);
    assert.equal(map.isWorldWalkable(enemy, enemy.radius), true);
});

test("sprinting increases travel speed without changing collision rules", () => {
    const map = createHospitalDistrictMap();
    const walking = new BattleSimulation(map);
    const sprinting = new BattleSimulation(map);
    walking.setMoveInput(1, 0);
    sprinting.setMoveInput(1, 0);
    sprinting.setSprinting(true);

    advance(walking, 0.5);
    advance(sprinting, 0.5);

    assert.ok(sprinting.player.x - map.cellToWorld(map.start).x > walking.player.x - map.cellToWorld(map.start).x);
    assert.equal(map.isWorldWalkable(sprinting.player, sprinting.playerRadius), true);
});

test("dodge uses the current move direction, respects collision, and has a cooldown", () => {
    const map = createHospitalDistrictMap();
    const simulation = new BattleSimulation(map);
    const start = { ...simulation.player };
    simulation.setMoveInput(1, 0);

    assert.equal(simulation.tryDodge(), true);
    assert.ok(simulation.player.x > start.x + 100);
    assert.equal(simulation.tryDodge(), false);
    assert.equal(map.isWorldWalkable(simulation.player, simulation.playerRadius), true);
    advance(simulation, 1);
    assert.equal(simulation.tryDodge(), true);
    assert.equal(map.isWorldWalkable(simulation.player, simulation.playerRadius), true);
});

test("successful dodge opens a playback window and bumps the dodge counter", () => {
    const map = createHospitalDistrictMap();
    const simulation = new BattleSimulation(map);
    simulation.setMoveInput(1, 0);

    const countBefore = simulation.playerDodgeCount;
    assert.equal(simulation.tryDodge(), true);
    assert.equal(simulation.playerDodgeCount, countBefore + 1);
    assert.ok(simulation.playerDodgePlayback > 0);

    advance(simulation, 1);
    assert.equal(simulation.playerDodgePlayback, 0);
    assert.equal(simulation.playerDodgeCount, countBefore + 1);
});

test("player moving state follows direct input and path following", () => {
    const map = createHospitalDistrictMap();
    const simulation = new BattleSimulation(map);

    simulation.update(1 / 60);
    assert.equal(simulation.playerMoving, false);

    simulation.setMoveInput(1, 0);
    simulation.update(1 / 60);
    assert.equal(simulation.playerMoving, true);

    simulation.setMoveInput(0, 0);
    simulation.update(1 / 60);
    assert.equal(simulation.playerMoving, false);

    const target = map.cellToWorld(map.pointsOfInterest.at(-1).cell);
    assert.equal(simulation.setPlayerDestination(target), true);
    simulation.update(1 / 60);
    assert.equal(simulation.playerMoving, true);
});

test("enemies stop at melee range and enter the attacking state instead of stacking on the player", () => {
    const map = createHospitalDistrictMap();
    for (let index = 0; index < map.enemySpawns.length; index++) {
        const simulation = new BattleSimulation(map);
        const enemy = simulation.enemies[index];
        const attackRange = enemy.radius + simulation.playerRadius + simulation.meleeAttackMargin;
        enemy.x = simulation.player.x + attackRange - 1;
        enemy.y = simulation.player.y;

        simulation.update(1 / 60);
        const enemyDistance = Math.hypot(enemy.x - simulation.player.x, enemy.y - simulation.player.y);
        assert.equal(enemy.attacking, true);
        assert.ok(enemyDistance <= attackRange + 1, `enemy ${enemy.id} at ${enemyDistance} should hold at range ${attackRange}`);
        assert.ok(enemyDistance > simulation.playerRadius + enemy.radius, `enemy ${enemy.id} must not overlap the player`);
        assert.equal(map.isWorldWalkable(enemy, enemy.radius), true);
    }
});

test("auto-attack only locks a target while an enemy is inside weapon range", () => {
    const map = createHospitalDistrictMap();
    const simulation = new BattleSimulation(map);

    simulation.update(1 / 60);
    assert.equal(simulation.playerAutoAttacking, false);
    assert.equal(simulation.playerTarget, null);

    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + simulation.autoAttackRange - 20;
    enemy.y = simulation.player.y;
    simulation.update(1 / 60);

    assert.equal(simulation.playerAutoAttacking, true);
    assert.equal(simulation.playerTarget?.id, enemy.id);
    const targetDistance = Math.hypot(simulation.playerTarget.x - simulation.player.x, simulation.playerTarget.y - simulation.player.y);
    assert.ok(targetDistance <= simulation.autoAttackRange);
});

test("player auto-fire damages and kills only active enemies", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + 100;
    enemy.y = simulation.player.y;

    const before = enemy.vitality.currentHealth;
    advance(simulation, 0.4);
    assert.ok(enemy.vitality.currentHealth < before);

    advance(simulation, 5);
    assert.equal(enemy.vitality.state, "dead");
    assert.equal(simulation.activeEnemies.includes(enemy), false);
    assert.notEqual(simulation.playerTarget?.id, enemy.id);
});

test("loot requires proximity and grants its rewards only once", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const loot = simulation.loot[0];

    assert.equal(simulation.interact(loot.id).accepted, false);
    simulation.player.x = loot.x;
    simulation.player.y = loot.y;

    const first = simulation.interact(loot.id);
    assert.equal(first.accepted, true);
    assert.equal(loot.opened, true);
    assert.ok(Object.values(simulation.resources).some((amount) => amount > 0));
    assert.equal(simulation.interact(loot.id).accepted, false);
});

test("nearest interaction ignores hidden loot and reports the closest available action", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const visible = simulation.loot.find((item) => item.discovered);
    const hidden = simulation.loot.find((item) => !item.discovered);

    simulation.player.x = hidden.x;
    simulation.player.y = hidden.y;
    assert.equal(simulation.nearestInteraction, null);

    simulation.player.x = visible.x;
    simulation.player.y = visible.y;
    assert.deepEqual(simulation.nearestInteraction, {
        id: visible.id,
        category: "loot",
        name: visible.name,
        action: "open",
        distance: 0,
    });
});

test("radar investigation reveals hidden loot without opening it", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const hidden = simulation.loot.find((item) => item.typeId === "hidden-cache");
    const radar = simulation.explorationPoints.find((item) => item.typeId === "radar-terminal");

    assert.equal(hidden.discovered, false);
    simulation.player.x = radar.x;
    simulation.player.y = radar.y;
    assert.equal(simulation.interact(radar.id).accepted, true);
    assert.equal(hidden.discovered, true);
    assert.equal(hidden.opened, false);
    assert.equal(simulation.interact(radar.id).accepted, false);
});

test("player prioritizes enemies then auto-fires at and destroys a nearby barrier", () => {
    const map = createHospitalDistrictMap();
    const simulation = new BattleSimulation(map);
    const barrier = simulation.structures[0];
    const enemy = simulation.enemies[0];

    simulation.player.x = barrier.x - 180;
    simulation.player.y = barrier.y;
    enemy.x = simulation.player.x + 100;
    enemy.y = simulation.player.y;
    simulation.update(1 / 60);
    assert.equal(simulation.playerTarget?.id, enemy.id);

    for (const activeEnemy of simulation.activeEnemies) activeEnemy.vitality.applyDamage(9999);
    const barrierHealth = barrier.vitality.currentHealth;
    for (let index = 0; index < 300 && barrier.vitality.active; index++) simulation.update(1 / 60);

    assert.ok(barrier.vitality.currentHealth < barrierHealth);
    assert.equal(barrier.vitality.active, false);
    assert.equal(barrier.vitality.state, "destroyed");
    assert.equal(simulation.playerTarget, null);
    for (const cell of map.barriers[0].blockedCells) assert.equal(map.isWalkable(cell), true);
});

test("downed player cannot move, dodge, or attack", () => {
    const map = createHospitalDistrictMap();
    const simulation = new BattleSimulation(map);
    simulation.player.vitality.applyDamage(9999);
    const before = { x: simulation.player.x, y: simulation.player.y };
    simulation.setMoveInput(1, 0);
    simulation.setSprinting(true);

    assert.equal(simulation.tryDodge(), false);
    assert.equal(simulation.setPlayerDestination({ x: before.x + 200, y: before.y }), false);
    advance(simulation, 1);
    assert.deepEqual({ x: simulation.player.x, y: simulation.player.y }, before);
    assert.equal(simulation.playerAutoAttacking, false);
    assert.equal(simulation.playerTarget, null);
});

test("player shots create a projectile and do not damage before impact", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + 280;
    enemy.y = simulation.player.y;
    const before = enemy.vitality.currentHealth;

    simulation.update(1 / 60);

    assert.equal(simulation.projectiles.length, 1);
    assert.equal(enemy.vitality.currentHealth, before);
    advance(simulation, 0.08);
    assert.equal(enemy.vitality.currentHealth, before);
});

test("projectile damages once on arrival and is removed", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + 280;
    enemy.y = simulation.player.y;
    const before = enemy.vitality.currentHealth;

    simulation.update(1 / 60);
    for (let index = 0; index < 30 && enemy.vitality.currentHealth === before; index++) {
        simulation.update(1 / 60);
    }

    assert.ok(enemy.vitality.currentHealth < before);
    assert.equal(simulation.projectiles.length, 0);
    const afterImpact = enemy.vitality.currentHealth;
    simulation.update(1 / 60);
    assert.equal(enemy.vitality.currentHealth, afterImpact);
});

test("projectile disappears without damage when its target dies first", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + 280;
    enemy.y = simulation.player.y;
    simulation.update(1 / 60);
    assert.equal(simulation.projectiles.length, 1);

    enemy.vitality.applyDamage(9999);
    simulation.update(1 / 60);

    assert.equal(simulation.projectiles.length, 0);
});

test("projectile expires after its maximum lifetime", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + 280;
    enemy.y = simulation.player.y;
    simulation.update(1 / 60);
    enemy.x += 5000;

    advance(simulation, simulation.projectileLifetime + 0.1);

    assert.equal(simulation.projectiles.length, 0);
    assert.equal(enemy.vitality.currentHealth, enemy.vitality.maxHealth);
});

test("projectile impact emits actual health damage", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.x = simulation.player.x + 180;
    enemy.y = simulation.player.y;

    for (let index = 0; index < 30 && simulation.hitEvents.length === 0; index++) {
        simulation.update(1 / 60);
    }

    const event = simulation.hitEvents[0];
    assert.equal(event.kind, "projectile");
    assert.equal(event.sourceId, "player");
    assert.equal(event.targetId, enemy.id);
    assert.equal(event.shieldDamage, 0);
    assert.equal(event.healthDamage, event.amount);
    const movementTolerance = enemy.speed / 60 + 1e-9;
    assert.ok(Math.abs(event.x - enemy.x) <= movementTolerance);
    assert.ok(Math.abs(event.y - enemy.y) <= movementTolerance);
});

test("melee event reports shield absorption and clears next frame", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    const attackRange = enemy.radius + simulation.player.radius + simulation.meleeAttackMargin;
    enemy.x = simulation.player.x + attackRange - 1;
    enemy.y = simulation.player.y;

    simulation.update(1 / 60);
    const event = simulation.hitEvents.find((candidate) => candidate.kind === "melee");
    assert.ok(event);
    assert.equal(event.targetId, "player");
    assert.ok(event.shieldDamage > 0);
    assert.equal(event.healthDamage, 0);
    assert.equal(event.amount, event.shieldDamage);
    const eventId = event.id;

    simulation.update(1 / 60);
    assert.equal(simulation.hitEvents.some((candidate) => candidate.id === eventId), false);
});

test("lethal projectile marks its hit event as a zero transition", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    enemy.vitality.currentHealth = 1;
    enemy.x = simulation.player.x + 120;
    enemy.y = simulation.player.y;

    for (let index = 0; index < 30 && simulation.hitEvents.length === 0; index++) {
        simulation.update(1 / 60);
    }

    assert.equal(simulation.hitEvents[0].becameZero, true);
    assert.equal(enemy.vitality.state, "dead");
});

test("night horde warns before dynamically spawning its first wave", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const initialEnemyCount = simulation.enemies.length;

    assert.equal(simulation.startHorde(7), true);
    assert.equal(simulation.startHorde(7), false);
    assert.equal(simulation.hordePhase, "warning");

    advance(simulation, 4.8);
    assert.equal(simulation.enemies.length, initialEnemyCount);

    advance(simulation, 0.5);
    assert.equal(simulation.hordePhase, "probe");
    assert.ok(simulation.enemies.length > initialEnemyCount);
    assert.ok(simulation.remainingHordeThreats >= simulation.activeEnemies.length);
    assert.equal(new Set(simulation.enemies.map((enemy) => enemy.id)).size, simulation.enemies.length);
});
