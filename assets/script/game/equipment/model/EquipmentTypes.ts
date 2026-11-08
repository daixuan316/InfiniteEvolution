export type EquipmentSlot = "primary1" | "primary2" | "helmet" | "armor" | "gloves" | "boots" | "tactical" | "organ";
export type TemplateSlot = "weapon" | Exclude<EquipmentSlot, "primary1" | "primary2">;
export type WeaponClass = "assault" | "smg" | "shotgun" | "sniper" | "lmg" | "grenade" | "flame" | "arc" | "bio";
export type EquipmentQuality = "common" | "fine" | "rare" | "epic" | "legendary" | "mutated";
export type ResonanceTag = "thunder" | "sentinel" | "machine" | "mutation" | "wasteland" | "heavy";
export type MemoryKind = "closeHit" | "weakpointHit" | "swapChain" | "arkDefenseKill" | "statusProc" | "highPollutionUse";
export type AffixCategory = "output" | "handling" | "element" | "survival" | "ark";
export type StatusKind = "burn" | "shock" | "corrode" | "freeze" | "infection";
export type MaterialId = "gold" | "scrap" | "parts" | "electronics" | "tissue" | "tagSample" | "evolutionSample";
export type StatKey = "maxHealth" | "maxShield" | "defense" | "moveSpeed" | "dodgeCooldown" | "damage" | "interval" | "range" | "magazine" | "reload" | "critChance" | "weakpointMultiplier" | "heatCapacity" | "coolingPerSecond" | "chainTargets";

export interface WeaponStats {
    damage: number;
    interval: number;
    range: number;
    magazine: number;
    reload: number;
    heatPerShot: number;
    heatCapacity: number;
    coolingPerSecond: number;
    projectileSpeed: number;
    pellets?: number;
    penetration?: number;
    splashRadius?: number;
    minimumRange?: number;
    chainTargets?: number;
    status?: StatusKind;
    statusChance?: number;
    pollutionCost?: number;
}

export interface EquipmentTemplate {
    id: string;
    name: string;
    slot: TemplateSlot;
    weaponClass?: WeaponClass;
    icon: string;
    tags: ResonanceTag[];
    baseStats: Partial<Record<StatKey, number>>;
    weapon?: WeaponStats;
    fixedTrait: string;
    allowedAffixCategories: AffixCategory[];
    evolutionIds: string[];
}

export interface AffixDefinition {
    id: string;
    name: string;
    category: AffixCategory;
    stat: StatKey;
    value: number;
    allowedSlots: TemplateSlot[];
    allowedWeaponClasses?: WeaponClass[];
}

export interface ResonanceDefinition {
    tag: ResonanceTag;
    name: string;
    tiers: Array<{ count: 2 | 3; modifiers: Partial<Record<StatKey, number>>; mechanic: string; drawback?: string }>;
}

export interface EvolutionDefinition {
    id: string;
    templateId: string;
    name: string;
    memory: MemoryKind;
    threshold: number;
    modifiers: Partial<Record<StatKey, number>>;
    mechanic: string;
}

export interface RecipeDefinition {
    id: string;
    templateId: string;
    costs: Partial<Record<MaterialId, number>>;
    minimumWorkshopLevel: number;
}

export interface EquipmentCatalog {
    templates: EquipmentTemplate[];
    affixes: AffixDefinition[];
    resonances: ResonanceDefinition[];
    evolutions: EvolutionDefinition[];
    recipes: RecipeDefinition[];
}

export interface EquipmentInstance {
    instanceId: string;
    templateId: string;
    level: number;
    strengthen: number;
    quality: EquipmentQuality;
    affixIds: string[];
    tags: ResonanceTag[];
    favorite: boolean;
    locked: boolean;
    rerollCount: number;
    rerollSlot: number | null;
    evolutionId: string | null;
    evolutionResetCount: number;
    memory: Record<MemoryKind, number>;
}

export interface EquipmentLoadout {
    id: string;
    name: string;
    slots: Record<EquipmentSlot, string | null>;
}

export interface EquipmentState {
    capacity: number;
    instances: EquipmentInstance[];
    materials: Record<MaterialId, number>;
    loadouts: EquipmentLoadout[];
    activeLoadoutId: string;
    roleLevel: number;
    chapterLevelCap: number;
    workshopLevel: number;
    nextInstanceId: number;
    processedBattleIds: string[];
}

export interface ActiveResonance {
    tag: ResonanceTag;
    count: number;
    tier: 0 | 2 | 3;
    nextTier: 2 | 3 | null;
    mechanics: string[];
    drawbacks: string[];
}

export interface WeaponCombatSnapshot extends WeaponStats {
    instanceId: string;
    templateId: string;
    name: string;
    weaponClass: WeaponClass;
    critChance: number;
    critMultiplier: number;
    weakpointMultiplier: number;
    additiveDamageBonus: number;
    mechanics: string[];
}

export interface RoleCombatSnapshot {
    maxHealth: number;
    maxShield: number;
    defense: number;
    moveSpeed: number;
    dodgeCooldown: number;
    weapons: [WeaponCombatSnapshot, WeaponCombatSnapshot];
    resonances: ActiveResonance[];
}

export type EquipmentError = "inventory-full" | "insufficient-materials" | "missing-instance" | "missing-loadout" | "slot-mismatch" | "duplicate-slot" | "protected-instance" | "invalid-command" | "level-cap" | "unavailable-evolution" | "save-failed";
export type EquipmentCommandResult<T = undefined> = { ok: true; value: T } | { ok: false; error: EquipmentError };

export const MEMORY_KINDS: MemoryKind[] = ["closeHit", "weakpointHit", "swapChain", "arkDefenseKill", "statusProc", "highPollutionUse"];
export const EQUIPMENT_SLOTS: EquipmentSlot[] = ["primary1", "primary2", "helmet", "armor", "gloves", "boots", "tactical", "organ"];

export function createEmptyMemory(): Record<MemoryKind, number> {
    return { closeHit: 0, weakpointHit: 0, swapChain: 0, arkDefenseKill: 0, statusProc: 0, highPollutionUse: 0 };
}

export function createEmptySlots(): Record<EquipmentSlot, string | null> {
    return { primary1: null, primary2: null, helmet: null, armor: null, gloves: null, boots: null, tactical: null, organ: null };
}
