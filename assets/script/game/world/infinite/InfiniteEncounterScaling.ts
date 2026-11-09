import type { ChunkCoordinate } from "./InfiniteWorldTypes.ts";

export interface InfiniteEncounterProfile {
    readonly distance: number;
    readonly enemyCount: number;
    readonly healthMultiplier: number;
}

/** Difficulty ring derived only from permanent chunk coordinates and the Ark at 0:0. */
export function encounterProfileForChunk(coordinate: ChunkCoordinate): InfiniteEncounterProfile {
    const distance = Math.floor(Math.hypot(coordinate.x, coordinate.y));
    const enemyCount = distance <= 1 ? 1 : distance <= 3 ? 2 : distance <= 6 ? 3 : 4;
    return {
        distance,
        enemyCount,
        healthMultiplier: Math.min(3, 1 + distance * 0.1),
    };
}
