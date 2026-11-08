import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("research service persists versioned progression through the Oops storage boundary", () => {
    const source = read("assets/script/game/research/ResearchService.ts");

    assert.match(source, /implements ResearchStorage/);
    assert.match(source, /research\.progression\.v1/);
    assert.match(source, /oops\.storage\.getJson/);
    assert.match(source, /oops\.storage\.set/);
    assert.match(source, /new ResearchRuntime\(RESEARCH_DEFINITIONS/);
});

test("battle creation reconciles research and passes permanent player modifiers", () => {
    const source = read("assets/script/game/battle/BattleHUDViewComp.ts");

    assert.match(source, /researchRuntime\.modifiers\(Date\.now\(\)\)/);
    assert.match(source, /playerModifiers:/);
});

test("research route uses a dedicated interactive page", () => {
    const runtime = read("assets/script/game/common/ui/UIRuntime.ts");
    const page = read("assets/script/game/research/ResearchViewComp.ts");

    assert.match(runtime, /import \{ ResearchViewComp \}/);
    assert.match(runtime, /register\(UIID\.Research, ResearchViewComp\)/);
    assert.doesNotMatch(runtime, /register\(UIID\.Research, FeaturePageViewComp\)/);
    for (const marker of ["机械", "生存", "生化", "混合", "ResearchNode", "QueueSlot", "BtnStartResearch"]) {
        assert.match(page, new RegExp(marker), marker);
    }
    assert.match(page, /for \(let index = 0; index < 3; index \+= 1\)/);
    assert.match(page, /startResearch\(this\.selectedNodeId, Date\.now\(\)\)/);
    assert.match(page, /formatCountdown/);
    assert.match(page, /this\.bindTouch\(action/);
});
