import { WorldDeltaStore } from "./WorldDeltaStore.ts";

export interface WorldDeltaStorage {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
}

/** Persistence boundary for the sparse, seed-rebuildable infinite world state. */
export class WorldDeltaRepository {
    private readonly storage: WorldDeltaStorage;
    private readonly key: string;

    constructor(storage: WorldDeltaStorage, key = "infinite-evolution.world-deltas.v1") {
        this.storage = storage;
        this.key = key;
    }

    load(worldSeed: number): WorldDeltaStore {
        const normalizedSeed = worldSeed >>> 0;
        const slotKey = this.slotKey(normalizedSeed);
        const serialized = this.storage.get(slotKey) ?? this.storage.get(this.key);
        if (!serialized) return new WorldDeltaStore(normalizedSeed);
        try {
            const restored = WorldDeltaStore.restore(JSON.parse(serialized));
            if (restored.worldSeed !== normalizedSeed) throw new Error("world delta seed mismatch");
            if (this.storage.get(slotKey) === null) this.storage.set(slotKey, JSON.stringify(restored.snapshot()));
            return restored;
        } catch {
            this.storage.set(`${slotKey}:incompatible`, serialized);
            return new WorldDeltaStore(normalizedSeed);
        }
    }

    save(deltas: WorldDeltaStore): void {
        this.storage.set(this.slotKey(deltas.worldSeed), JSON.stringify(deltas.snapshot()));
    }

    private slotKey(worldSeed: number): string {
        return `${this.key}:${worldSeed >>> 0}`;
    }
}
