export type HordePhase = "warning" | "probe" | "assault" | "respite" | "climax" | "cleanup";

export interface HordeInput {
    readonly budget: number;
    readonly maxSpecialTypes: number;
}

export interface HordeUnitCost {
    readonly id: string;
    readonly cost: number;
    readonly special: boolean;
}

export interface HordeSpawn {
    readonly id: string;
    readonly special: boolean;
}

export interface HordePlan {
    readonly units: readonly HordeSpawn[];
    readonly spent: number;
}

export interface HordePhaseDefinition {
    readonly phase: HordePhase;
    readonly duration: number;
    readonly units: readonly HordeSpawn[];
    readonly spawnInterval: number;
}

export interface HordeTickResult {
    readonly spawns: readonly HordeSpawn[];
    readonly phaseChanged: boolean;
    readonly completed: boolean;
}

export function buildHorde(input: HordeInput, catalog: readonly HordeUnitCost[], rng: () => number): HordePlan {
    const budget = Number.isFinite(input.budget) ? Math.max(0, input.budget) : 0;
    const maxSpecialTypes = Number.isFinite(input.maxSpecialTypes) ? Math.max(0, Math.floor(input.maxSpecialTypes)) : 0;
    let remaining = budget;
    const units: HordeSpawn[] = [];
    const specialTypes = new Set<string>();
    const ordered = catalog
        .filter((unit) => Number.isFinite(unit.cost) && unit.cost > 0 && unit.id.length > 0)
        .slice()
        .sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));

    while (true) {
        const candidates = ordered.filter((unit) =>
            unit.cost <= remaining
            && (!unit.special || specialTypes.has(unit.id) || specialTypes.size < maxSpecialTypes)
        );
        if (candidates.length === 0) break;
        const randomValue = rng();
        const roll = Number.isFinite(randomValue) ? Math.max(0, Math.min(0.999999, randomValue)) : 0;
        const picked = candidates[Math.floor(roll * candidates.length)];
        units.push({ id: picked.id, special: picked.special });
        if (picked.special) specialTypes.add(picked.id);
        remaining -= picked.cost;
    }

    return { units, spent: budget - remaining };
}

export class HordeDirector {
    private readonly phases: readonly HordePhaseDefinition[];
    private readonly maxActiveThreats: number;
    private phaseIndex = 0;
    private phaseElapsed = 0;
    private spawnIndex = 0;
    private spawnCooldown = 0;
    private finished = false;

    constructor(
        phases: readonly HordePhaseDefinition[],
        maxActiveThreats = 28,
    ) {
        if (phases.length === 0) throw new RangeError("HordeDirector requires at least one phase");
        this.phases = phases;
        this.maxActiveThreats = maxActiveThreats;
    }

    get phase(): HordePhase {
        return this.phases[this.phaseIndex].phase;
    }

    get completed(): boolean {
        return this.finished;
    }

    get progressRatio(): number {
        if (this.finished) return 1;
        const current = this.phases[this.phaseIndex];
        const phaseProgress = Number.isFinite(current.duration) && current.duration > 0
            ? Math.min(1, this.phaseElapsed / current.duration)
            : 0;
        return Math.min(0.99, (this.phaseIndex + phaseProgress) / this.phases.length);
    }

    tick(deltaTime: number, activeThreats: number): HordeTickResult {
        if (this.finished) return { spawns: [], phaseChanged: false, completed: true };
        const dt = Number.isFinite(deltaTime) ? Math.max(0, deltaTime) : 0;
        const active = Number.isFinite(activeThreats) ? Math.max(0, Math.floor(activeThreats)) : 0;
        const current = this.phases[this.phaseIndex];

        if (current.phase === "cleanup") {
            if (active === 0) this.finished = true;
            return { spawns: [], phaseChanged: false, completed: this.finished };
        }

        this.phaseElapsed += dt;
        this.spawnCooldown -= dt;
        const spawns: HordeSpawn[] = [];
        const interval = Math.max(0.05, current.spawnInterval);
        while (
            this.spawnIndex < current.units.length
            && this.spawnCooldown <= 0
            && active + spawns.length < this.maxActiveThreats
        ) {
            spawns.push(current.units[this.spawnIndex++]);
            this.spawnCooldown += interval;
        }

        let phaseChanged = false;
        if (this.phaseElapsed + Number.EPSILON >= current.duration && this.spawnIndex >= current.units.length) {
            phaseChanged = this.advancePhase();
        }
        return { spawns, phaseChanged, completed: this.finished };
    }

    remainingThreats(activeThreats: number): number {
        const active = Number.isFinite(activeThreats) ? Math.max(0, Math.floor(activeThreats)) : 0;
        if (this.finished) return active;
        let pending = 0;
        for (let index = this.phaseIndex; index < this.phases.length; index++) {
            const start = index === this.phaseIndex ? this.spawnIndex : 0;
            pending += Math.max(0, this.phases[index].units.length - start);
        }
        return active + pending;
    }

    private advancePhase(): boolean {
        if (this.phaseIndex >= this.phases.length - 1) return false;
        this.phaseIndex += 1;
        this.phaseElapsed = 0;
        this.spawnIndex = 0;
        this.spawnCooldown = 0;
        return true;
    }
}

const FIRST_NIGHT_CATALOG: readonly HordeUnitCost[] = [
    { id: "walker", cost: 5, special: false },
    { id: "runner", cost: 10, special: false },
    { id: "brute", cost: 20, special: true },
];

export function createFirstNightHorde(seed = 1): HordeDirector {
    let state = seed >>> 0;
    const rng = (): number => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        return state / 0x100000000;
    };
    const probe = buildHorde({ budget: 20, maxSpecialTypes: 0 }, FIRST_NIGHT_CATALOG, rng);
    const assault = buildHorde({ budget: 40, maxSpecialTypes: 1 }, FIRST_NIGHT_CATALOG, rng);
    const climaxFill = buildHorde({ budget: 35, maxSpecialTypes: 0 }, FIRST_NIGHT_CATALOG, rng);
    const climax: readonly HordeSpawn[] = [{ id: "brute", special: true }, ...climaxFill.units];

    return new HordeDirector([
        { phase: "warning", duration: 5, units: [], spawnInterval: 1 },
        { phase: "probe", duration: 20, units: probe.units, spawnInterval: 1.5 },
        { phase: "assault", duration: 30, units: assault.units, spawnInterval: 1.1 },
        { phase: "respite", duration: 12, units: [], spawnInterval: 1 },
        { phase: "climax", duration: 35, units: climax, spawnInterval: 0.9 },
        { phase: "cleanup", duration: Number.POSITIVE_INFINITY, units: [], spawnInterval: 1 },
    ]);
}
