import {
    type BattleMapDefinition,
    type GridPoint,
    type MapBarrierDefinition,
    type MapExplorationDefinition,
    type MapLootDefinition,
    type MapObstacleDefinition,
    type MapPointOfInterest,
    type WorldPoint,
} from "./BattleMapModel.ts";
import { ChunkStreamingModel, toChunkCoordinate } from "../world/infinite/ChunkStreamingModel.ts";
import {
    generateInfiniteChunk,
    type InfiniteChunkDefinition,
} from "../world/infinite/InfiniteChunkGenerator.ts";
import {
    CELL_SIZE,
    CHUNK_COLUMNS,
    CHUNK_ROWS,
    CHUNK_WORLD_HEIGHT,
    CHUNK_WORLD_WIDTH,
    type ChunkCoordinate,
    type ChunkDirection,
    type ChunkKey,
} from "../world/infinite/InfiniteWorldTypes.ts";
import { WorldDeltaStore } from "../world/infinite/WorldDeltaStore.ts";
import { encounterProfileForChunk } from "../world/infinite/InfiniteEncounterScaling.ts";
import { SeededRandom, chunkKey, deriveSeed, parseChunkKey } from "../world/infinite/WorldSeed.ts";

export interface InfiniteExplorationMapOptions {
    readonly worldSeed: number;
    readonly deltas?: WorldDeltaStore;
}

export interface InfiniteBattleMapDefinition extends BattleMapDefinition {
    readonly infinite: true;
    readonly revision: number;
    readonly worldSeed: number;
    readonly activeChunks: readonly InfiniteChunkDefinition[];
    readonly preloadedChunks: readonly InfiniteChunkDefinition[];
    readonly preloadGeneratedCount: number;
    readonly renderOrigin: WorldPoint;
    readonly deltas: WorldDeltaStore;
    advancePreload(budget?: number): boolean;
    refreshAround(point: WorldPoint): boolean;
    getChunkAt(coordinate: ChunkCoordinate): InfiniteChunkDefinition;
    enemyHealthMultiplier(cell: GridPoint): number;
}

function positiveModulo(value: number, modulus: number): number {
    return ((value % modulus) + modulus) % modulus;
}

function globalCell(chunk: ChunkCoordinate, local: GridPoint): GridPoint {
    return {
        x: chunk.x * CHUNK_COLUMNS + local.x,
        y: chunk.y * CHUNK_ROWS + local.y,
    };
}

function cellChunk(cell: GridPoint): ChunkCoordinate {
    return {
        x: Math.floor(cell.x / CHUNK_COLUMNS),
        y: Math.floor(cell.y / CHUNK_ROWS),
    };
}

function enemySpawnCells(worldSeed: number, chunk: InfiniteChunkDefinition): GridPoint[] {
    const profile = encounterProfileForChunk(chunk.coordinate);
    const roadKeys = new Set(chunk.roadCells.map((cell) => `${cell.x}:${cell.y}`));
    const reserved = new Set([
        "2:3",
        "7:3",
        "10:3",
    ]);
    const candidates = chunk.roadCells.filter((cell) =>
        cell.x > 0 && cell.x < CHUNK_COLUMNS - 1
        && cell.y > 0 && cell.y < CHUNK_ROWS - 1
        && !reserved.has(`${cell.x}:${cell.y}`));
    const random = new SeededRandom(deriveSeed(worldSeed, chunk.coordinate, "enemy-spawns"));
    const ordered = candidates
        .map((cell) => ({ cell, order: random.next() }))
        .sort((left, right) => left.order - right.order || left.cell.y - right.cell.y || left.cell.x - right.cell.x)
        .map((entry) => entry.cell);
    const selected: GridPoint[] = [];
    const legacy = { x: 11, y: 4 };
    if (roadKeys.has(`${legacy.x}:${legacy.y}`) && !reserved.has(`${legacy.x}:${legacy.y}`)) selected.push(legacy);
    for (const candidate of ordered) {
        if (selected.length >= profile.enemyCount) break;
        if (selected.some((cell) => cell.x === candidate.x && cell.y === candidate.y)) continue;
        if (selected.some((cell) => Math.hypot(cell.x - candidate.x, cell.y - candidate.y) < 2.5)) continue;
        selected.push(candidate);
    }
    for (const candidate of ordered) {
        if (selected.length >= profile.enemyCount) break;
        if (!selected.some((cell) => cell.x === candidate.x && cell.y === candidate.y)) selected.push(candidate);
    }
    return selected.map((cell) => globalCell(chunk.coordinate, cell));
}

