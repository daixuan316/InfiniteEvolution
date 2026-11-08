import type { GridPoint } from "./BattleMapModel.ts";

export interface WalkableGrid {
    readonly columns: number;
    readonly rows: number;
    readonly infinite?: boolean;
    isWalkable(cell: GridPoint): boolean;
}

interface SearchNode extends GridPoint {
    g: number;
    f: number;
}

const DIRECTIONS = [
    { x: 1, y: 0, cost: 1 }, { x: -1, y: 0, cost: 1 },
    { x: 0, y: 1, cost: 1 }, { x: 0, y: -1, cost: 1 },
    { x: 1, y: 1, cost: Math.SQRT2 }, { x: 1, y: -1, cost: Math.SQRT2 },
    { x: -1, y: 1, cost: Math.SQRT2 }, { x: -1, y: -1, cost: Math.SQRT2 },
] as const;

function key(cell: GridPoint): string {
    return `${cell.x},${cell.y}`;
}

function octile(a: GridPoint, b: GridPoint): number {
    const dx = Math.abs(a.x - b.x);
    const dy = Math.abs(a.y - b.y);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
}

export class GridPathfinder {
    private readonly grid: WalkableGrid;

    constructor(grid: WalkableGrid) {
        this.grid = grid;
    }

    findPath(start: GridPoint, goal: GridPoint): GridPoint[] {
        if (!this.grid.isWalkable(start) || !this.grid.isWalkable(goal)) return [];
        const margin = 16;
        const searchBounds = this.grid.infinite ? {
            minX: Math.min(start.x, goal.x) - margin,
            maxX: Math.max(start.x, goal.x) + margin,
            minY: Math.min(start.y, goal.y) - margin,
            maxY: Math.max(start.y, goal.y) + margin,
        } : null;
        const startKey = key(start);
        const goalKey = key(goal);
        const open: SearchNode[] = [{ ...start, g: 0, f: octile(start, goal) }];
        const bestCost = new Map<string, number>([[startKey, 0]]);
        const cameFrom = new Map<string, GridPoint>();
        const closed = new Set<string>();

        while (open.length > 0) {
            let bestIndex = 0;
            for (let index = 1; index < open.length; index++) {
                if (open[index].f < open[bestIndex].f) bestIndex = index;
            }
            const current = open.splice(bestIndex, 1)[0];
            const currentKey = key(current);
            if (closed.has(currentKey)) continue;
            if (currentKey === goalKey) return this.reconstruct(cameFrom, current);
            closed.add(currentKey);
            if (this.grid.infinite && closed.size >= 4_096) return [];

            for (const direction of DIRECTIONS) {
                const next = { x: current.x + direction.x, y: current.y + direction.y };
                if (searchBounds && (next.x < searchBounds.minX || next.x > searchBounds.maxX || next.y < searchBounds.minY || next.y > searchBounds.maxY)) continue;
                if (!this.grid.isWalkable(next)) continue;
                if (direction.x !== 0 && direction.y !== 0) {
                    if (!this.grid.isWalkable({ x: current.x + direction.x, y: current.y }) ||
                        !this.grid.isWalkable({ x: current.x, y: current.y + direction.y })) continue;
                }
                const nextKey = key(next);
                if (closed.has(nextKey)) continue;
                const candidate = current.g + direction.cost;
                if (candidate >= (bestCost.get(nextKey) ?? Number.POSITIVE_INFINITY)) continue;
                bestCost.set(nextKey, candidate);
                cameFrom.set(nextKey, { x: current.x, y: current.y });
                open.push({ ...next, g: candidate, f: candidate + octile(next, goal) });
            }
        }
        return [];
    }

    findPathToNearest(start: GridPoint, requestedGoal: GridPoint): GridPoint[] {
        if (!this.grid.isWalkable(start)) return [];
        if (this.grid.infinite) {
            for (let radius = 0; radius <= 12; radius++) {
                const candidates: GridPoint[] = [];
                for (let y = requestedGoal.y - radius; y <= requestedGoal.y + radius; y++) {
                    for (let x = requestedGoal.x - radius; x <= requestedGoal.x + radius; x++) {
                        if (Math.max(Math.abs(x - requestedGoal.x), Math.abs(y - requestedGoal.y)) !== radius) continue;
                        const cell = { x, y };
                        if (this.grid.isWalkable(cell)) candidates.push(cell);
                    }
                }
                candidates.sort((a, b) => octile(a, requestedGoal) - octile(b, requestedGoal));
                for (const candidate of candidates) {
                    const path = this.findPath(start, candidate);
                    if (path.length > 0) return path;
                }
            }
            return [];
        }
        const candidates: GridPoint[] = [];
        for (let y = 0; y < this.grid.rows; y++) {
            for (let x = 0; x < this.grid.columns; x++) {
                const cell = { x, y };
                if (this.grid.isWalkable(cell)) candidates.push(cell);
            }
        }
        candidates.sort((a, b) => octile(a, requestedGoal) - octile(b, requestedGoal));
        for (const candidate of candidates) {
            const path = this.findPath(start, candidate);
            if (path.length > 0) return path;
        }
        return [];
    }

    private reconstruct(cameFrom: Map<string, GridPoint>, goal: GridPoint): GridPoint[] {
        const path: GridPoint[] = [{ x: goal.x, y: goal.y }];
        let cursor = goal;
        while (cameFrom.has(key(cursor))) {
            cursor = cameFrom.get(key(cursor))!;
            path.push({ x: cursor.x, y: cursor.y });
        }
        return path.reverse();
    }
}
