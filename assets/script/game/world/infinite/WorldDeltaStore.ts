import { GENERATION_VERSION, type ChunkKey } from "./InfiniteWorldTypes.ts";
import { parseChunkKey } from "./WorldSeed.ts";

export const WORLD_DELTA_SCHEMA_VERSION = 2;

export interface WorldObjectDelta {
    readonly opened?: boolean;
    readonly destroyed?: boolean;
    readonly discovered?: boolean;
    readonly eventStage?: string;
}

interface MutableWorldObjectDelta {
    opened?: boolean;
    destroyed?: boolean;
    discovered?: boolean;
    eventStage?: string;
}

export interface WorldDeltaSnapshotV1 {
    schemaVersion: 1;
    generationVersion: number;
    worldSeed: number;
    chunks: Record<string, Record<string, WorldObjectDelta>>;
    discoveredLandmarks: string[];
}

export interface WorldDeltaSnapshotV2 {
    schemaVersion: 2;
    generationVersion: number;
    worldSeed: number;
    playerPosition: { x: number; y: number } | null;
    discoveredChunks: string[];
    discoveredMap?: Record<string, DiscoveredChunkMap>;
    chunks: Record<string, Record<string, WorldObjectDelta>>;
    discoveredLandmarks: string[];
}

export interface DiscoveredChunkMap {
    readonly roadCells: readonly { readonly x: number; readonly y: number }[];
    readonly landmarkIds: readonly string[];
}

function requireObjectId(value: string): string {
    if (typeof value !== "string" || value.trim().length === 0) throw new Error("world delta object id must not be empty");
    return value;
}

function copyDelta(value: WorldObjectDelta): WorldObjectDelta {
    const result: MutableWorldObjectDelta = {};
    if (value.opened !== undefined) result.opened = value.opened;
    if (value.destroyed !== undefined) result.destroyed = value.destroyed;
    if (value.discovered !== undefined) result.discovered = value.discovered;
    if (value.eventStage !== undefined) result.eventStage = value.eventStage;
    return result;
}

function validateDelta(value: unknown): WorldObjectDelta {
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("world object delta must be an object");
    const candidate = value as Record<string, unknown>;
    const allowed = new Set(["opened", "destroyed", "discovered", "eventStage"]);
    for (const key of Object.keys(candidate)) {
        if (!allowed.has(key)) throw new Error(`unsupported world delta field: ${key}`);
    }
    for (const key of ["opened", "destroyed", "discovered"] as const) {
        if (candidate[key] !== undefined && typeof candidate[key] !== "boolean") throw new Error(`${key} must be boolean`);
    }
    if (candidate.eventStage !== undefined && (typeof candidate.eventStage !== "string" || candidate.eventStage.length === 0)) {
        throw new Error("eventStage must be a non-empty string");
    }
    return copyDelta(candidate as WorldObjectDelta);
}

function isEmptyDelta(value: WorldObjectDelta): boolean {
    return Object.keys(value).length === 0;
}

export class WorldDeltaStore {
    readonly worldSeed: number;
    private readonly chunkDeltas = new Map<ChunkKey, Map<string, WorldObjectDelta>>();
    private readonly discoveredLandmarks = new Set<string>();
    private readonly discoveredChunks = new Set<ChunkKey>();
    private readonly discoveredMap = new Map<ChunkKey, DiscoveredChunkMap>();
    private permanentPlayerPosition: { x: number; y: number } | null = null;

    constructor(worldSeed: number) {
        if (!Number.isFinite(worldSeed)) throw new RangeError("world seed must be finite");
        this.worldSeed = worldSeed >>> 0;
    }

    setObjectDelta(key: ChunkKey | string, objectId: string, value: WorldObjectDelta): void {
        parseChunkKey(key);
        requireObjectId(objectId);
        const delta = validateDelta(value);
        const typedKey = key as ChunkKey;
        if (isEmptyDelta(delta)) {
            const chunk = this.chunkDeltas.get(typedKey);
            chunk?.delete(objectId);
            if (chunk?.size === 0) this.chunkDeltas.delete(typedKey);
            return;
        }
        let chunk = this.chunkDeltas.get(typedKey);
        if (!chunk) {
            chunk = new Map<string, WorldObjectDelta>();
            this.chunkDeltas.set(typedKey, chunk);
        }
        chunk.set(objectId, delta);
    }

    getObjectDelta(key: ChunkKey | string, objectId: string): WorldObjectDelta | undefined {
        parseChunkKey(key);
        requireObjectId(objectId);
        const delta = this.chunkDeltas.get(key as ChunkKey)?.get(objectId);
        return delta ? copyDelta(delta) : undefined;
    }

    markLandmarkDiscovered(id: string): void {
        requireObjectId(id);
        this.discoveredLandmarks.add(id);
    }

    isLandmarkDiscovered(id: string): boolean {
        requireObjectId(id);
        return this.discoveredLandmarks.has(id);
    }

