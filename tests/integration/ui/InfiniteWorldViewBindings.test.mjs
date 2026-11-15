import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("daytime exploration view constructs and renders the streamed infinite world", async () => {
    const source = await readFile("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /createInfiniteExplorationMap\(\{ worldSeed: WORLD_SEED, deltas: this\.worldDeltas \}\)/);
    assert.match(source, /persistentWorldDeltas\(WORLD_SEED\)/);
    assert.match(source, /persistWorldDeltas\(this\.worldDeltas\)/);
    assert.match(source, /refreshChunkViews\(\)/);
    assert.match(source, /residential-district-a/);
    assert.match(source, /neighborhood-commercial-a/);
    assert.match(source, /chunkNodePools/);
    assert.match(source, /enemyNodePools/);
    assert.match(source, /lootNodePool/);
    assert.match(source, /reconcileEnemyNodes\(\)/);
    assert.match(source, /refreshRoadClosures/);
    assert.doesNotMatch(source, /this\.map\.worldWidth\s*\/\s*3/);
});

test("daytime exploration uses a player-centered map projection", async () => {
    const source = await readFile("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /localMapPosition/);
    assert.match(source, /createDiscoveredMapProjection/);
    assert.match(source, /discoveredChunkKeys\(\)/);
    assert.match(source, /discoveredChunkMap\(key\)/);
    assert.match(source, /this\.simulation\.player/);
});
