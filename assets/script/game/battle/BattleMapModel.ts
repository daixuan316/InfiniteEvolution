export interface GridPoint {
    x: number;
    y: number;
}

export interface WorldPoint {
    x: number;
    y: number;
}

export interface MapPointOfInterest {
    id: string;
    name: string;
    cell: GridPoint;
    kind: "medical" | "supplies" | "signal" | "extraction";
}

export interface BattleMapDefinition {
    readonly columns: number;
    readonly rows: number;
    readonly tileSize: number;
    readonly worldWidth: number;
    readonly worldHeight: number;
    readonly start: GridPoint;
    readonly extraction: GridPoint;
    readonly enemySpawns: readonly GridPoint[];
    readonly pointsOfInterest: readonly MapPointOfInterest[];
    isWalkable(cell: GridPoint): boolean;
    isWorldWalkable(point: WorldPoint, radius?: number): boolean;
    cellToWorld(cell: GridPoint): WorldPoint;
    worldToCell(point: WorldPoint): GridPoint;
}

const COLUMNS = 42;
const ROWS = 24;
const TILE_SIZE = 96;
const VERTICAL_ROADS: ReadonlyArray<readonly [number, number]> = [[2, 6], [12, 15], [22, 25], [32, 35], [38, 40]];
const HORIZONTAL_ROADS: ReadonlyArray<readonly [number, number]> = [[2, 5], [10, 13], [18, 21]];

function withinBand(value: number, bands: ReadonlyArray<readonly [number, number]>): boolean {
    return bands.some(([start, end]) => value >= start && value <= end);
}

/** Shared source of truth for rendering, collision, minimap and A* navigation. */
export function createHospitalDistrictMap(): BattleMapDefinition {
    const worldWidth = COLUMNS * TILE_SIZE;
    const worldHeight = ROWS * TILE_SIZE;

    const isWalkable = ({ x, y }: GridPoint): boolean => {
        if (x < 1 || y < 1 || x >= COLUMNS - 1 || y >= ROWS - 1) return false;
        return withinBand(x, VERTICAL_ROADS) || withinBand(y, HORIZONTAL_ROADS);
    };

    const worldToCell = ({ x, y }: WorldPoint): GridPoint => ({
        x: Math.floor((x + worldWidth / 2) / TILE_SIZE),
        y: Math.floor((y + worldHeight / 2) / TILE_SIZE),
    });

    const cellToWorld = ({ x, y }: GridPoint): WorldPoint => ({
        x: (x + 0.5) * TILE_SIZE - worldWidth / 2,
        y: (y + 0.5) * TILE_SIZE - worldHeight / 2,
    });

    const isWorldWalkable = (point: WorldPoint, radius = 0): boolean => {
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
        return samples.every((sample) => isWalkable(worldToCell(sample)));
    };

    return {
        columns: COLUMNS,
        rows: ROWS,
        tileSize: TILE_SIZE,
        worldWidth,
        worldHeight,
        start: { x: 4, y: 4 },
        extraction: { x: 39, y: 20 },
        enemySpawns: [{ x: 34, y: 20 }, { x: 24, y: 12 }, { x: 14, y: 19 }, { x: 33, y: 4 }],
        pointsOfInterest: [
            { id: "hospital", name: "战地医院", cell: { x: 14, y: 12 }, kind: "medical" },
            { id: "depot", name: "物资仓库", cell: { x: 24, y: 19 }, kind: "supplies" },
            { id: "signal", name: "信号塔", cell: { x: 34, y: 3 }, kind: "signal" },
            { id: "ark", name: "方舟撤离点", cell: { x: 39, y: 20 }, kind: "extraction" },
        ],
        isWalkable,
        isWorldWalkable,
        cellToWorld,
        worldToCell,
    };
}
