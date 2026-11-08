import assert from "node:assert/strict";
import test from "node:test";

import { IntelRuntime } from "../../../assets/script/game/intel/model/IntelRuntime.ts";

test("runtime accepts known targets and resolves the full definition", () => {
    const runtime = new IntelRuntime();

    assert.equal(runtime.selectTarget("depot"), true);
    assert.equal(runtime.selectedTargetId, "depot");
    assert.equal(runtime.selectedTarget?.locationName, "物资仓库");
});

test("unknown targets do not overwrite the current selection", () => {
    const runtime = new IntelRuntime();

    runtime.selectTarget("hospital");
    assert.equal(runtime.selectTarget("missing"), false);
    assert.equal(runtime.selectedTargetId, "hospital");

    runtime.clear();
    assert.equal(runtime.selectedTarget, null);
});
