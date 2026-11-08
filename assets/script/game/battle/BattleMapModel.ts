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

export type ResourceKind = "scrap" | "medical" | "ammo" | "parts" | "intel";

export interface MapReward {
    readonly kind: ResourceKind;
    readonly amount: number;
}

export interface MapLootDefinition {
    readonly id: string;
    readonly typeId: "supply-crate" | "medical-cabinet" | "weapon-case" | "hidden-cache";
    readonly name: string;
    readonly cell: GridPoint;
    readonly initiallyDiscovered: boolean;
    readonly rewards: readonly MapReward[];
}

export interface MapExplorationDefinition {
    readonly id: string;
    readonly typeId: "medical-terminal" | "rescue-beacon" | "radar-terminal";
    readonly name: string;
    readonly cell: GridPoint;
    readonly rewards: readonly MapReward[];
}

export interface MapBarrierDefinition {
    readonly id: string;
    readonly typeId: "breakable-barrier";
    readonly name: string;
    readonly cell: GridPoint;
    readonly blockedCells: readonly GridPoint[];
    readonly maxHealth: number;
    readonly defense: number;
    readonly radius: number;
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
    readonly loot: readonly MapLootDefinition[];
    readonly explorationPoints: readonly MapExplorationDefinition[];
    readonly barriers: readonly MapBarrierDefinition[];
    isWalkable(cell: GridPoint): boolean;
    isWorldWalkable(point: WorldPoint, radius?: number): boolean;
    cellToWorld(cell: GridPoint): WorldPoint;
    worldToCell(point: WorldPoint): GridPoint;
    setBarrierBlocking(id: string, blocking: boolean): boolean;
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
    const loot: readonly MapLootDefinition[] = [
        {
            id: "loot-hospital-medical",
            typeId: "medical-cabinet",
            name: "医院医疗柜",
            cell: { x: 14, y: 11 },
            initiallyDiscovered: true,
            rewards: [{ kind: "medical", amount: 3 }],
        },
        {
            id: "loot-depot-supply",
            typeId: "supply-crate",
            name: "仓库物资箱",
            cell: { x: 23, y: 20 },
            initiallyDiscovered: true,
            rewards: [{ kind: "scrap", amount: 5 }, { kind: "parts", amount: 2 }],
        },
        {
            id: "loot-signal-weapon",
            typeId: "weapon-case",
            name: "信号塔武器箱",
            cell: { x: 33, y: 3 },
            initiallyDiscovered: true,
            rewards: [{ kind: "ammo", amount: 4 }, { kind: "parts", amount: 1 }],
        },
        {
            id: "loot-hidden-cache",
            typeId: "hidden-cache",
            name: "隐藏缓存点",
            cell: { x: 5, y: 20 },
            initiallyDiscovered: false,
            rewards: [{ kind: "parts", amount: 4 }, { kind: "intel", amount: 2 }],
        },
    ];
    const explorationPoints: readonly MapExplorationDefinition[] = [
        {
            id: "explore-medical-terminal",
            typeId: "medical-terminal",
            name: "医疗终端",
            cell: { x: 13, y: 3 },
            rewards: [{ kind: "medical", amount: 2 }],
        },
        {
            id: "explore-rescue-beacon",
            typeId: "rescue-beacon",
            name: "求救信标",
            cell: { x: 24, y: 12 },
            rewards: [{ kind: "intel", amount: 2 }],
        },
        {
            id: "explore-radar-terminal",
            typeId: "radar-terminal",
            name: "雷达终端",
            cell: { x: 34, y: 19 },
            rewards: [{ kind: "intel", amount: 1 }],
        },
    ];
    const barriers: readonly MapBarrierDefinition[] = [{
        id: "barrier-shortcut-west",
        typeId: "breakable-barrier",
        name: "可破坏路障",
        cell: { x: 8, y: 3 },
        blockedCells: [{ x: 8, y: 2 }, { x: 8, y: 3 }, { x: 8, y: 4 }, { x: 8, y: 5 }],
        maxHealth: 240,
        defense: 15,
        radius: 54,
    }];

    const baseWalkable = ({ x, y }: GridPoint): boolean => {
        if (x < 1 || y < 1 || x >= COLUMNS - 1 || y >= ROWS - 1) return false;
        return withinBand(x, VERTICAL_ROADS) || withinBand(y, HORIZONTAL_ROADS);
    };
    const blockedCells = new Set<string>(barriers.flatMap((barrier) => barrier.blockedCells.map((cell) => `${cell.x}:${cell.y}`)));
    const isWalkable = ({ x, y }: GridPoint): boolean => baseWalkable({ x, y }) && !blockedCells.has(`${x}:${y}`);

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
        loot,
        explorationPoints,
        barriers,
        isWalkable,
        isWorldWalkable,
        cellToWorld,
        worldToCell,
        setBarrierBlocking(id: string, blocking: boolean): boolean {
            const barrier = barriers.find((candidate) => candidate.id === id);
            if (!barrier) return false;
            for (const cell of barrier.blockedCells) {
                const key = `${cell.x}:${cell.y}`;
                if (blocking) blockedCells.add(key);
                else blockedCells.delete(key);
            }
            return true;
        },
    };
}
