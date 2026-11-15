import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Ark Build owns a dedicated interactive page backed by the Ark runtime", () => {
    const runtime = readFileSync("assets/script/game/common/ui/UIRuntime.ts", "utf8");
    const page = readFileSync("assets/script/game/shelter/ArkBuildViewComp.ts", "utf8");

    assert.match(runtime, /register\(UIID\.ArkBuild, ArkBuildViewComp\)/);
    assert.match(page, /arkRuntime/);
    assert.match(page, /install\(/);
    assert.match(page, /switchLayout\(/);
    assert.match(page, /enqueueRepair\(/);
    assert.match(page, /applyEvolution\(/);
    assert.doesNotMatch(page, /FEATURE_DEMO_VIEW_MODELS/);
});

test("night defense consumes and settles the live Ark snapshot", () => {
    const source = readFileSync("assets/script/game/battle/NightDefenseViewComp.ts", "utf8");
    assert.match(source, /arkRuntime\.service\.createBattleSnapshot\(\)/);
    assert.match(source, /arkSnapshot/);
    assert.match(source, /simulation\.arkModules/);
    assert.match(source, /tryEmergencyPower/);
    assert.match(source, /tryRemoteRepair/);
    assert.match(source, /tryOverload/);
    assert.match(source, /arkRuntime\.settleBattle/);
});