function contentForChunks(worldSeed: number, chunks: readonly InfiniteChunkDefinition[]): {
    enemySpawns: GridPoint[];
    pointsOfInterest: MapPointOfInterest[];
    loot: MapLootDefinition[];
    explorationPoints: MapExplorationDefinition[];
    obstacles: MapObstacleDefinition[];
    barriers: MapBarrierDefinition[];
} {
    const enemySpawns: GridPoint[] = [];
    const pointsOfInterest: MapPointOfInterest[] = [];
    const loot: MapLootDefinition[] = [];
    const explorationPoints: MapExplorationDefinition[] = [];
    const obstacles: MapObstacleDefinition[] = [];
    const barriers: MapBarrierDefinition[] = [];

    for (const chunk of chunks) {
        enemySpawns.push(...enemySpawnCells(worldSeed, chunk));
        const lootCell = globalCell(chunk.coordinate, { x: 2, y: 3 });
        loot.push({
            id: `${chunk.key}:loot:street-cache`,
            typeId: chunk.district === "community" ? "medical-cabinet" : "supply-crate",
            name: chunk.district === "community" ? "社区医疗柜" : "街区物资箱",
            cell: lootCell,
            initiallyDiscovered: true,
            rewards: chunk.district === "community"
                ? [{ kind: "medical", amount: 2 }]
                : [{ kind: "scrap", amount: 3 }, { kind: "parts", amount: 1 }],
        });
        if (chunk.district === "community") {
            explorationPoints.push({
                id: `${chunk.key}:explore:community-signal`,
                typeId: "rescue-beacon",
                name: "社区求救信号",
                cell: globalCell(chunk.coordinate, { x: 10, y: 3 }),
                rewards: [{ kind: "intel", amount: 1 }],
            });
        }
        for (const landmark of chunk.landmarks) {
            const cell = globalCell(chunk.coordinate, { x: 7, y: 3 });
            pointsOfInterest.push({ id: landmark.id, name: "战地医院", cell, kind: "medical" });
            explorationPoints.push({
                id: `${chunk.key}:explore:medical-terminal`,
                typeId: "medical-terminal",
                name: "医院医疗终端",
                cell,
                rewards: [{ kind: "medical", amount: 3 }, { kind: "intel", amount: 1 }],
            });
        }
        for (const lot of chunk.buildingLots) {
            obstacles.push({
                id: `${chunk.key}:${lot.id}`,
                name: lot.kind === "landmark" ? "关键地标" : "城市建筑",
                minCell: globalCell(chunk.coordinate, lot.cell),
                maxCell: globalCell(chunk.coordinate, {
                    x: lot.cell.x + lot.width - 1,
                    y: lot.cell.y + lot.height - 1,
                }),
            });
        }
    }
    return { enemySpawns, pointsOfInterest, loot, explorationPoints, obstacles, barriers };
}

