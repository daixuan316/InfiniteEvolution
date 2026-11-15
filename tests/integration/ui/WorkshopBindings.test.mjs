import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("runtime registers the dedicated workshop controller", () => {
    const source = read("assets/script/game/common/ui/UIRuntime.ts");

    assert.match(source, /import \{ WorkshopViewComp \}/);
    assert.match(source, /UIPageBootstrap\.register\(UIID\.Workshop, WorkshopViewComp\)/);
    assert.doesNotMatch(source, /register\(UIID\.Workshop, FeaturePageViewComp\)/);
});

test("workshop exposes recipe selection, three queue slots, and a working primary action", () => {
    const source = read("assets/script/game/ui/WorkshopViewComp.ts");
    for (const marker of [
        "CategoryRail",
        "RecipeList",
        "RecipePreview",
        "MaterialRequirements",
        "QueueSlot0",
        "QueueSlot1",
        "QueueSlot2",
        "BtnPrimaryAction",
    ]) {
        assert.match(source, new RegExp(marker), marker);
    }
    assert.match(source, /workshopRuntime\.enqueue/);
    assert.match(source, /workshopRuntime\.sync/);
    assert.match(source, /uiNavigation\.back\(\)/);
    assert.match(source, /clearBindings\(\)/);
});

test("workshop runtime provider binds versioned local storage and Oops events", () => {
    const source = read("assets/script/game/bag/WorkshopRuntimeProvider.ts");

    assert.match(source, /LocalStorageWorkshopRepository\(sys\.localStorage\)/);
    assert.match(source, /oops\.message\.dispatchEvent/);
    assert.match(source, /GameEvent\.CraftCompleted/);
});
