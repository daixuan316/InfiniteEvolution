import type {
    LootChestEffectId,
    LootChestId,
    LootChestVisualState,
} from "../common/ui/LootChestAssets.ts";

export const LOOT_CHEST_OPENING_SECONDS = 0.48;

export interface LootChestEffectProfile {
    readonly ring: LootChestEffectId;
    readonly burst: LootChestEffectId;
}

const TECH_LOOT = new Set<LootChestId>([
    "armory-crate",
    "electronics-cache",
    "energy-cell-crate",
    "blueprint-tube",
]);

const BIO_LOOT = new Set<LootChestId>([
    "bio-crate",
    "mutation-pod",
]);

const RARE_LOOT = new Set<LootChestId>([
    "heavy-safe",
    "airdrop-crate",
    "hidden-cache",
    "weapon-case",
]);

export function lootChestVisualState(opened: boolean, openingRemaining: number): LootChestVisualState {
    if (!opened) return "closed";
    return openingRemaining > 0 ? "opening" : "opened";
}

export function advanceLootChestOpening(remaining: number, deltaTime: number): number {
    return Math.max(0, remaining - Math.max(0, deltaTime));
}

export function lootChestEffectProfile(typeId: LootChestId): LootChestEffectProfile {
    const ring: LootChestEffectId = BIO_LOOT.has(typeId)
        ? "pollution-magenta-ring"
        : TECH_LOOT.has(typeId)
            ? "technology-cyan-ring"
            : "interaction-gold-ring";
    return {
        ring,
        burst: RARE_LOOT.has(typeId) ? "rare-white-gold-star" : "opening-radial-flash",
    };
}
