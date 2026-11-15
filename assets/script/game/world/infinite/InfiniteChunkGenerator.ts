import {
    CHUNK_COLUMNS,
    CHUNK_ROWS,
    type ChunkCoordinate,
    type ChunkDirection,
} from "./InfiniteWorldTypes.ts";
import { SeededRandom, chunkKey, deriveSeed } from "./WorldSeed.ts";
import { chunkArtTemplate, type ChunkBackgroundId } from "./InfiniteChunkTemplate.ts";

export type DistrictKind = "residential" | "community" | "industrial" | "open-space";
export type BuildingLotKind = "residential" | "commercial" | "industrial" | "open" | "landmark";
export type LandmarkKind = "hospital" | "police" | "factory" | "laboratory";

export interface LocalCell {
    readonly x: number;
    readonly y: number;
}

export interface ChunkRoadConnections {
    readonly north: boolean;
    readonly east: boolean;
    readonly south: boolean;
    readonly west: boolean;
}

export interface BuildingLotDefinition {
    readonly id: string;
    readonly kind: BuildingLotKind;
    readonly variant: number;
    readonly cell: LocalCell;
    readonly width: number;
    readonly height: number;
}

export interface ChunkLandmarkDefinition {
    readonly id: string;
    readonly kind: LandmarkKind;
    readonly lotId: string;
}

export interface InfiniteChunkDefinition {
    readonly key: string;
    readonly coordinate: ChunkCoordinate;
    readonly district: DistrictKind;
    readonly roads: ChunkRoadConnections;
    readonly roadCells: readonly LocalCell[];
    readonly solidCells: readonly LocalCell[];
    readonly buildingLots: readonly BuildingLotDefinition[];
    readonly landmarks: readonly ChunkLandmarkDefinition[];
    readonly backgroundId: ChunkBackgroundId;
}

const LOTS: ReadonlyArray<Pick<BuildingLotDefinition, "id" | "cell" | "width" | "height">> = [
    { id: "lot:1:1", cell: { x: 1, y: 1 }, width: 4, height: 2 },
    { id: "lot:9:1", cell: { x: 9, y: 1 }, width: 4, height: 2 },
    { id: "lot:1:5", cell: { x: 1, y: 5 }, width: 4, height: 2 },
    { id: "lot:9:5", cell: { x: 9, y: 5 }, width: 4, height: 2 },
];

function positiveModulo(value: number, modulus: number): number {
    return ((value % modulus) + modulus) % modulus;
}

function parentDirection(worldSeed: number, coordinate: ChunkCoordinate): ChunkDirection {
    if (coordinate.x !== 0 && coordinate.y !== 0) {
        const reduceHorizontal = new SeededRandom(deriveSeed(worldSeed, coordinate, "road-parent")).next() < 0.5;
        if (reduceHorizontal) return coordinate.x > 0 ? "west" : "east";
        return coordinate.y > 0 ? "south" : "north";
    }
    if (coordinate.x > 0) return "west";
    if (coordinate.x < 0) return "east";
    if (coordinate.y > 0) return "south";
    if (coordinate.y < 0) return "north";
    return "east";
}

function horizontalEdgeOpen(worldSeed: number, leftChunk: ChunkCoordinate): boolean {
    const rightChunk = { x: leftChunk.x + 1, y: leftChunk.y };
    return parentDirection(worldSeed, leftChunk) === "east"
        || parentDirection(worldSeed, rightChunk) === "west"
        || new SeededRandom(deriveSeed(worldSeed, leftChunk, "road-edge-x")).next() < 0.42;
}

function verticalEdgeOpen(worldSeed: number, lowerChunk: ChunkCoordinate): boolean {
    const upperChunk = { x: lowerChunk.x, y: lowerChunk.y + 1 };
    return parentDirection(worldSeed, lowerChunk) === "north"
        || parentDirection(worldSeed, upperChunk) === "south"
        || new SeededRandom(deriveSeed(worldSeed, lowerChunk, "road-edge-y")).next() < 0.42;
}

function roadConnections(worldSeed: number, coordinate: ChunkCoordinate): ChunkRoadConnections {
    return {
        north: verticalEdgeOpen(worldSeed, coordinate),
        east: horizontalEdgeOpen(worldSeed, coordinate),
        south: verticalEdgeOpen(worldSeed, { x: coordinate.x, y: coordinate.y - 1 }),
        west: horizontalEdgeOpen(worldSeed, { x: coordinate.x - 1, y: coordinate.y }),
    };
}

