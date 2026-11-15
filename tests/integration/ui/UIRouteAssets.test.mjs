import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

const prefabs = [
    "equipment/equipment",
    "workshop/workshop",
    "ark-build/ark-build",
    "research/research",
    "crew/crew",
    "intel/intel",
    "battle-hud/battle-hud",
    "night-defense/night-defense",
    "pause/pause",
    "confirm/confirm",
];

const icons = [
    "system-nav/01-map.png",
    "system-nav/02-layout.png",
    "system-nav/03-workshop.png",
    "system-nav/04-research.png",
    "system-nav/05-crew.png",
    "system-nav/06-storage.png",
    "system-nav/10-pause.png",
    "system-nav/11-resume.png",
    "system-nav/13-exit.png",
    "system-nav/14-confirm.png",
    "system-nav/15-cancel.png",
    "resources-items/01-scrap.png",
    "resources-items/02-alloy.png",
    "resources-items/04-energy-cell.png",
    "hud-combat/01-health.png",
    "hud-combat/02-shield.png",
    "hud-combat/04-pollution.png",
    "hud-combat/05-day-timer.png",
    "hud-combat/06-minimap.png",
    "hud-combat/07-ark-return.png",
];

test("every first-stage route has an independent prefab", () => {
    for (const prefab of prefabs) {
        assert.equal(existsSync(`assets/bundle/gui/${prefab}.prefab`), true, prefab);
    }
});

test("selected runtime icons are available inside the bundle", () => {
    for (const icon of icons) {
        assert.equal(existsSync(`assets/bundle/gui/ui-icons/${icon}`), true, icon);
    }
});
