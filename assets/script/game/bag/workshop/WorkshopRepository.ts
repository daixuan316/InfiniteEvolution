import type { WorkshopSnapshot } from "./WorkshopTypes.ts";

export interface WorkshopRepository {
    load(): WorkshopSnapshot | null;
    save(snapshot: WorkshopSnapshot): void;
}

export interface KeyValueStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
    removeItem(key: string): void;
}

const WORKSHOP_SAVE_KEY = "infinite-evolution.workshop.v1";
const WORKSHOP_INITIALIZED_KEY = "infinite-evolution.workshop.initialized";

function repairedEmptySnapshot(initialized: boolean): WorkshopSnapshot {
    return {
        version: 1,
        initialized,
        workshopLevel: 1,
        inventory: {},
        tasks: [],
    };
}

function isSnapshotShape(value: unknown): value is WorkshopSnapshot {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<WorkshopSnapshot>;
    return candidate.version === 1
        && typeof candidate.initialized === "boolean"
        && typeof candidate.workshopLevel === "number"
        && Boolean(candidate.inventory)
        && typeof candidate.inventory === "object"
        && Array.isArray(candidate.tasks);
}

function cloneSnapshot(snapshot: WorkshopSnapshot): WorkshopSnapshot {
    return {
        version: 1,
        initialized: snapshot.initialized,
        workshopLevel: snapshot.workshopLevel,
        inventory: { ...snapshot.inventory },
        tasks: snapshot.tasks.map((task) => ({ ...task })),
    };
}

export class MemoryWorkshopRepository implements WorkshopRepository {
    private snapshot: WorkshopSnapshot | null;
    failNextSave = false;

    constructor(initial: WorkshopSnapshot | null = null) {
        this.snapshot = initial ? cloneSnapshot(initial) : null;
    }

    load(): WorkshopSnapshot | null {
        return this.snapshot ? cloneSnapshot(this.snapshot) : null;
    }

    save(snapshot: WorkshopSnapshot): void {
        if (this.failNextSave) {
            this.failNextSave = false;
            throw new Error("simulated workshop save failure");
        }
        this.snapshot = cloneSnapshot(snapshot);
    }
}

export class LocalStorageWorkshopRepository implements WorkshopRepository {
    private readonly store: KeyValueStore;

    constructor(store: KeyValueStore) {
        this.store = store;
    }

    load(): WorkshopSnapshot | null {
        const raw = this.store.getItem(WORKSHOP_SAVE_KEY);
        const initialized = this.store.getItem(WORKSHOP_INITIALIZED_KEY) === "1";
        if (raw === null) return initialized ? repairedEmptySnapshot(true) : null;
        try {
            const parsed: unknown = JSON.parse(raw);
            if (!isSnapshotShape(parsed)) return repairedEmptySnapshot(true);
            const snapshot = cloneSnapshot(parsed);
            snapshot.initialized = true;
            return snapshot;
        } catch {
            return repairedEmptySnapshot(true);
        }
    }

    save(snapshot: WorkshopSnapshot): void {
        this.store.setItem(WORKSHOP_SAVE_KEY, JSON.stringify(cloneSnapshot(snapshot)));
        try {
            this.store.setItem(WORKSHOP_INITIALIZED_KEY, "1");
        } catch {
            // The versioned snapshot is authoritative; the marker only repairs legacy/corrupt data.
        }
    }
}
