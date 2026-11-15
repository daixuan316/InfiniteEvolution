import type { WorldPoint } from "./BattleMapModel.ts";
import { parseChunkKey } from "../world/infinite/WorldSeed.ts";

/** Projects permanent world coordinates into a player-centred local map canvas. */
export function localMapPosition(
    point: WorldPoint,
    center: WorldPoint,
    worldRadius: number,
    width: number,
    height: number,
): WorldPoint {
    if (!Number.isFinite(worldRadius) || worldRadius <= 0) throw new RangeError("world radius must be positive");
    return {
        x: (point.x - center.x) / worldRadius * width / 2,
        y: (point.y - center.y) / worldRadius * height / 2,
    };
}

/** Fits all discovered chunks into a persistent full-map canvas. */
export function discoveredMapPosition(
    point: WorldPoint,
    discoveredChunkKeys: readonly string[],
    chunkWidth: number,
    chunkHeight: number,
    width: number,
    height: number,
): WorldPoint {
    return createDiscoveredMapProjection(discoveredChunkKeys, chunkWidth, chunkHeight, width, height)(point);
}

/** Computes discovered bounds once, then projects any number of map points in O(1). */
export function createDiscoveredMapProjection(
    discoveredChunkKeys: readonly string[],
    chunkWidth: number,
    chunkHeight: number,
    width: number,
    height: number,
): (point: WorldPoint) => WorldPoint {
    if (chunkWidth <= 0 || chunkHeight <= 0 || width <= 0 || height <= 0) throw new RangeError("map dimensions must be positive");
    const coordinates = (discoveredChunkKeys.length > 0 ? discoveredChunkKeys : ["0:0"]).map(parseChunkKey);
    const minChunkX = Math.min(...coordinates.map((coordinate) => coordinate.x));
    const maxChunkX = Math.max(...coordinates.map((coordinate) => coordinate.x));
    const minChunkY = Math.min(...coordinates.map((coordinate) => coordinate.y));
    const maxChunkY = Math.max(...coordinates.map((coordinate) => coordinate.y));
    const minX = minChunkX * chunkWidth;
    const maxX = (maxChunkX + 1) * chunkWidth;
    const minY = minChunkY * chunkHeight;
    const maxY = (maxChunkY + 1) * chunkHeight;
    const scale = Math.min(width / (maxX - minX), height / (maxY - minY)) * 0.9;
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    return (point: WorldPoint): WorldPoint => ({
        x: (point.x - centerX) * scale,
        y: (point.y - centerY) * scale,
    });
}
