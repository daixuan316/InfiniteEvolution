import {
    GENERATION_VERSION,
    type ChunkCoordinate,
    type ChunkKey,
} from "./InfiniteWorldTypes.ts";

export type { ChunkCoordinate, ChunkKey } from "./InfiniteWorldTypes.ts";

function requireInteger(value: number, label: string): number {
    if (!Number.isSafeInteger(value)) throw new RangeError(`${label} must be a safe integer`);
    return value;
}

export function chunkKey(coordinate: ChunkCoordinate): ChunkKey {
    const x = requireInteger(coordinate.x, "chunk x");
    const y = requireInteger(coordinate.y, "chunk y");
    return `${x}:${y}`;
}

export function parseChunkKey(value: string): ChunkCoordinate {
    const match = /^(-?\d+):(-?\d+)$/.exec(value);
    if (!match) throw new Error(`Invalid chunk key: ${value}`);
    const coordinate = { x: Number(match[1]), y: Number(match[2]) };
    if (!Number.isSafeInteger(coordinate.x) || !Number.isSafeInteger(coordinate.y)) {
        throw new Error(`Invalid chunk key: ${value}`);
    }
    return coordinate;
}

function hashText(text: string): number {
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index++) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x7feb352d);
    hash ^= hash >>> 15;
    hash = Math.imul(hash, 0x846ca68b);
    hash ^= hash >>> 16;
    return hash >>> 0;
}

export function deriveSeed(worldSeed: number, coordinate: ChunkCoordinate, stream: string): number {
    const x = requireInteger(coordinate.x, "chunk x");
    const y = requireInteger(coordinate.y, "chunk y");
    if (!Number.isFinite(worldSeed)) throw new RangeError("world seed must be finite");
    if (stream.length === 0) throw new Error("random stream must have a name");
    const hash = hashText(`${GENERATION_VERSION}|${worldSeed >>> 0}|${x}|${y}|${stream}`);
    return hash === 0 ? 0x6d2b79f5 : hash;
}

export class SeededRandom {
    private currentState: number;

    constructor(seed: number) {
        if (!Number.isFinite(seed)) throw new RangeError("seed must be finite");
        const normalized = seed >>> 0;
        this.currentState = normalized === 0 ? 0x6d2b79f5 : normalized;
    }

    get state(): number {
        return this.currentState >>> 0;
    }

    next(): number {
        let value = this.currentState >>> 0;
        value ^= value << 13;
        value ^= value >>> 17;
        value ^= value << 5;
        this.currentState = value >>> 0;
        return this.currentState / 0x1_0000_0000;
    }

    int(minimum: number, maximum: number): number {
        requireInteger(minimum, "minimum");
        requireInteger(maximum, "maximum");
        if (maximum < minimum) throw new RangeError("integer range maximum must be at least minimum");
        const span = maximum - minimum + 1;
        if (!Number.isSafeInteger(span) || span > 0x1_0000_0000) throw new RangeError("integer range is too large");
        return minimum + Math.floor(this.next() * span);
    }
}
