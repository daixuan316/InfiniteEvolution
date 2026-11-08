import assert from "node:assert/strict";
import test from "node:test";

import { MemoryWorkshopRepository } from "../../../assets/script/game/bag/workshop/WorkshopRepository.ts";
import { WorkshopService } from "../../../assets/script/game/bag/workshop/WorkshopService.ts";

const NOW = 1_000_000;

function snapshot(inventory, tasks = []) {
    return { version: 1, initialized: true, workshopLevel: 1, inventory, tasks };
}

function makeService(inventory, repository = new MemoryWorkshopRepository(), capacity = 80) {
    if (inventory !== undefined) repository.save(snapshot(inventory));
    let sequence = 0;
    return new WorkshopService({
        repository,
        capacity,
        idFactory: () => `task-${++sequence}`,
    });
}

test("enqueue atomically consumes materials and creates a timed task", () => {
    const service = makeService();

    const result = service.enqueue("assault_rifle", NOW);

    assert.equal(result.ok, true);
    assert.equal(result.task.id, "task-1");
    assert.equal(result.task.endsAt, 1_045_000);
    assert.equal(service.inventory.count("scrap"), 90);
    assert.equal(service.inventory.count("mechanical_parts"), 25);
    assert.equal(service.inventory.count("electronics"), 25);
});

test("missing materials are rejected without changing inventory", () => {
    const service = makeService({ scrap: 29, mechanical_parts: 20, electronics: 5 });
    const before = service.inventory.toSnapshot();

    assert.deepEqual(service.enqueue("assault_rifle", NOW), { ok: false, reason: "materials-missing" });
    assert.deepEqual(service.inventory.toSnapshot(), before);
    assert.deepEqual(service.getTasks(), []);
});

test("a fourth task is rejected without consuming materials", () => {
    const service = makeService({ scrap: 500, medical_supplies: 100 });
    service.enqueue("medkit", NOW);
    service.enqueue("medkit", NOW);
    service.enqueue("medkit", NOW);
    const before = service.inventory.toSnapshot();

    assert.deepEqual(service.enqueue("medkit", NOW), { ok: false, reason: "queue-full" });
    assert.deepEqual(service.inventory.toSnapshot(), before);
    assert.equal(service.getTasks().length, 3);
});

test("queued outputs reserve capacity before inputs are consumed", () => {
    const service = makeService({ scrap: 99, medical_supplies: 99 }, new MemoryWorkshopRepository(), 2);
    const before = service.inventory.toSnapshot();

    assert.deepEqual(service.enqueue("medkit", NOW), { ok: false, reason: "output-full" });
    assert.deepEqual(service.inventory.toSnapshot(), before);
});

test("offline sync grants a completed output exactly once", () => {
    const repository = new MemoryWorkshopRepository();
    const first = makeService(undefined, repository);
    first.enqueue("assault_rifle", NOW);

    const restarted = makeService(undefined, repository);
    assert.deepEqual(restarted.sync(1_045_000).completedRecipeIds, ["assault_rifle"]);
    assert.equal(restarted.inventory.count("assault_rifle"), 1);
    assert.deepEqual(restarted.sync(2_000_000).completedRecipeIds, []);
    assert.equal(restarted.inventory.count("assault_rifle"), 1);
});

test("starter inventory is granted only for the first repository load", () => {
    const repository = new MemoryWorkshopRepository();
    const first = makeService(undefined, repository);
    assert.equal(first.inventory.count("scrap"), 120);
    assert.equal(first.inventory.remove("scrap", 120), true);
    first.persist();

    const restarted = makeService(undefined, repository);
    assert.equal(restarted.inventory.count("scrap"), 0);
});

test("save failure rolls back material consumption and queue insertion", () => {
    const repository = new MemoryWorkshopRepository();
    const service = makeService(undefined, repository);
    const before = service.inventory.toSnapshot();
    repository.failNextSave = true;

    assert.deepEqual(service.enqueue("assault_rifle", NOW), { ok: false, reason: "save-failed" });
    assert.deepEqual(service.inventory.toSnapshot(), before);
    assert.deepEqual(service.getTasks(), []);
});

test("adding gathered items persists and rolls back when saving fails", () => {
    const repository = new MemoryWorkshopRepository();
    const service = makeService(undefined, repository);

    assert.equal(service.addItem("scrap", 5), true);
    assert.equal(makeService(undefined, repository).inventory.count("scrap"), 125);

    repository.failNextSave = true;
    assert.equal(service.addItem("scrap", 5), false);
    assert.equal(service.inventory.count("scrap"), 125);
});

