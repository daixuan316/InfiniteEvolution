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

test("sunset returns from exploration before the shelter defense starts", () => {
    const exploration = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    const defense = readFileSync("assets/script/game/battle/NightDefenseViewComp.ts", "utf8");
    const runtime = readFileSync("assets/script/game/common/ui/UIRuntime.ts", "utf8");

    assert.match(exploration, /replace\(UIID\.NightDefense/);
    assert.doesNotMatch(exploration, /simulation\.startHorde/);
    assert.match(defense, /createArkDefenseMap/);
    assert.match(defense, /simulation\.startHorde/);
    assert.match(defense, /gui\/hall\/texture\/ark-(garage|base)/);
    assert.match(runtime, /UIPageBootstrap\.register\(UIID\.NightDefense, NightDefenseViewComp\)/);
});

test("Battle HUD binds exploration objects, interaction action, notices, and map markers", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");

    assert.match(source, /renderExplorationObjects\(\)/);
    assert.match(source, /nearestInteraction/);
    assert.match(source, /simulation\.interact\(/);
    assert.match(source, /consumeNoticeEvents\(\)/);
    assert.match(source, /simulation\.loot/);
    assert.match(source, /simulation\.explorationPoints/);
    assert.match(source, /findCombatTarget\(projectile\.targetId\)/);
});

test("Battle HUD binds generated loot states and starts effects only after accepted loot", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");

    assert.match(source, /lootChestAssetPath/);
    assert.match(source, /isLootChestId/);
    assert.match(source, /lootChestEffectProfile/);
    assert.match(source, /advanceLootChestOpening/);
    assert.match(source, /lootOpeningRemaining = new Map<string, number>/);
    assert.match(source, /lootChestAssetPath\(typeId, "world", state\)/);
    assert.match(source, /lootChestAssetPath\(typeId, "icons", "closed"\)/);
    assert.match(source, /if \(!result\.accepted\) return;[\s\S]*lootOpeningRemaining\.set/);
});

test("Battle HUD consumes and tracks the selected Intel target", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");

    assert.match(source, /findIntelTarget\(this\.params\.targetId\)/);
    assert.match(source, /findIntelTarget\("hospital"\)/);
    assert.match(source, /new IntelTargetTracker/);
    assert.match(source, /progress\.becameReached/);
    assert.match(source, /GameEvent\.IntelTargetReached/);
    assert.match(source, /drawIntelTargetMarker/);
});
