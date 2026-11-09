export type PresentedEnemyKind = "walker" | "runner" | "mutant" | "brute";

export interface EnemyActorPresentation {
    readonly name: string;
    readonly asset: string;
    readonly size: number;
    readonly collisionRadius: number;
    readonly healthBarWidth: number;
}

export const PLAYER_PRESENTATION_SIZE = 104;
export const PLAYER_COLLISION_RADIUS = 22;

const ENEMY_PRESENTATIONS: Readonly<Record<PresentedEnemyKind, EnemyActorPresentation>> = {
    walker: {
        name: "Walker",
        asset: "gui/battle-hud/actors/walker",
        size: 78,
        collisionRadius: 18,
        healthBarWidth: 78,
    },
    runner: {
        name: "Runner",
        asset: "gui/battle-hud/actors/runner",
        size: 82,
        collisionRadius: 18,
        healthBarWidth: 82,
    },
    mutant: {
        name: "Mutant",
        asset: "gui/battle-hud/actors/walker",
        size: 90,
        collisionRadius: 20,
        healthBarWidth: 90,
    },
    brute: {
        name: "Brute",
        asset: "gui/battle-hud/actors/brute",
        size: 118,
        collisionRadius: 28,
        healthBarWidth: 118,
    },
};

export function enemyActorPresentation(kind: PresentedEnemyKind): EnemyActorPresentation {
    return ENEMY_PRESENTATIONS[kind];
}
