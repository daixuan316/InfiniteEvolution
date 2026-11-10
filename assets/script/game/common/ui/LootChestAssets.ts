export const LOOT_CHEST_IDS = [
    "supply-crate",
    "armory-crate",
    "bio-crate",
    "heavy-safe",
    "airdrop-crate",
    "hidden-cache",
    "weapon-case",
    "medical-cabinet",
    "scrap-pile",
    "alloy-stack",
    "electronics-cache",
    "energy-cell-crate",
    "fuel-drum",
    "ration-box",
    "blueprint-tube",
    "mutation-pod",
] as const;

export type LootChestId = typeof LOOT_CHEST_IDS[number];
export type LootChestAssetLayer = "world" | "icons";
export type LootChestVisualState = "closed" | "opening" | "opened";

export const LOOT_CHEST_EFFECTS = [
    "interaction-gold-ring",
    "technology-cyan-ring",
    "pollution-magenta-ring",
    "rare-white-gold-star",
    "opening-radial-flash",
    "diamond-particles",
    "reward-upward-trail",
    "completed-soft-glow",
] as const;

export type LootChestEffectId = typeof LOOT_CHEST_EFFECTS[number];

const LOOT_CHEST_ID_SET = new Set<string>(LOOT_CHEST_IDS);

export function isLootChestId(value: string): value is LootChestId {
    return LOOT_CHEST_ID_SET.has(value);
}

export function lootChestAssetPath(
    id: LootChestId,
    layer: LootChestAssetLayer,
    state: LootChestVisualState,
): string {
    return `gui/loot-chests/${layer}/${id}/${state}`;
}

export function lootChestEffectPath(effect: LootChestEffectId): string {
    return `gui/loot-chests/effects/${effect}`;
}
