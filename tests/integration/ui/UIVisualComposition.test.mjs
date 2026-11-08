import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("runtime ships scene art for the ark hub and exploration HUD", () => {
    for (const asset of [
        "assets/bundle/gui/hall/texture/ark-garage.png",
        "assets/bundle/gui/battle-hud/texture/hospital-district.png",
        "assets/bundle/gui/battle-hud/actors/player-fire.png",
        "assets/bundle/gui/battle-hud/actors/walker.png",
        "assets/bundle/gui/battle-hud/actors/runner.png",
        "assets/bundle/gui/battle-hud/actors/brute.png",
    ]) {
        assert.equal(existsSync(asset), true, asset);
        assert.equal(existsSync(`${asset}.meta`), true, `${asset}.meta`);
    }
});

test("UI builder exposes texture-backed surfaces and HUD plates", () => {
    const source = read("assets/script/game/common/ui/UIBuilder.ts");
    assert.match(source, /static async backdrop\(/);
    assert.match(source, /static surface\(/);
    assert.match(source, /static hudPlate\(/);
    assert.match(source, /kind === "large"/);
    assert.match(source, /compositeLargeSurfaceFrame/);
    assert.match(source, /surfaceFramePieces\(size\.width, size\.height\)/);
    assert.match(source, /new Rect\(piece\.source\.x, piece\.source\.y, piece\.source\.width, piece\.source\.height\)/);
    assert.match(source, /Sprite\.Type\.SLICED/);
    assert.match(source, /Sprite\.Type\.SIMPLE/);
    assert.match(source, /textureFrameLayout\(assetPath\)/);
    assert.match(source, /frame\.reset\(/);
});

test("generated button frames crop out guide debris before nine-slice scaling", () => {
    const source = read("assets/script/game/common/ui/TextureFrameLayout.ts");

    assert.match(source, /05-button-primary`\]: \{ x: 22, y: 121, width: 228, height: 110/);
    assert.match(source, /06-button-secondary`\]: \{ x: 27, y: 122, width: 227, height: 109/);
    assert.match(source, /07-button-warning`\]: \{ x: 30, y: 122, width: 222, height: 109/);
    assert.doesNotMatch(source, /05-button-primary`\]: \{ x: 20, y: 17/);
    assert.doesNotMatch(source, /06-button-secondary`\]: \{ x: 0, y: 0/);
});

test("wide navigation buttons use a horizontal icon and label layout", () => {
    const source = read("assets/script/game/common/ui/UIBuilder.ts");

    assert.match(source, /const wide = size\.width >= size\.height \* 2/);
    assert.match(source, /wide \? -size\.width \/ 2 \+ 44/);
    assert.match(source, /wide \? 24 : 0/);
});

test("non-sliced art supports aspect-safe contain and cover fitting", () => {
    const source = read("assets/script/game/common/ui/UIBuilder.ts");

    assert.match(source, /export type SpriteFit = "stretch" \| "contain" \| "cover"/);
    assert.match(source, /fit === "cover" \? Math\.max/);
    assert.match(source, /fit === "contain" \? Math\.min/);
    assert.match(source, /this\.sprite\(parent, assetPath, size, Vec3\.ZERO, false, tint, "cover"\)/);
});

test("pause and confirmation overlays keep the authored texture language", () => {
    const pause = read("assets/script/game/ui/PauseOverlayViewComp.ts");
    const confirm = read("assets/script/game/ui/ConfirmDialogViewComp.ts");
    for (const source of [pause, confirm]) {
        assert.match(source, /UIBuilder\.surface/);
        assert.match(source, /UIBuilder\.navButton/);
    }
    assert.match(confirm, /"DialogPanel", new Size\(610, 330\), Vec3\.ZERO, "large"/);
    assert.doesNotMatch(confirm, /"DialogPanel", new Size\(610, 330\), Vec3\.ZERO, "warning"/);
});

test("hall composes the generated ark art with textured game panels", () => {
    const source = read("assets/script/game/hall/HallViewComp.ts");
    assert.match(source, /gui\/hall\/texture\/ark-garage/);
    assert.match(source, /gui\/hall\/texture\/ark-base/);
    assert.match(source, /UIBuilder\.surface/);
    assert.match(source, /UIBuilder\.navButton/);
    for (const marker of [
        "TopResourceRail",
        "ArkStatusHeader",
        "CoreStatusModule",
        "PowerStatusModule",
        "ModuleSlotLights",
        "ThreatHazardPlate",
        "ThreatCountdownModule",
        "EnergyRail",
    ]) {
        assert.match(source, new RegExp(marker), marker);
    }
    assert.match(source, /filledSegments/);
    assert.match(source, /hud-combat\/01-health/);
    assert.match(source, /hud-combat\/02-shield/);
});

test("feature pages use module-specific visual workspaces instead of metric-only placeholders", () => {
    const source = read("assets/script/game/ui/FeaturePageViewComp.ts");
    assert.match(source, /FEATURE_VISUALS/);
    assert.match(source, /renderWorkspace/);
    assert.match(source, /UIBuilder\.surface/);
    assert.match(source, /UIBuilder\.slot/);
});

test("battle HUD renders over world art and uses authored P0 HUD frames", () => {
    const source = read("assets/script/game/battle/BattleHUDViewComp.ts");
    assert.match(source, /gui\/battle-hud\/texture\/hospital-district/);
    assert.match(source, /exploration-hud\/01-player-health-frame/);
    assert.match(source, /exploration-hud\/05-day-timer-frame/);
    assert.match(source, /exploration-hud\/09-minimap-bezel/);
    assert.match(source, /battle-hud\/actors\/player-fire/);
    assert.match(source, /battle-hud\/actors\/(walker|runner|brute)/);
    assert.doesNotMatch(source, /WorldPlaceholder|renderWorldGuides/);
});
