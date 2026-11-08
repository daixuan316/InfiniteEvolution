import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("assets/script/game/initialize/bll/InitRes.ts", "utf8");

test("optional font loading awaits the Oops promise without a callback wrapper", () => {
    assert.doesNotMatch(source, /new Promise<void>\(\(resolve\)/);
    assert.match(source, /await oops\.res\.load\("language\/font\/" \+ oops\.language\.current, Font\)/);
});

test("the optional font step always advances the initialization queue", () => {
    const loadCustom = source.slice(source.indexOf("private loadCustom"), source.indexOf("private loadLanguage"));
    assert.match(loadCustom, /catch\s*\{/);
    assert.match(loadCustom, /next\(\);/);
});

test("the common window prefab has a matching script UUID", () => {
    const prefab = readFileSync("assets/bundle/common/prefab/window.prefab", "utf8");
    const script = readFileSync("assets/script/game/common/view/WindowViewComp.ts", "utf8");
    const meta = readFileSync("assets/script/game/common/view/WindowViewComp.ts.meta", "utf8");

    assert.match(prefab, /653bf8VPC5Fn49zFJFqXVgx/);
    assert.match(meta, /653bff15-3c2e-459f-8f73-14916a5d5831/);
    assert.match(script, /class WindowViewComp/);
    assert.match(script, /lab_title/);
    assert.match(script, /onTouchEnd/);
    assert.match(source, /import "\.\.\/\.\.\/common\/view\/WindowViewComp"/);
});

test("startup does not block Hall entry on legacy common asset preloading", () => {
    const entityEnter = source.slice(source.indexOf("entityEnter"), source.indexOf("queue.play()"));
    assert.doesNotMatch(entityEnter, /loadCommon/);
    assert.match(entityEnter, /this\.onComplete\(queue, e\)/);
});
