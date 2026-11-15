import { CHUNK_COLUMNS, CHUNK_ROWS } from "./InfiniteWorldTypes.ts";
import type { ChunkRoadConnections, LocalCell } from "./InfiniteChunkGenerator.ts";

export type ChunkBackgroundId =
    | "residential-district-a"
    | "residential-district-b"
    | "neighborhood-commercial-a"
    | "hospital-district";

export interface ChunkArtTemplate {
    readonly roadCells: readonly LocalCell[];
    readonly solidCells: readonly LocalCell[];
}

const HOSPITAL_SOLID_CELLS: readonly LocalCell[] = [
    { x: 2, y: 2 },
    { x: 3, y: 2 },
    { x: 9, y: 2 },
    { x: 10, y: 2 },
];

function cellKey(cell: LocalCell): string {
    return `${cell.x}:${cell.y}`;
}

/** Builds the coarse collision grid that matches the streets painted in a chunk texture. */
export function chunkArtTemplate(backgroundId: ChunkBackgroundId, roads: ChunkRoadConnections): ChunkArtTemplate {
    const cells = new Map<string, LocalCell>();
    const add = (x: number, y: number): void => {
        const cell = { x, y };
        cells.set(cellKey(cell), cell);
    };

    const horizontalRows = backgroundId === "hospital-district" ? [2, 3] : [3, 4];
    for (let x = 1; x < CHUNK_COLUMNS - 1; x++) {
        for (const y of horizontalRows) add(x, y);
    }
    for (let y = 1; y < CHUNK_ROWS - 1; y++) {
        add(6, y);
        add(7, y);
    }

    if (roads.north) for (let x = 1; x < CHUNK_COLUMNS - 1; x++) add(x, CHUNK_ROWS - 1);
    if (roads.south) for (let x = 1; x < CHUNK_COLUMNS - 1; x++) add(x, 0);
    if (roads.east) for (let y = 1; y < CHUNK_ROWS - 1; y++) add(CHUNK_COLUMNS - 1, y);
    if (roads.west) for (let y = 1; y < CHUNK_ROWS - 1; y++) add(0, y);

    const solidCells = backgroundId === "hospital-district" ? HOSPITAL_SOLID_CELLS : [];
    for (const solid of solidCells) cells.delete(cellKey(solid));
    const roadCells = [...cells.values()].sort((left, right) => left.y - right.y || left.x - right.x);
    return {
        roadCells,
        solidCells: solidCells.map((cell) => ({ ...cell })),
    };
}
