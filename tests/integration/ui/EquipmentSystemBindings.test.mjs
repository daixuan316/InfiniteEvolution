import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("equipment route uses a real warehouse controller with command bindings", () => {
    const source = readFileSync("assets/script/game/equipment/view/EquipmentViewComp.ts", "utf8");
    for (const name of ["BtnLoadout1", "BtnLoadout2", "BtnLoadout3", "BtnEquip", "BtnUnequip", "BtnFavorite", "BtnLock", "BtnEvolve", "BtnEvolutionB", "BtnSwapWeapons", "BtnSalvage"]) {
        assert.match(source, new RegExp(`\\b${name}\\b`), name);
    }
    assert.match(source, /EquipmentPresenter/);
    assert.doesNotMatch(source, /规则将在后续接入/);
});

test("workshop route exposes all five atomic equipment operations", () => {
    const source = readFileSync("assets/script/game/ui/WorkshopViewComp.ts", "utf8");
    for (const name of ["TabCraft", "TabStrengthen", "TabSynchronize", "TabReroll", "TabSalvage", "BtnEquipmentBlueprints", "BtnConfirmEquipmentCraft", "BtnConfirmWorkshop", "BtnConfirmProtectedSalvage"]) {
        assert.match(source, new RegExp(`\\b${name}\\b`), name);
    }
    assert.match(source, /WorkshopPresenter/);
});

test("runtime registers dedicated equipment and workshop pages", () => {
    const source = readFileSync("assets/script/game/common/ui/UIRuntime.ts", "utf8");
    assert.match(source, /register\(UIID\.Equipment, EquipmentViewComp\)/);
    assert.match(source, /register\(UIID\.Workshop, WorkshopViewComp\)/);
});

test("battle HUD supplies equipment snapshot, weapon swap, and one-time memory settlement", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /equipmentSnapshot:/);
    assert.match(source, /BtnWeaponSwap/);
    assert.match(source, /switchWeapon\(\)/);
    assert.match(source, /drainEquipmentMemoryDeltas/);
    assert.match(source, /recordBattleMemory/);
});
