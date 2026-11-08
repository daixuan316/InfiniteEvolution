import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const prefab = JSON.parse(readFileSync("assets/bundle/gui/loading/loading.prefab", "utf8"));

function componentsOf(node) {
    return node._components.map((reference) => prefab[reference.__id__]);
}

test("loading labels use the Cocos 3.8 Label outline API", () => {
    const nodes = prefab.filter((entry) => entry.__type__ === "cc.Node");
    const components = nodes.flatMap(componentsOf);

    assert.equal(
        components.some((component) => component.__type__ === "cc.LabelOutline"),
        false,
        "reachable LabelOutline components make Creator 3.8.8 read deprecated color/width properties",
    );

    const outlinedLabels = components.filter(
        (component) => component.__type__ === "cc.Label" && component._enableOutline,
    );
    assert.equal(outlinedLabels.length, 2);
    for (const label of outlinedLabels) {
        assert.equal(label._outlineWidth, 2);
        assert.deepEqual(label._outlineColor, {
            __type__: "cc.Color",
            r: 0,
            g: 0,
            b: 0,
            a: 255,
        });
    }
});
