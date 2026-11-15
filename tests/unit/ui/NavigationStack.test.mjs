import assert from "node:assert/strict";
import test from "node:test";

import { NavigationStack } from "../../../assets/script/game/common/ui/NavigationStack.ts";

test("push and pop preserve the Hall root", () => {
    const stack = new NavigationStack();
    stack.reset({ route: "Hall" });
    stack.push({ route: "Equipment" });

    assert.equal(stack.current?.route, "Equipment");
    assert.equal(stack.pop()?.route, "Hall");
    assert.equal(stack.pop()?.route, "Hall");
});

test("duplicate pushes do not create duplicate pages", () => {
    const stack = new NavigationStack();
    stack.reset({ route: "Hall" });
    stack.push({ route: "Equipment" });
    stack.push({ route: "Equipment" });

    assert.deepEqual(stack.snapshot().pages.map((item) => item.route), ["Hall", "Equipment"]);
});

test("back closes the top overlay before popping a page", () => {
    const stack = new NavigationStack();
    stack.reset({ route: "Hall" });
    stack.push({ route: "BattleHUD" });
    stack.openOverlay({ route: "Pause" });

    assert.deepEqual(stack.back(), { kind: "overlay", entry: { route: "Pause" } });
    assert.equal(stack.current?.route, "BattleHUD");
});

test("replace removes the previous full-screen route", () => {
    const stack = new NavigationStack();
    stack.reset({ route: "Hall" });
    stack.replace({ route: "BattleHUD" });

    assert.deepEqual(stack.snapshot().pages.map((item) => item.route), ["BattleHUD"]);
});

test("reset clears overlays and installs a new root", () => {
    const stack = new NavigationStack();
    stack.reset({ route: "Hall" });
    stack.openOverlay({ route: "Pause" });
    stack.reset({ route: "BattleHUD" });

    assert.deepEqual(stack.snapshot(), {
        pages: [{ route: "BattleHUD" }],
        overlays: [],
    });
});
