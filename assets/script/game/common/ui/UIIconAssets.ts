/** Runtime icon paths relative to assets/bundle/gui/ui-icons. */
export const FEATURE_ICON_ASSETS = {
    equipment: "system-nav/06-storage",
    workshop: "system-nav/03-workshop",
    arkBuild: "system-nav/02-layout",
    research: "system-nav/04-research",
    crew: "system-nav/05-crew",
    intel: "system-nav/01-map",
} as const;

/** Stable semantic icons used by the battle HUD. */
export const BATTLE_HUD_ICON_ASSETS = {
    health: "hud-combat/01-health",
    shield: "hud-combat/02-shield",
    pollution: "hud-combat/04-pollution",
    dayTimer: "hud-combat/05-day-timer",
    minimap: "hud-combat/06-minimap",
    returnArk: "hud-combat/07-ark-return",
    dodge: "hud-combat/08-dodge",
    sprint: "attributes-crafting/06-speed",
    objective: "map-actions/07-objective-pin",
    pause: "system-nav/10-pause",
    map: "system-nav/01-map",
} as const;
