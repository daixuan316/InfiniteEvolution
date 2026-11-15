import assert from "node:assert/strict";
import test from "node:test";

import { createDefaultArkState } from "../../../assets/script/game/shelter/model/ArkCatalog.ts";
import { ArkRepository } from "../../../assets/script/game/shelter/model/ArkRepository.ts";

test("repository round-trips state through injected storage", () => {
    const memory = new Map();
    const repository = new ArkRepository({
        getItem: (key) => memory.get(key) ?? null,
        setItem: (key, value) => memory.set(key, value),
    });
    const state = createDefaultArkState();
    state.resources.scrap = 77;
    repository.save(state);
    assert.equal(repository.load().resources.scrap, 77);
});

test("corrupt JSON recovers a playable default", () => {
    const repository = new ArkRepository({ getItem: () => "{bad", setItem: () => undefined });
    const state = repository.load();
    assert.equal(state.activeLayoutId, "alpha");
    assert.equal(state.modules.length, 10);
});
