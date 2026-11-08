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
    type ChunkKey,
} from "../world/infinite/InfiniteWorldTypes.ts";
import { WorldDeltaStore } from "../world/infinite/WorldDeltaStore.ts";
import { chunkKey, parseChunkKey } from "../world/infinite/WorldSeed.ts";

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
    readonly deltas: WorldDeltaStore;
    refreshAround(point: WorldPoint): boolean;
    getChunkAt(coordinate: ChunkCoordinate): InfiniteChunkDefinition;
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

function contentForChunks(chunks: readonly InfiniteChunkDefinition[]): {
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
        enemySpawns.push(globalCell(chunk.coordinate, { x: 11, y: 4 }));
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
    let content = contentForChunks([]);
    const blockedCells = new Set<string>();

    const getChunkAt = (coordinate: ChunkCoordinate): InfiniteChunkDefinition => {
        const key = chunkKey(coordinate);
        let chunk = cache.get(key);
        if (!chunk) {
            chunk = generateInfiniteChunk(worldSeed, coordinate);
            cache.set(key, chunk);
            if (cache.size > 128) {
                const firstKey = cache.keys().next().value as ChunkKey | undefined;
                if (firstKey && !streaming.preloadedKeys.has(firstKey)) cache.delete(firstKey);
            }
        }
        return chunk;
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
        get enemySpawns() { return content.enemySpawns; },
        get pointsOfInterest() { return content.pointsOfInterest; },
        get loot() { return content.loot; },
        get explorationPoints() { return content.explorationPoints; },
        get obstacles() { return content.obstacles; },
        get barriers() { return content.barriers; },
        getChunkAt,
        refreshAround(point: WorldPoint): boolean {
            const diff = streaming.update(point);
            if (diff.load.length === 0 && diff.unload.length === 0 && diff.activate.length === 0 && diff.deactivate.length === 0) return false;
            preloadedChunks = [...streaming.preloadedKeys].map((key) => getChunkAt(parseChunkKey(key)));
            activeChunks = [...streaming.activeKeys].map((key) => getChunkAt(parseChunkKey(key)));
            const keep = new Set(streaming.preloadedKeys);
            for (const key of cache.keys()) if (!keep.has(key) && cache.size > 64) cache.delete(key);
            content = contentForChunks(activeChunks);
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
    return map;
}

export function chunkAtWorldPoint(point: WorldPoint): ChunkCoordinate {
    return toChunkCoordinate(point);
}
