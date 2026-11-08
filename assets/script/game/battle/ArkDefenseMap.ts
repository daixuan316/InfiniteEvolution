import type { BattleMapDefinition, GridPoint, WorldPoint } from "./BattleMapModel.ts";

const COLUMNS = 15;
const ROWS = 9;
const TILE_SIZE = 80;

/** Compact open arena surrounding the Ark's shelter entrance. */
export function createArkDefenseMap(): BattleMapDefinition {
    const worldWidth = COLUMNS * TILE_SIZE;
    const worldHeight = ROWS * TILE_SIZE;

    const isWalkable = ({ x, y }: GridPoint): boolean => x >= 1 && y >= 1 && x < COLUMNS - 1 && y < ROWS - 1;
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
        ];
        return samples.every((sample) => isWalkable(worldToCell(sample)));
    };

    return {
        columns: COLUMNS,
        rows: ROWS,
        tileSize: TILE_SIZE,
        worldWidth,
        worldHeight,
        start: { x: 7, y: 4 },
        extraction: { x: 7, y: 4 },
        enemySpawns: [
            { x: 1, y: 1 },
            { x: 7, y: 1 },
            { x: 13, y: 1 },
            { x: 13, y: 4 },
            { x: 13, y: 7 },
            { x: 7, y: 7 },
            { x: 1, y: 7 },
            { x: 1, y: 4 },
        ],
        pointsOfInterest: [{ id: "ark", name: "方舟庇护所", cell: { x: 7, y: 4 }, kind: "extraction" }],
        loot: [],
        explorationPoints: [],
        obstacles: [],
        barriers: [],
        isWalkable,
        isWorldWalkable,
        cellToWorld,
        worldToCell,
        setBarrierBlocking: () => false,
    };
}