    markChunkDiscovered(key: ChunkKey | string, summary?: DiscoveredChunkMap): void {
        parseChunkKey(key);
        const typedKey = key as ChunkKey;
        this.discoveredChunks.add(typedKey);
        if (summary) {
            this.discoveredMap.set(typedKey, {
                roadCells: summary.roadCells.map((cell) => ({ x: cell.x, y: cell.y })),
                landmarkIds: [...summary.landmarkIds],
            });
        }
    }

    discoveredChunkKeys(): ChunkKey[] {
        return [...this.discoveredChunks].sort();
    }

    discoveredChunkMap(key: ChunkKey | string): DiscoveredChunkMap | undefined {
        parseChunkKey(key);
        const summary = this.discoveredMap.get(key as ChunkKey);
        return summary ? {
            roadCells: summary.roadCells.map((cell) => ({ ...cell })),
            landmarkIds: [...summary.landmarkIds],
        } : undefined;
    }

    setPlayerPosition(position: { x: number; y: number }): void {
        if (!Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new RangeError("player position must be finite");
        this.permanentPlayerPosition = { x: position.x, y: position.y };
    }

    playerPosition(): { x: number; y: number } | null {
        return this.permanentPlayerPosition ? { ...this.permanentPlayerPosition } : null;
    }

    snapshot(): WorldDeltaSnapshotV2 {
        const chunks: Record<string, Record<string, WorldObjectDelta>> = Object.create(null);
        for (const [key, entries] of this.chunkDeltas) {
            const serializedEntries: Record<string, WorldObjectDelta> = Object.create(null);
            for (const [objectId, delta] of entries) serializedEntries[objectId] = copyDelta(delta);
            chunks[key] = serializedEntries;
        }
        return {
            schemaVersion: WORLD_DELTA_SCHEMA_VERSION,
            generationVersion: GENERATION_VERSION,
            worldSeed: this.worldSeed,
            playerPosition: this.playerPosition(),
            discoveredChunks: this.discoveredChunkKeys(),
            discoveredMap: Object.fromEntries([...this.discoveredMap].map(([key, summary]) => [key, {
                roadCells: summary.roadCells.map((cell) => ({ ...cell })),
                landmarkIds: [...summary.landmarkIds],
            }])),
            chunks,
            discoveredLandmarks: [...this.discoveredLandmarks].sort(),
        };
    }

    static restore(value: unknown): WorldDeltaStore {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("world delta snapshot must be an object");
        const snapshot = value as Partial<WorldDeltaSnapshotV1> | Partial<WorldDeltaSnapshotV2>;
        const schemaVersion = (value as { schemaVersion?: unknown }).schemaVersion;
        if (schemaVersion !== 1 && schemaVersion !== WORLD_DELTA_SCHEMA_VERSION) {
            throw new Error(`unsupported world delta schema: ${schemaVersion}`);
        }
        if (snapshot.generationVersion !== GENERATION_VERSION) throw new Error(`unsupported generation version: ${snapshot.generationVersion}`);
        if (!Number.isFinite(snapshot.worldSeed)) throw new Error("world delta seed must be finite");
        if (!snapshot.chunks || typeof snapshot.chunks !== "object" || Array.isArray(snapshot.chunks)) throw new Error("world delta chunks must be an object");
        if (!Array.isArray(snapshot.discoveredLandmarks)) throw new Error("discovered landmarks must be an array");

        const store = new WorldDeltaStore(snapshot.worldSeed!);
        for (const [key, entries] of Object.entries(snapshot.chunks)) {
            parseChunkKey(key);
            if (!entries || typeof entries !== "object" || Array.isArray(entries)) throw new Error(`chunk delta must be an object: ${key}`);
            for (const [objectId, delta] of Object.entries(entries)) store.setObjectDelta(key, objectId, validateDelta(delta));
            if (schemaVersion === 1) store.markChunkDiscovered(key);
        }
        for (const landmarkId of snapshot.discoveredLandmarks) {
            if (typeof landmarkId !== "string") throw new Error("landmark id must be a string");
            store.markLandmarkDiscovered(landmarkId);
        }
        if (schemaVersion === WORLD_DELTA_SCHEMA_VERSION) {
            const current = snapshot as Partial<WorldDeltaSnapshotV2>;
            if (!Array.isArray(current.discoveredChunks)) throw new Error("discovered chunks must be an array");
            for (const key of current.discoveredChunks) {
                if (typeof key !== "string") throw new Error("discovered chunk key must be a string");
                const summary = current.discoveredMap?.[key];
                if (summary) {
                    if (!Array.isArray(summary.roadCells) || !Array.isArray(summary.landmarkIds)) throw new Error("discovered map summary is invalid");
                    for (const cell of summary.roadCells) {
                        if (!cell || !Number.isInteger(cell.x) || !Number.isInteger(cell.y)) throw new Error("discovered road cell is invalid");
                    }
                    if (summary.landmarkIds.some((id) => typeof id !== "string")) throw new Error("discovered landmark id is invalid");
                }
                store.markChunkDiscovered(key, summary);
            }
            if (current.playerPosition !== null) {
                if (!current.playerPosition || typeof current.playerPosition !== "object") throw new Error("player position must be an object or null");
                store.setPlayerPosition(current.playerPosition);
            }
        }
        return store;
    }
}
