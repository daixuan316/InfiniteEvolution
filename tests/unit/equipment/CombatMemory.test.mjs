import assert from "node:assert/strict";
import test from "node:test";

import { EQUIPMENT_CATALOG } from "../../../assets/script/game/equipment/config/EquipmentCatalog.ts";
import { createStarterEquipmentState } from "../../../assets/script/game/equipment/config/StarterEquipment.ts";
import { availableEvolutionIds, chooseEvolution, recordMemory } from "../../../assets/script/game/equipment/model/CombatMemory.ts";

test("epic weapon unlocks both configured paths after their independent thresholds", () => {
    const state = createStarterEquipmentState();
    let item = state.instances.find((candidate) => candidate.templateId === "weapon_assault");
    item = recordMemory(item, { kind: "closeHit", amount: 20 });
    item = recordMemory(item, { kind: "weakpointHit", amount: 25 });

    assert.deepEqual(availableEvolutionIds(item, EQUIPMENT_CATALOG).sort(), ["assault_path_a", "assault_path_b"]);
    const chosen = chooseEvolution(item, "assault_path_b", EQUIPMENT_CATALOG);
    assert.equal(chosen.ok, true);
    assert.equal(chosen.value.evolutionId, "assault_path_b");
});

test("common weapon does not accumulate memory or select an evolution", () => {
    const state = createStarterEquipmentState();
    const item = { ...state.instances[2], quality: "common", memory: structuredClone(state.instances[2].memory) };
    const recorded = recordMemory(item, { kind: "closeHit", amount: 10 });

    assert.deepEqual(recorded.memory, item.memory);
    assert.deepEqual(chooseEvolution(recorded, "shotgun_path_a", EQUIPMENT_CATALOG), { ok: false, error: "unavailable-evolution" });
});