export function createInfiniteExplorationMap(options: InfiniteExplorationMapOptions): InfiniteBattleMapDefinition {
    const worldSeed = options.worldSeed >>> 0;
    const deltas = options.deltas ?? new WorldDeltaStore(worldSeed);
    if (deltas.worldSeed !== worldSeed) throw new Error("world delta seed does not match the map seed");
    const streaming = new ChunkStreamingModel();
    const cache = new Map<ChunkKey, InfiniteChunkDefinition>();
    let activeChunks: InfiniteChunkDefinition[] = [];
    let preloadedChunks: InfiniteChunkDefinition[] = [];
    let revision = 0;
    let preloadQueue: ChunkKey[] = [];
    let preloadGeneratedCount = 0;
    const navigationRequested = new Set<ChunkKey>();
    let content = contentForChunks(worldSeed, []);
    const blockedCells = new Set<string>();

    const getChunkAt = (coordinate: ChunkCoordinate): InfiniteChunkDefinition => {
        const key = chunkKey(coordinate);
        let chunk = cache.get(key);
        if (!chunk) {
            chunk = generateInfiniteChunk(worldSeed, coordinate);
            cache.set(key, chunk);
            for (const candidate of cache.keys()) {
                if (cache.size <= 128) break;
                if (!streaming.preloadedKeys.has(candidate)) cache.delete(candidate);
            }
        }
        return chunk;
    };

    const navigationWaypoint = (start: GridPoint, goal: GridPoint): GridPoint | null => {
        const startChunk = cellChunk(start);
        const goalChunk = cellChunk(goal);
        if (startChunk.x === goalChunk.x && startChunk.y === goalChunk.y) return goal;
        const directions: ReadonlyArray<{ direction: ChunkDirection; dx: number; dy: number }> = [
            { direction: "north", dx: 0, dy: 1 },
            { direction: "east", dx: 1, dy: 0 },
            { direction: "south", dx: 0, dy: -1 },
            { direction: "west", dx: -1, dy: 0 },
        ];
        const margin = 16;
        const minX = Math.min(startChunk.x, goalChunk.x) - margin;
        const maxX = Math.max(startChunk.x, goalChunk.x) + margin;
        const minY = Math.min(startChunk.y, goalChunk.y) - margin;
        const maxY = Math.max(startChunk.y, goalChunk.y) + margin;
        const startKey = chunkKey(startChunk);
        const goalKey = chunkKey(goalChunk);
        const queue: ChunkCoordinate[] = [startChunk];
        const visited = new Set<ChunkKey>([startKey]);
        const cameFrom = new Map<ChunkKey, ChunkKey>();
        while (queue.length > 0 && visited.size <= 4_096) {
            const current = queue.shift()!;
            const currentKey = chunkKey(current);
            if (currentKey === goalKey) break;
            const roads = generateInfiniteChunk(worldSeed, current).roads;
            for (const candidate of directions) {
                if (!roads[candidate.direction]) continue;
                const next = { x: current.x + candidate.dx, y: current.y + candidate.dy };
                if (next.x < minX || next.x > maxX || next.y < minY || next.y > maxY) continue;
                const nextKey = chunkKey(next);
                if (visited.has(nextKey)) continue;
                visited.add(nextKey);
                cameFrom.set(nextKey, currentKey);
                queue.push(next);
            }
        }
        if (!visited.has(goalKey)) return null;
        const route: ChunkKey[] = [goalKey];
        while (route[route.length - 1] !== startKey) route.push(cameFrom.get(route[route.length - 1])!);
        route.reverse();
        const readyKeys = new Set(preloadedChunks.map((chunk) => chunk.key));
        for (let index = 1; index < route.length; index++) {
            if (readyKeys.has(route[index])) continue;
            const requestedKey = route[index];
            navigationRequested.add(requestedKey);
            preloadQueue = [requestedKey, ...preloadQueue.filter((key) => key !== requestedKey)];
            const inside = parseChunkKey(route[index - 1]);
            const outside = parseChunkKey(route[index]);
            if (outside.x > inside.x) return { x: (inside.x + 1) * CHUNK_COLUMNS - 1, y: inside.y * CHUNK_ROWS + 3 };
            if (outside.x < inside.x) return { x: inside.x * CHUNK_COLUMNS, y: inside.y * CHUNK_ROWS + 3 };
            if (outside.y > inside.y) return { x: inside.x * CHUNK_COLUMNS + 6, y: (inside.y + 1) * CHUNK_ROWS - 1 };
            return { x: inside.x * CHUNK_COLUMNS + 6, y: inside.y * CHUNK_ROWS };
        }
        return goal;
    };

    const syncPreloadedChunks = (): boolean => {
        const requestedKeys = new Set<ChunkKey>([...streaming.preloadedKeys, ...navigationRequested]);
        const next = [...requestedKeys]
            .filter((key) => cache.has(key))
            .map((key) => cache.get(key)!);
        const changed = next.length !== preloadedChunks.length;
        preloadedChunks = next;
        return changed;
    };

    const advancePreload = (budget = 6): boolean => {
        let generated = 0;
        while (preloadQueue.length > 0 && generated < Math.max(0, Math.floor(budget))) {
            const key = preloadQueue.shift()!;
            if ((!streaming.preloadedKeys.has(key) && !navigationRequested.has(key)) || cache.has(key)) continue;
            getChunkAt(parseChunkKey(key));
            generated++;
            preloadGeneratedCount++;
        }
        return syncPreloadedChunks();
    };

    const map: InfiniteBattleMapDefinition = {
        infinite: true,
        worldSeed,
        deltas,
        columns: CHUNK_COLUMNS * 5,
        rows: CHUNK_ROWS * 5,
        tileSize: CELL_SIZE,
        worldWidth: CHUNK_WORLD_WIDTH * 5,
        worldHeight: CHUNK_WORLD_HEIGHT * 5,
        start: { x: 7, y: 3 },
        extraction: { x: 7, y: 3 },
        get revision() { return revision; },
        get activeChunks() { return activeChunks; },
        get preloadedChunks() { return preloadedChunks; },
        get preloadGeneratedCount() { return preloadGeneratedCount; },
        get renderOrigin() { return streaming.renderOrigin; },
        get enemySpawns() { return content.enemySpawns; },
        get pointsOfInterest() { return content.pointsOfInterest; },
        get loot() { return content.loot; },
        get explorationPoints() { return content.explorationPoints; },
        get obstacles() { return content.obstacles; },
        get barriers() { return content.barriers; },
        getChunkAt,
        enemyHealthMultiplier(cell: GridPoint) {
            return encounterProfileForChunk(cellChunk(cell)).healthMultiplier;
        },
        advancePreload,
        isNavigationCellReady(cell: GridPoint) {
            const key = chunkKey(cellChunk(cell));
            return preloadedChunks.some((chunk) => chunk.key === key);
        },
        navigationWaypoint,
        navigationBounds() {
            const coordinates = preloadedChunks.map((chunk) => chunk.coordinate);
            return {
                minX: Math.min(...coordinates.map((coordinate) => coordinate.x)) * CHUNK_COLUMNS - 1,
                maxX: (Math.max(...coordinates.map((coordinate) => coordinate.x)) + 1) * CHUNK_COLUMNS,
                minY: Math.min(...coordinates.map((coordinate) => coordinate.y)) * CHUNK_ROWS - 1,
                maxY: (Math.max(...coordinates.map((coordinate) => coordinate.y)) + 1) * CHUNK_ROWS,
            };
        },
        readObjectDelta(cell: GridPoint, objectId: string) {
            return deltas.getObjectDelta(chunkKey(cellChunk(cell)), objectId);
        },
        writeObjectDelta(cell: GridPoint, objectId: string, delta) {
            deltas.setObjectDelta(chunkKey(cellChunk(cell)), objectId, delta);
        },
        refreshAround(point: WorldPoint): boolean {
            const diff = streaming.update(point);
            if (diff.load.length === 0 && diff.unload.length === 0 && diff.activate.length === 0 && diff.deactivate.length === 0) return false;
            const queued = new Set(preloadQueue);
            for (const key of diff.load) {
                if (!cache.has(key) && !queued.has(key)) preloadQueue.push(key);
            }
            preloadQueue = preloadQueue.filter((key) => streaming.preloadedKeys.has(key));
            for (const key of navigationRequested) {
                if (!streaming.preloadedKeys.has(key)) navigationRequested.delete(key);
            }
            activeChunks = [...streaming.activeKeys].map((key) => getChunkAt(parseChunkKey(key)));
            syncPreloadedChunks();
            for (const chunk of activeChunks) {
                deltas.markChunkDiscovered(chunk.key, {
                    roadCells: chunk.roadCells,
                    landmarkIds: chunk.landmarks.map((landmark) => landmark.id),
                });
                for (const landmark of chunk.landmarks) deltas.markLandmarkDiscovered(landmark.id);
            }
            const keep = new Set(streaming.preloadedKeys);
            for (const key of cache.keys()) if (!keep.has(key) && cache.size > 64) cache.delete(key);
            content = contentForChunks(worldSeed, activeChunks);
            revision++;
            return true;
        },
        isWalkable(cell: GridPoint): boolean {
            const coordinate = cellChunk(cell);
            const local = {
                x: positiveModulo(cell.x, CHUNK_COLUMNS),
                y: positiveModulo(cell.y, CHUNK_ROWS),
            };
            if (blockedCells.has(`${cell.x}:${cell.y}`)) return false;
            return getChunkAt(coordinate).roadCells.some((road) => road.x === local.x && road.y === local.y);
        },
        isWorldWalkable(point: WorldPoint, radius = 0): boolean {
            const samples: WorldPoint[] = radius <= 0 ? [point] : [
                point,
                { x: point.x - radius, y: point.y },
                { x: point.x + radius, y: point.y },
                { x: point.x, y: point.y - radius },
                { x: point.x, y: point.y + radius },
                { x: point.x - radius * 0.7, y: point.y - radius * 0.7 },
                { x: point.x + radius * 0.7, y: point.y - radius * 0.7 },
                { x: point.x - radius * 0.7, y: point.y + radius * 0.7 },
                { x: point.x + radius * 0.7, y: point.y + radius * 0.7 },
            ];
            return samples.every((sample) => map.isWalkable(map.worldToCell(sample)));
        },
        cellToWorld(cell: GridPoint): WorldPoint {
            return { x: (cell.x + 0.5) * CELL_SIZE, y: (cell.y + 0.5) * CELL_SIZE };
        },
        worldToCell(point: WorldPoint): GridPoint {
            return { x: Math.floor(point.x / CELL_SIZE), y: Math.floor(point.y / CELL_SIZE) };
        },
        setBarrierBlocking(id: string, blocking: boolean): boolean {
            const barrier = content.barriers.find((candidate) => candidate.id === id);
            if (!barrier) return false;
            for (const cell of barrier.blockedCells) {
                const key = `${cell.x}:${cell.y}`;
                if (blocking) blockedCells.add(key);
                else blockedCells.delete(key);
            }
            return true;
        },
    };

    map.refreshAround(map.cellToWorld(map.start));
    advancePreload(6);
    return map;
}

export function chunkAtWorldPoint(point: WorldPoint): ChunkCoordinate {
    return toChunkCoordinate(point);
}
