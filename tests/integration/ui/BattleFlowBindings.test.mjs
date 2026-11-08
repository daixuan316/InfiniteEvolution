import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Battle HUD exposes pause and return actions", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /BtnPause/);
    assert.match(source, /BtnReturnArk/);
    assert.match(source, /openOverlay\(UIID\.PauseOverlay/);
    assert.match(source, /openOverlay\(UIID\.ConfirmDialog/);
});

test("pause can resume or request a confirmed return", () => {
    const source = readFileSync("assets/script/game/ui/PauseOverlayViewComp.ts", "utf8");
    assert.match(source, /BtnContinue/);
    assert.match(source, /closeOverlay\(UIID\.PauseOverlay\)/);
    assert.match(source, /openOverlay\(UIID\.ConfirmDialog/);
});

test("confirmation supports cancel and callback-driven confirm", () => {
    const source = readFileSync("assets/script/game/ui/ConfirmDialogViewComp.ts", "utf8");
    assert.match(source, /BtnCancel/);
    assert.match(source, /BtnConfirm/);
    assert.match(source, /onConfirm/);
    assert.match(source, /closeOverlay\(UIID\.ConfirmDialog\)/);
});

test("runtime registers Battle HUD and both overlay controllers", () => {
    const source = readFileSync("assets/script/game/common/ui/UIRuntime.ts", "utf8");
    assert.match(source, /UIPageBootstrap\.register\(UIID\.BattleHUD, BattleHUDViewComp\)/);
    assert.match(source, /UIPageBootstrap\.register\(UIID\.PauseOverlay, PauseOverlayViewComp\)/);
    assert.match(source, /UIPageBootstrap\.register\(UIID\.ConfirmDialog, ConfirmDialogViewComp\)/);
});
