import type { WorldPoint } from "./BattleMapModel.ts";

export interface WorldBounds {
    worldWidth: number;
    worldHeight: number;
    infinite?: boolean;
}

export interface ViewportSize {
    width: number;
    height: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
}

export function cameraTargetFor(player: WorldPoint, map: WorldBounds, viewport: ViewportSize): WorldPoint {
    if (map.infinite) return { x: player.x, y: player.y };
    const horizontalLimit = Math.max(0, (map.worldWidth - viewport.width) / 2);
    const verticalLimit = Math.max(0, (map.worldHeight - viewport.height) / 2);
    return {
        x: clamp(player.x, -horizontalLimit, horizontalLimit),
        y: clamp(player.y, -verticalLimit, verticalLimit),
    };
}
