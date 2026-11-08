import {
    CHUNK_COLUMNS,
    CHUNK_ROWS,
    type ChunkCoordinate,
    type ChunkDirection,
} from "./InfiniteWorldTypes.ts";
import { SeededRandom, chunkKey, deriveSeed } from "./WorldSeed.ts";

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
    readonly buildingLots: readonly BuildingLotDefinition[];
    readonly landmarks: readonly ChunkLandmarkDefinition[];
    readonly backgroundId: "residential-district-a" | "residential-district-b" | "neighborhood-commercial-a" | "hospital-district";
}

const LOTS: ReadonlyArray<Pick<BuildingLotDefinition, "id" | "cell" | "width" | "height">> = [
    { id: "lot:1:0", cell: { x: 1, y: 0 }, width: 4, height: 3 },
    { id: "lot:9:0", cell: { x: 9, y: 0 }, width: 4, height: 3 },
    { id: "lot:1:5", cell: { x: 1, y: 5 }, width: 4, height: 3 },
    { id: "lot:9:5", cell: { x: 9, y: 5 }, width: 4, height: 3 },
];

function positiveModulo(value: number, modulus: number): number {
    return ((value % modulus) + modulus) % modulus;
}

function verticalEdgeOpen(worldSeed: number, lowerChunk: ChunkCoordinate): boolean {
    return new SeededRandom(deriveSeed(worldSeed, lowerChunk, "road-edge-y")).next() < 0.58;
}

function roadConnections(worldSeed: number, coordinate: ChunkCoordinate): ChunkRoadConnections {
    return {
        north: verticalEdgeOpen(worldSeed, coordinate),
        east: true,
        south: verticalEdgeOpen(worldSeed, { x: coordinate.x, y: coordinate.y - 1 }),
        west: true,
    };
}

function createRoadCells(roads: ChunkRoadConnections): LocalCell[] {
    const cells = new Map<string, LocalCell>();
    const add = (x: number, y: number): void => {
        cells.set(`${x}:${y}`, { x, y });
    };

    for (let x = 0; x < CHUNK_COLUMNS; x++) {
        add(x, 3);
        add(x, 4);
    }
    if (roads.south) {
        for (let y = 0; y <= 4; y++) {
            add(6, y);
            add(7, y);
        }
    }
    if (roads.north) {
        for (let y = 3; y < CHUNK_ROWS; y++) {
            add(6, y);
            add(7, y);
        }
    }
    return [...cells.values()].sort((left, right) => left.y - right.y || left.x - right.x);
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
    const buildingLots = LOTS.map((lot, index): BuildingLotDefinition => ({
        ...lot,
        kind: hasHospital && index === 0 ? "landmark" : lotKind(random, district),
        variant: random.int(0, 3),
    }));
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
        roadCells: createRoadCells(roads),
        buildingLots,
        landmarks,
        backgroundId: backgroundId(district, coordinate, worldSeed, hasHospital),
    };
}

export const CHUNK_PORTALS: Readonly<Record<ChunkDirection, LocalCell>> = {
    north: { x: 6, y: CHUNK_ROWS - 1 },
    east: { x: CHUNK_COLUMNS - 1, y: 3 },
    south: { x: 6, y: 0 },
    west: { x: 0, y: 3 },
};
