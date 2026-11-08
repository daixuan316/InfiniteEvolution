import type { WorkshopSnapshot } from "./WorkshopTypes.ts";

export interface WorkshopRepository {
    load(): WorkshopSnapshot | null;
    save(snapshot: WorkshopSnapshot): void;
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
