import assert from "node:assert/strict";
import test from "node:test";

import {
    PLAYER_COLLISION_RADIUS,
    PLAYER_PRESENTATION_SIZE,
    enemyActorPresentation,
} from "../../../assets/script/game/battle/BattleActorPresentation.ts";

test("actor presentation fits the 96 pixel street grid", () => {
    assert.equal(PLAYER_PRESENTATION_SIZE, 104);
    assert.equal(PLAYER_COLLISION_RADIUS, 22);
    assert.deepEqual({
        walker: enemyActorPresentation("walker").size,
        runner: enemyActorPresentation("runner").size,
        mutant: enemyActorPresentation("mutant").size,
        brute: enemyActorPresentation("brute").size,
    }, { walker: 78, runner: 82, mutant: 90, brute: 118 });
});

test("actor collision radii leave clearance inside two-cell streets", () => {
    assert.deepEqual({
        walker: enemyActorPresentation("walker").collisionRadius,
        runner: enemyActorPresentation("runner").collisionRadius,
        mutant: enemyActorPresentation("mutant").collisionRadius,
        brute: enemyActorPresentation("brute").collisionRadius,
    }, { walker: 18, runner: 18, mutant: 20, brute: 28 });
    assert.ok(enemyActorPresentation("brute").healthBarWidth > enemyActorPresentation("walker").healthBarWidth);
});
