export type ResearchBranch = "mechanical" | "survival" | "biochemical" | "hybrid";

export type ResearchEffect =
    | { readonly stat: "maxHealth"; readonly add: number }
    | { readonly stat: "maxShield"; readonly add: number }
    | { readonly stat: "attackDamage"; readonly multiplier: number }
    | { readonly stat: "moveSpeed"; readonly multiplier: number };

export interface ResearchDefinition {
    readonly id: string;
    readonly branch: ResearchBranch;
    readonly tier: 1 | 2 | 3;
    readonly name: string;
    readonly description: string;
    readonly cost: number;
    readonly durationSeconds: number;
    readonly prerequisites: readonly string[];
    readonly effects: readonly ResearchEffect[];
    readonly bioLoad?: number;
}

export interface BattlePlayerModifiers {
    readonly maxHealthAdd: number;
    readonly maxShieldAdd: number;
    readonly attackDamageMultiplier: number;
    readonly moveSpeedMultiplier: number;
}

export const DEFAULT_BATTLE_PLAYER_MODIFIERS: BattlePlayerModifiers = Object.freeze({
    maxHealthAdd: 0,
    maxShieldAdd: 0,
    attackDamageMultiplier: 1,
    moveSpeedMultiplier: 1,
});
