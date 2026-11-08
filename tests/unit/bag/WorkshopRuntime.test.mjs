import assert from "node:assert/strict";
import test from "node:test";

import { WorkshopRuntime } from "../../../assets/script/game/bag/WorkshopRuntime.ts";
import { MemoryWorkshopRepository } from "../../../assets/script/game/bag/workshop/WorkshopRepository.ts";
import { WorkshopService } from "../../../assets/script/game/bag/workshop/WorkshopService.ts";

test("runtime publishes inventory and queue changes after enqueue", () => {
    const events = [];
    const service = new WorkshopService({
        repository: new MemoryWorkshopRepository(),
        idFactory: () => "runtime-task",
    });
    const runtime = new WorkshopRuntime(service, () => 1_000_000, (event, payload) => events.push([event, payload]));

    assert.equal(runtime.enqueue("assault_rifle").ok, true);
    assert.deepEqual(events.map(([event]) => event), ["InventoryChanged", "WorkshopQueueChanged"]);
    assert.equal(events[1][1].taskId, "runtime-task");
});

test("runtime publishes each offline completion once", () => {
    let now = 1_000_000;
    const events = [];
    const service = new WorkshopService({ repository: new MemoryWorkshopRepository(), idFactory: () => "task-1" });
    const runtime = new WorkshopRuntime(service, () => now, (event, payload) => events.push([event, payload]));
    runtime.enqueue("assault_rifle");
    events.length = 0;

    now = 1_045_000;
    assert.deepEqual(runtime.sync().completedRecipeIds, ["assault_rifle"]);
    assert.deepEqual(events.map(([event]) => event), ["InventoryChanged", "WorkshopQueueChanged", "CraftCompleted"]);
    events.length = 0;
    runtime.sync();
    assert.deepEqual(events, []);
});