test("external additions cannot consume capacity reserved by queued outputs", () => {
    const service = makeService({ scrap: 8, electronics: 6, alloy: 4 }, new MemoryWorkshopRepository(), 3);
    assert.equal(service.enqueue("energy_cell", NOW).ok, true);

    assert.equal(service.addItem("assault_rifle", 1), true);
    assert.equal(service.addItem("shotgun", 1), true);
    assert.equal(service.addItem("armor_plate", 1), false);
    assert.equal(service.inventory.count("armor_plate"), 0);
});

test("duplicate recipe input rows are aggregated before validation and removal", () => {
    const duplicateRecipe = {
        id: "duplicate_scrap",
        name: "重复废料配方",
        category: "supply",
        icon: "resources-items/01-scrap",
        inputs: [{ itemId: "scrap", amount: 20 }, { itemId: "scrap", amount: 20 }],
        outputId: "medkit",
        outputAmount: 1,
        durationMs: 1_000,
        requiredWorkshopLevel: 1,
    };
    const insufficientRepository = new MemoryWorkshopRepository(snapshot({ scrap: 30 }));
    const insufficient = new WorkshopService({ repository: insufficientRepository, recipes: [duplicateRecipe] });
    assert.deepEqual(insufficient.enqueue("duplicate_scrap", NOW), { ok: false, reason: "materials-missing" });
    assert.equal(insufficient.inventory.count("scrap"), 30);

    const enoughRepository = new MemoryWorkshopRepository(snapshot({ scrap: 50 }));
    const enough = new WorkshopService({ repository: enoughRepository, recipes: [duplicateRecipe], idFactory: () => "duplicate-task" });
    assert.equal(enough.enqueue("duplicate_scrap", NOW).ok, true);
    assert.equal(enough.inventory.count("scrap"), 10);
});

test("over-capacity repair keeps valid entries instead of clearing everything", () => {
    const repository = new MemoryWorkshopRepository(snapshot({ scrap: 1_000, electronics: 5 }));
    const service = makeService(undefined, repository, 1);

    assert.deepEqual(service.inventory.toSnapshot(), { electronics: 5 });
});

test("repair preserves excess paid tasks and offline sync completes all of them", () => {
    const tasks = [1, 2, 3, 4].map((number) => ({
        id: `legacy-${number}`,
        recipeId: "medkit",
        startedAt: 100,
        endsAt: 200,
        status: "crafting",
    }));
    const repository = new MemoryWorkshopRepository(snapshot({}, tasks));
    const service = makeService(undefined, repository);

    assert.equal(service.getTasks().length, 4);
    assert.deepEqual(service.sync(300).completedRecipeIds, ["medkit", "medkit", "medkit", "medkit"]);
    assert.equal(service.inventory.count("medkit"), 4);
});

test("initial persistence failure does not abort runtime construction", () => {
    const repository = new MemoryWorkshopRepository();
    repository.failNextSave = true;

    assert.doesNotThrow(() => makeService(undefined, repository));
});

test("system clock rollback never increases a task beyond its original duration", () => {
    const service = makeService();
    service.enqueue("assault_rifle", NOW);

    assert.equal(service.remainingMs("task-1", NOW - 500_000), 45_000);
    assert.deepEqual(service.sync(NOW - 500_000).completedRecipeIds, []);
    assert.equal(service.getTasks()[0].status, "crafting");
});

test("invalid snapshot quantities are removed during load repair", () => {
    const repository = new MemoryWorkshopRepository(snapshot({ scrap: -5, alloy: 7.5, electronics: 5 }));
    const service = makeService(undefined, repository);

    assert.deepEqual(service.inventory.toSnapshot(), { electronics: 5 });
});

test("an unknown completed recipe stays ready without generating an item", () => {
    const repository = new MemoryWorkshopRepository(snapshot(
        { scrap: 5 },
        [{ id: "legacy-task", recipeId: "removed_recipe", startedAt: 100, endsAt: 200, status: "crafting" }],
    ));
    const service = makeService(undefined, repository);

    assert.deepEqual(service.sync(300).completedRecipeIds, []);
    assert.deepEqual(service.inventory.toSnapshot(), { scrap: 5 });
    assert.equal(service.getTasks()[0].status, "ready");
});
