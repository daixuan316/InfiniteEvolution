import { WorldDeltaRepository } from "../world/infinite/WorldDeltaRepository.ts";
import { WorldDeltaStore } from "../world/infinite/WorldDeltaStore.ts";
import { OopsStorageAdapter } from "./OopsStorageAdapter.ts";

const repository = new WorldDeltaRepository(new OopsStorageAdapter());
let activeDeltas: WorldDeltaStore | null = null;

export function persistentWorldDeltas(worldSeed: number): WorldDeltaStore {
    const normalizedSeed = worldSeed >>> 0;
    if (!activeDeltas || activeDeltas.worldSeed !== normalizedSeed) activeDeltas = repository.load(normalizedSeed);
    return activeDeltas;
}

export function persistWorldDeltas(deltas: WorldDeltaStore): void {
    repository.save(deltas);
}
