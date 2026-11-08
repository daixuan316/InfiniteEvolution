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

test("Battle HUD binds player, enemy, and structure vitality", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");

    assert.match(source, /simulation\.player\.vitality/);
    assert.match(source, /enemy\.vitality\.healthRatio/);
    assert.match(source, /simulation\.structures/);
    assert.match(source, /UIBuilder\.setProgressBarRatio/);
    assert.doesNotMatch(source, /\["Walker", "gui\/battle-hud\/actors\/walker", 112, 0\.38\]/);
});

test("dynamic maps exclude dead monsters", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /simulation\.activeEnemies/);
});

test("UI builder exposes reusable progress updates", () => {
    const source = readFileSync("assets/script/game/common/ui/UIBuilder.ts", "utf8");
    assert.match(source, /static setProgressBarRatio\(track: Node, ratio: number\)/);
    assert.match(source, /getChildByName\(`\$\{track\.name\}Fill`\)/);
});

test("Battle HUD renders simulation projectiles", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");

    assert.match(source, /simulation\.projectiles/);
    assert.match(source, /projectileNodes = new Map<string, Node>/);
    assert.match(source, /syncProjectiles\(\)/);
    assert.match(source, /createProjectileNode/);
});

test("Battle HUD consumes hit events into timed feedback", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");

    assert.match(source, /simulation\.hitEvents/);
    assert.match(source, /damageFeedbacks/);
    assert.match(source, /hitFlashRemaining/);
    assert.match(source, /updateCombatFeedback\(deltaTime\)/);
    assert.match(source, /0\.65/);
    assert.match(source, /0\.12/);
});