function districtKind(worldSeed: number, coordinate: ChunkCoordinate): DistrictKind {
    const roll = new SeededRandom(deriveSeed(worldSeed, coordinate, "district")).next();
    if (roll < 0.66) return "residential";
    if (roll < 0.86) return "community";
    if (roll < 0.96) return "industrial";
    return "open-space";
}

function lotKind(random: SeededRandom, district: DistrictKind): BuildingLotKind {
    const roll = random.next();
    if (district === "residential") {
        if (roll < 0.82) return "residential";
        if (roll < 0.92) return "commercial";
        return "open";
    }
    if (district === "community") {
        if (roll < 0.42) return "residential";
        if (roll < 0.87) return "commercial";
        return "open";
    }
    if (district === "industrial") {
        if (roll < 0.22) return "residential";
        if (roll < 0.84) return "industrial";
        return "open";
    }
    if (roll < 0.30) return "residential";
    if (roll < 0.40) return "commercial";
    return "open";
}

function landmarkGridOffset(worldSeed: number, kind: LandmarkKind): LocalCell {
    const random = new SeededRandom(deriveSeed(worldSeed, { x: 0, y: 0 }, `landmark-grid:${kind}`));
    return { x: random.int(0, 4), y: random.int(0, 4) };
}

export function isRareLandmarkAnchor(worldSeed: number, coordinate: ChunkCoordinate, kind: LandmarkKind): boolean {
    if (kind !== "hospital") return false;
    const offset = landmarkGridOffset(worldSeed, kind);
    if (positiveModulo(coordinate.x - offset.x, 5) !== 0 || positiveModulo(coordinate.y - offset.y, 5) !== 0) return false;
    const macro = {
        x: Math.floor((coordinate.x - offset.x) / 5),
        y: Math.floor((coordinate.y - offset.y) / 5),
    };
    return new SeededRandom(deriveSeed(worldSeed, macro, `landmark-enabled:${kind}`)).next() < 0.82;
}

function backgroundId(district: DistrictKind, coordinate: ChunkCoordinate, worldSeed: number, hasHospital: boolean): InfiniteChunkDefinition["backgroundId"] {
    if (hasHospital) return "hospital-district";
    if (district === "community" || district === "industrial") return "neighborhood-commercial-a";
    const random = new SeededRandom(deriveSeed(worldSeed, coordinate, "background"));
    return random.next() < 0.5 ? "residential-district-a" : "residential-district-b";
}

export function generateInfiniteChunk(worldSeed: number, coordinate: ChunkCoordinate): InfiniteChunkDefinition {
    const key = chunkKey(coordinate);
    const district = districtKind(worldSeed, coordinate);
    const roads = roadConnections(worldSeed, coordinate);
    const random = new SeededRandom(deriveSeed(worldSeed, coordinate, "building-lots"));
    const hasHospital = isRareLandmarkAnchor(worldSeed, coordinate, "hospital");
    const background = backgroundId(district, coordinate, worldSeed, hasHospital);
    const artTemplate = chunkArtTemplate(background, roads);
    const buildingLots = LOTS.map((lot, index): BuildingLotDefinition => {
        const fittedLot = hasHospital && lot.cell.y === 1 ? { ...lot, height: 1 } : lot;
        return {
            ...fittedLot,
            kind: hasHospital && index === 0 ? "landmark" : lotKind(random, district),
            variant: random.int(0, 3),
        };
    });
    const landmarks: ChunkLandmarkDefinition[] = hasHospital ? [{
        id: `hospital:${key}`,
        kind: "hospital",
        lotId: buildingLots[0].id,
    }] : [];

    return {
        key,
        coordinate: { x: coordinate.x, y: coordinate.y },
        district,
        roads,
        roadCells: artTemplate.roadCells,
        solidCells: artTemplate.solidCells,
        buildingLots,
        landmarks,
        backgroundId: background,
    };
}

export const CHUNK_PORTALS: Readonly<Record<ChunkDirection, LocalCell>> = {
    north: { x: 6, y: CHUNK_ROWS - 1 },
    east: { x: CHUNK_COLUMNS - 1, y: 3 },
    south: { x: 6, y: 0 },
    west: { x: 0, y: 3 },
};
