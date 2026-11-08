export const GENERATION_VERSION = 1;
export const CELL_SIZE = 96;
export const CHUNK_COLUMNS = 14;
export const CHUNK_ROWS = 8;
export const CHUNK_WORLD_WIDTH = CHUNK_COLUMNS * CELL_SIZE;
export const CHUNK_WORLD_HEIGHT = CHUNK_ROWS * CELL_SIZE;

export interface ChunkCoordinate {
    readonly x: number;
    readonly y: number;
}

export type ChunkKey = `${number}:${number}`;
export type ChunkDirection = "north" | "east" | "south" | "west";

export interface PermanentWorldPosition {
    readonly x: number;
    readonly y: number;
}
