import {
    CHUNK_WORLD_HEIGHT,
    CHUNK_WORLD_WIDTH,
    type ChunkCoordinate,
    type ChunkKey,
    type PermanentWorldPosition,
} from "./InfiniteWorldTypes.ts";
import { chunkKey } from "./WorldSeed.ts";

export interface ChunkStreamingDiff {
    readonly center: ChunkCoordinate;
    readonly load: readonly ChunkKey[];
    readonly unload: readonly ChunkKey[];
    readonly activate: readonly ChunkKey[];
    readonly deactivate: readonly ChunkKey[];
    readonly originShift?: PermanentWorldPosition;
}

export function toChunkCoordinate(position: PermanentWorldPosition): ChunkCoordinate {
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new RangeError("world position must be finite");
    return {
        x: Math.floor(position.x / CHUNK_WORLD_WIDTH),
        y: Math.floor(position.y / CHUNK_WORLD_HEIGHT),
    };
}

export function chunkCoordinateToWorldOrigin(coordinate: ChunkCoordinate): PermanentWorldPosition {
    return {
        x: coordinate.x * CHUNK_WORLD_WIDTH,
        y: coordinate.y * CHUNK_WORLD_HEIGHT,
    };
}

export function toLocalRenderPoint(position: PermanentWorldPosition, renderOrigin: PermanentWorldPosition): PermanentWorldPosition {
    return { x: position.x - renderOrigin.x, y: position.y - renderOrigin.y };
}

function keysAround(center: ChunkCoordinate, radius: number): Set<ChunkKey> {
    const keys = new Set<ChunkKey>();
    for (let y = center.y - radius; y <= center.y + radius; y++) {
        for (let x = center.x - radius; x <= center.x + radius; x++) keys.add(chunkKey({ x, y }));
    }
    return keys;
}

function added(next: ReadonlySet<ChunkKey>, previous: ReadonlySet<ChunkKey>): ChunkKey[] {
    return [...next].filter((key) => !previous.has(key)).sort();
}

export class ChunkStreamingModel {
    private active = new Set<ChunkKey>();
    private preloaded = new Set<ChunkKey>();
    private currentCenter: ChunkCoordinate | null = null;
    private currentRenderOrigin: PermanentWorldPosition = { x: 0, y: 0 };

    get activeKeys(): ReadonlySet<ChunkKey> {
        return this.active;
    }

    get preloadedKeys(): ReadonlySet<ChunkKey> {
        return this.preloaded;
    }

    get renderOrigin(): PermanentWorldPosition {
        return { ...this.currentRenderOrigin };
    }

    update(player: PermanentWorldPosition): ChunkStreamingDiff {
        const center = toChunkCoordinate(player);
        let originShift: PermanentWorldPosition | undefined;
        const originChunk = toChunkCoordinate(this.currentRenderOrigin);
        if (Math.abs(center.x - originChunk.x) > 2 || Math.abs(center.y - originChunk.y) > 2) {
            const nextOrigin = chunkCoordinateToWorldOrigin(center);
            originShift = {
                x: nextOrigin.x - this.currentRenderOrigin.x,
                y: nextOrigin.y - this.currentRenderOrigin.y,
            };
            this.currentRenderOrigin = nextOrigin;
        }

        if (this.currentCenter?.x === center.x && this.currentCenter.y === center.y) {
            return { center, load: [], unload: [], activate: [], deactivate: [], originShift };
        }

        const nextActive = keysAround(center, 1);
        const nextPreloaded = keysAround(center, 2);
        const diff: ChunkStreamingDiff = {
            center,
            load: added(nextPreloaded, this.preloaded),
            unload: added(this.preloaded, nextPreloaded),
            activate: added(nextActive, this.active),
            deactivate: added(this.active, nextActive),
            originShift,
        };
        this.active = nextActive;
        this.preloaded = nextPreloaded;
        this.currentCenter = center;
        return diff;
    }
}
