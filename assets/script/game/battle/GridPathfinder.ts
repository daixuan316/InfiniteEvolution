import type { GridPoint } from "./BattleMapModel.ts";

export interface WalkableGrid {
    readonly columns: number;
    readonly rows: number;
    readonly infinite?: boolean;
    navigationBounds?(): { minX: number; maxX: number; minY: number; maxY: number };
    navigationWaypoint?(start: GridPoint, goal: GridPoint): GridPoint | null;
    isNavigationCellReady?(cell: GridPoint): boolean;
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
        const navigationBounds = this.grid.navigationBounds?.();
        if (navigationBounds && (goal.x < navigationBounds.minX || goal.x > navigationBounds.maxX || goal.y < navigationBounds.minY || goal.y > navigationBounds.maxY)) return [];
        if (!this.isWalkable(start) || !this.isWalkable(goal)) return [];
        const margin = 16;
        const searchBounds = this.grid.infinite ? {
            minX: Math.max(navigationBounds?.minX ?? Number.NEGATIVE_INFINITY, Math.min(start.x, goal.x) - margin),
            maxX: Math.min(navigationBounds?.maxX ?? Number.POSITIVE_INFINITY, Math.max(start.x, goal.x) + margin),
            minY: Math.max(navigationBounds?.minY ?? Number.NEGATIVE_INFINITY, Math.min(start.y, goal.y) - margin),
            maxY: Math.min(navigationBounds?.maxY ?? Number.POSITIVE_INFINITY, Math.max(start.y, goal.y) + margin),
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
                if (!this.isWalkable(next)) continue;
                if (direction.x !== 0 && direction.y !== 0) {
                    if (!this.isWalkable({ x: current.x + direction.x, y: current.y }) ||
                        !this.isWalkable({ x: current.x, y: current.y + direction.y })) continue;
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
        if (!this.isWalkable(start)) return [];
        if (this.grid.infinite) {
            const bounds = this.grid.navigationBounds?.();
            const strategicGoal = this.grid.navigationWaypoint?.(start, requestedGoal);
            const boundedGoal = strategicGoal ?? (bounds ? {
                x: Math.max(bounds.minX, Math.min(bounds.maxX, requestedGoal.x)),
                y: Math.max(bounds.minY, Math.min(bounds.maxY, requestedGoal.y)),
            } : requestedGoal);
            for (let radius = 0; radius <= 12; radius++) {
                const candidates: GridPoint[] = [];
                for (let y = boundedGoal.y - radius; y <= boundedGoal.y + radius; y++) {
                    for (let x = boundedGoal.x - radius; x <= boundedGoal.x + radius; x++) {
                        if (Math.max(Math.abs(x - boundedGoal.x), Math.abs(y - boundedGoal.y)) !== radius) continue;
                        if (bounds && (x < bounds.minX || x > bounds.maxX || y < bounds.minY || y > bounds.maxY)) continue;
                        const cell = { x, y };
                        if (this.isWalkable(cell)) candidates.push(cell);
                    }
                }
                candidates.sort((a, b) => octile(a, boundedGoal) - octile(b, boundedGoal));
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

    private isWalkable(cell: GridPoint): boolean {
        return (this.grid.isNavigationCellReady?.(cell) ?? true) && this.grid.isWalkable(cell);
    }
}
