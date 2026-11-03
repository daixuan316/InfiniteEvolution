import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync("assets/script/game/common/config/GameUIConfig.ts", "utf8");

const routes = [
    ["Equipment", "gui/equipment/equipment"],
    ["Workshop", "gui/workshop/workshop"],
    ["ArkBuild", "gui/ark-build/ark-build"],
    ["Research", "gui/research/research"],
    ["Crew", "gui/crew/crew"],
    ["Intel", "gui/intel/intel"],
    ["BattleHUD", "gui/battle-hud/battle-hud"],
    ["PauseOverlay", "gui/pause/pause"],
    ["ConfirmDialog", "gui/confirm/confirm"],
];

test("first-stage UI IDs and prefab paths stay registered together", () => {
    for (const [uiid, prefab] of routes) {
        assert.match(source, new RegExp(`\\b${uiid}\\b`), `missing UIID.${uiid}`);
        assert.match(source, new RegExp(prefab.replaceAll("/", "\\/")), `missing ${prefab}`);
    }
});

test("full-screen cached pages and transient overlays use distinct lifetime rules", () => {
    for (const uiid of ["Hall", "Equipment", "Workshop", "ArkBuild", "Research", "Crew", "Intel"]) {
        assert.match(source, new RegExp(`UIID\\.${uiid}\\]: \\{[^}]*destroy: false`), uiid);
    }
    for (const uiid of ["BattleHUD", "PauseOverlay", "ConfirmDialog"]) {
        assert.match(source, new RegExp(`UIID\\.${uiid}\\]: \\{[^}]*destroy: true`), uiid);
    }
});
