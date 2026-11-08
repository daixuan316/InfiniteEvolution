export type ArkCategory = "structure" | "energy" | "defense" | "bio";
export type ArkSlotKind = "front" | "top" | "side" | "internal" | "bio";
export type PowerPriority = "core" | "important" | "normal";
export type ArkLayoutId = "alpha" | "beta" | "gamma";
export type NoiseTier = "hidden" | "noticed" | "danger" | "bait";
export type ArkResourceId = "scrap" | "parts" | "alloy" | "energyCell" | "mutationCore";

export interface ArkCost {
    readonly resource: ArkResourceId;
    readonly amount: number;
}

export interface ArkBattleStats {
    readonly attackDamage?: number;
    readonly attackInterval?: number;
    readonly attackRange?: number;
    readonly defense?: number;
    readonly radius?: number;
    readonly repairRate?: number;
    readonly controlSeconds?: number;
}

export interface ArkModuleDefinition {
    readonly id: string;
    readonly name: string;
    readonly category: ArkCategory;
    readonly acceptedSlots: readonly ArkSlotKind[];
    readonly cost: readonly ArkCost[];
    readonly maxDurability: number;
    readonly powerDemand: number;
    readonly powerCapacity: number;
    readonly noise: number;
    readonly tags: readonly string[];
    readonly battle: ArkBattleStats;
    readonly evolutionIds: readonly string[];
}

export interface ArkSlotDefinition {
    readonly id: string;
    readonly kind: ArkSlotKind;
    readonly label: string;
    readonly neighbors: readonly string[];
}

export interface ArkEvolutionDefinition {
    readonly id: string;
    readonly name: string;
    readonly abilityId: string;
    readonly compatibleDefinitionIds: readonly string[];
    readonly powerDelta: number;
    readonly noiseDelta: number;
    readonly visualMarker: string;
    readonly sideEffect: string;
}

export interface ArkModuleInstance {
    instanceId: string;
    definitionId: string;
    durability: number;
    priority: PowerPriority;
    evolutionId: string | null;
    commissioned: boolean;
}

export interface ArkLayoutState {
    slots: Record<string, string | null>;
}

export interface ArkState {
    schemaVersion: 1;
    resources: Record<ArkResourceId, number>;
    modules: ArkModuleInstance[];
    layouts: Record<ArkLayoutId, ArkLayoutState>;
    activeLayoutId: ArkLayoutId;
    repairQueue: string[];
    repairSpentToday: number;
    coreDurability: number;
    coreMaxDurability: number;
    appliedBattleIds: string[];
}

export interface ArkAdjacencyBonus {
    readonly instanceId: string;
    readonly neighborInstanceId: string;
    readonly bonusId: string;
    readonly label: string;
}

export interface ArkDerivedState {
    readonly installedInstanceIds: readonly string[];
    readonly poweredInstanceIds: readonly string[];
    readonly unpoweredInstanceIds: readonly string[];
    readonly powerCapacity: number;
    readonly powerDemand: number;
    readonly powerUsed: number;
    readonly noise: number;
    readonly noiseTier: NoiseTier;
    readonly adjacencies: readonly ArkAdjacencyBonus[];
}

export type ArkErrorCode =
    | "unknown_module"
    | "unknown_slot"
    | "slot_rejects_module"
    | "slot_occupied"
    | "instance_already_installed"
    | "insufficient_resources"
    | "invalid_layout"
    | "repair_not_needed"
    | "repair_cap_reached"
    | "evolution_incompatible"
    | "already_evolved"
    | "settlement_already_applied";

export type ArkResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: ArkErrorCode };

export interface ArkBattleModuleSnapshot {
    readonly instanceId: string;
    readonly definitionId: string;
    readonly name: string;
    readonly slotId: string;
    readonly category: ArkCategory;
    readonly durability: number;
    readonly maxDurability: number;
    readonly powered: boolean;
    readonly operational: boolean;
    readonly battle: ArkBattleStats;
    readonly abilityId: string | null;
    readonly visualMarker: string | null;
}

export interface ArkBattleSnapshot {
    readonly modules: readonly ArkBattleModuleSnapshot[];
    readonly noiseTier: NoiseTier;
    readonly hordeMultiplier: number;
    readonly rewardMultiplier: number;
    readonly emergencyEnergy: number;
    readonly coreDurability: number;
    readonly coreMaxDurability: number;
}

export interface ArkBattleSettlement {
    readonly battleId: string;
    readonly moduleDurability: readonly { readonly instanceId: string; readonly durability: number }[];
    readonly resourceDeltas: Readonly<Partial<Record<ArkResourceId, number>>>;
    readonly coreDurability: number;
}

