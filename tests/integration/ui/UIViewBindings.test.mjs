import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

test("Hall exposes seven stable navigation actions", () => {
    const source = readFileSync("assets/script/game/hall/HallViewComp.ts", "utf8");
    for (const name of ["BtnEquipment", "BtnWorkshop", "BtnArkBuild", "BtnResearch", "BtnCrew", "BtnIntel", "BtnDepart"]) {
        assert.match(source, new RegExp(`\\b${name}\\b`), name);
    }
    for (const route of ["Equipment", "Workshop", "ArkBuild", "Research", "Crew", "Intel", "BattleHUD"]) {
        assert.match(source, new RegExp(`UIID\\.${route}\\b`), route);
    }
});

test("feature pages use one back action through the navigation service", () => {
    const source = readFileSync("assets/script/game/ui/FeaturePageViewComp.ts", "utf8");
    assert.match(source, /BtnBack/);
    assert.match(source, /uiNavigation\.back\(\)/);
    assert.match(source, /FEATURE_DEMO_VIEW_MODELS/);
});

test("runtime registers Hall and every feature page controller", () => {
    const source = readFileSync("assets/script/game/common/ui/UIRuntime.ts", "utf8");
    assert.match(source, /UIPageBootstrap\.register\(UIID\.Hall, HallViewComp\)/);
    for (const route of ["Equipment", "Workshop", "ArkBuild", "Research", "Crew", "Intel"]) {
        assert.match(source, new RegExp(`UIPageBootstrap\\.register\\(UIID\\.${route}, FeaturePageViewComp\\)`), route);
    }
});

test("Hall has a runtime Ark illustration", () => {
    assert.equal(existsSync("assets/bundle/gui/hall/texture/ark-base.png"), true);
});
