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

test("Hall requires an Intel target before exploration", () => {
    const source = readFileSync("assets/script/game/hall/HallViewComp.ts", "utf8");

    assert.match(source, /decideIntelDeparture\(intelRuntime\.selectedTarget\)/);
    assert.match(source, /push\(UIID\.Intel\)/);
    assert.match(source, /replace\(UIID\.BattleHUD, \{ targetId: decision\.targetId \}\)/);
    for (const name of ["IntelTargetSummary", "IntelTargetName", "IntelTargetRisk"]) {
        assert.match(source, new RegExp(`\\b${name}\\b`), name);
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
    for (const route of ["Crew"]) {
        assert.match(source, new RegExp(`UIPageBootstrap\\.register\\(UIID\\.${route}, FeaturePageViewComp\\)`), route);
    }
    assert.match(source, /UIPageBootstrap\.register\(UIID\.Equipment, EquipmentViewComp\)/);
    assert.match(source, /UIPageBootstrap\.register\(UIID\.Workshop, WorkshopViewComp\)/);
    assert.match(source, /UIPageBootstrap\.register\(UIID\.ArkBuild, ArkBuildViewComp\)/);
    assert.match(source, /UIPageBootstrap\.register\(UIID\.Research, ResearchViewComp\)/);
    assert.match(source, /UIPageBootstrap\.register\(UIID\.Intel, IntelPageViewComp\)/);
});

test("Intel uses a dedicated interactive page", () => {
    const source = readFileSync("assets/script/game/intel/IntelPageViewComp.ts", "utf8");

    for (const name of ["TabMap", "TabMission", "TabEvent", "TabHorde", "BtnSetTarget"]) {
        assert.match(source, new RegExp(`\\b${name}\\b`), name);
    }
    assert.match(source, /intelRuntime\.selectTarget/);
    assert.match(source, /GameEvent\.IntelTargetChanged/);
    assert.match(source, /uiNavigation\.back\(\)/);
});

test("Hall has a runtime Ark illustration", () => {
    assert.equal(existsSync("assets/bundle/gui/hall/texture/ark-base.png"), true);
});

test("Battle HUD uses icon-only controls and does not construct a skill control", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /BATTLE_HUD_ICON_ASSETS\.sprint/);
    assert.match(source, /BATTLE_HUD_ICON_ASSETS\.dodge/);
    assert.match(source, /BATTLE_HUD_ICON_ASSETS\.objective/);
    assert.match(source, /BATTLE_HUD_ICON_ASSETS\.pause/);
    assert.match(source, /BATTLE_HUD_ICON_ASSETS\.returnArk/);
    assert.doesNotMatch(source, /"SkillAction"|"SkillGlyph"|"技能"/);
    assert.doesNotMatch(source, /"ActionGlyph"|"DodgeGlyph"|"疾跑"|"翻滚"/);
});
