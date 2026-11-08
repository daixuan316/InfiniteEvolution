import { validateResearchCatalog } from "./ResearchCatalog.ts";
import {
    DEFAULT_BATTLE_PLAYER_MODIFIERS,
    type BattlePlayerModifiers,
    type ResearchDefinition,
    type ResearchNodeStatus,
    type ResearchQueueEntry,
    type ResearchSaveV1,
    type ResearchStorage,
    type StartResearchResult,
} from "./ResearchTypes.ts";

const SAVE_VERSION = 1 as const;
const MAX_QUEUE_SIZE = 3;

function finiteTime(now: number): number {
    return Number.isFinite(now) ? Math.max(0, Math.floor(now)) : 0;
}

function cloneState(state: ResearchSaveV1): ResearchSaveV1 {
    return {
        version: SAVE_VERSION,
        points: state.points,
        completed: [...state.completed],
        queue: state.queue.map((entry) => ({ ...entry })),
        lastObservedAtMs: state.lastObservedAtMs,
    };
}

export class ResearchRuntime {
    private readonly byId: ReadonlyMap<string, ResearchDefinition>;
    private readonly definitions: readonly ResearchDefinition[];
    private readonly storage: ResearchStorage;
    private readonly defaultPoints: number;
    private state: ResearchSaveV1 | null = null;

    constructor(
        definitions: readonly ResearchDefinition[],
        storage: ResearchStorage,
        defaultPoints = 8,
    ) {
        validateResearchCatalog(definitions);
        this.definitions = definitions;
        this.storage = storage;
        this.defaultPoints = defaultPoints;
        this.byId = new Map(definitions.map((definition) => [definition.id, definition]));
    }

    snapshot(now: number): ResearchSaveV1 {
        this.reconcile(now);
        return cloneState(this.ensureLoaded());
    }

    startResearch(nodeId: string, now: number): StartResearchResult {
        this.reconcile(now);
        const state = this.ensureLoaded();
        const definition = this.byId.get(nodeId);
        if (!definition) return { ok: false, reason: "unknown" };
        if (state.completed.includes(nodeId)) return { ok: false, reason: "completed" };
        if (state.queue.some((entry) => entry.nodeId === nodeId)) return { ok: false, reason: "queued" };
        if (!definition.prerequisites.every((id) => state.completed.includes(id))) {
            return { ok: false, reason: "prerequisite" };
        }
        if (state.points < definition.cost) return { ok: false, reason: "points" };
        if (state.queue.length >= MAX_QUEUE_SIZE) return { ok: false, reason: "queue-full" };

        const effectiveNow = Math.max(finiteTime(now), state.lastObservedAtMs);
        const previousFinish = state.queue.at(-1)?.finishAtMs ?? effectiveNow;
        const entry: ResearchQueueEntry = {
            nodeId,
            finishAtMs: Math.max(effectiveNow, previousFinish) + definition.durationSeconds * 1000,
        };
        this.publish({
            version: SAVE_VERSION,
            points: state.points - definition.cost,
            completed: [...state.completed],
            queue: [...state.queue, entry],
            lastObservedAtMs: effectiveNow,
        });
        return { ok: true, entry: { ...entry } };
    }

    reconcile(now: number): readonly string[] {
        const state = this.ensureLoaded();
        const effectiveNow = Math.max(finiteTime(now), state.lastObservedAtMs);
        const queue = state.queue.map((entry) => ({ ...entry }));
        const completed = [...state.completed];
        const newlyCompleted: string[] = [];

        while (queue.length > 0 && queue[0].finishAtMs <= effectiveNow) {
            const entry = queue.shift()!;
            if (!completed.includes(entry.nodeId)) {
                completed.push(entry.nodeId);
                newlyCompleted.push(entry.nodeId);
            }
        }

        if (newlyCompleted.length > 0 || effectiveNow !== state.lastObservedAtMs) {
            this.publish({
                version: SAVE_VERSION,
                points: state.points,
                completed,
                queue,
                lastObservedAtMs: effectiveNow,
            });
        }
        return newlyCompleted;
    }

    nodeStatus(nodeId: string, now: number): ResearchNodeStatus {
        const state = this.snapshot(now);
        const definition = this.byId.get(nodeId);
        if (!definition) return "locked";
        if (state.completed.includes(nodeId)) return "completed";
        const queueIndex = state.queue.findIndex((entry) => entry.nodeId === nodeId);
        if (queueIndex === 0) return "researching";
        if (queueIndex > 0) return "queued";
        return definition.prerequisites.every((id) => state.completed.includes(id)) ? "available" : "locked";
    }

    modifiers(now: number): BattlePlayerModifiers {
        const state = this.snapshot(now);
        const result = { ...DEFAULT_BATTLE_PLAYER_MODIFIERS };
        for (const nodeId of state.completed) {
            const definition = this.byId.get(nodeId);
            if (!definition) continue;
            for (const effect of definition.effects) {
                switch (effect.stat) {
                    case "maxHealth":
                        result.maxHealthAdd += effect.add;
                        break;
                    case "maxShield":
                        result.maxShieldAdd += effect.add;
                        break;
                    case "attackDamage":
                        result.attackDamageMultiplier *= effect.multiplier;
                        break;
                    case "moveSpeed":
                        result.moveSpeedMultiplier *= effect.multiplier;
                        break;
                }
            }
        }
        return result;
    }

    bioLoad(now: number): number {
        const state = this.snapshot(now);
        return state.completed.reduce((total, nodeId) => total + (this.byId.get(nodeId)?.bioLoad ?? 0), 0);
    }

    private ensureLoaded(): ResearchSaveV1 {
        if (this.state) return this.state;
        let raw: unknown;
        try {
            raw = this.storage.load();
        } catch (error) {
            console.warn("Unable to load research progression; using a new save", error);
        }
        this.state = this.normalize(raw);
        return this.state;
    }

    private normalize(raw: unknown): ResearchSaveV1 {
        const value = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
        const pointsValue = typeof value.points === "number" && Number.isFinite(value.points)
            ? Math.floor(value.points)
            : this.defaultPoints;
        const completed: string[] = [];
        if (Array.isArray(value.completed)) {
            for (const id of value.completed) {
                if (typeof id !== "string" || !this.byId.has(id) || completed.includes(id)) continue;
                completed.push(id);
            }
        }

        const queue: ResearchQueueEntry[] = [];
        if (Array.isArray(value.queue)) {
            for (const candidate of value.queue) {
                if (queue.length >= MAX_QUEUE_SIZE || !candidate || typeof candidate !== "object") continue;
                const entry = candidate as Record<string, unknown>;
                if (typeof entry.nodeId !== "string" || !this.byId.has(entry.nodeId)) continue;
                if (completed.includes(entry.nodeId) || queue.some((item) => item.nodeId === entry.nodeId)) continue;
                if (typeof entry.finishAtMs !== "number" || !Number.isFinite(entry.finishAtMs) || entry.finishAtMs < 0) continue;
                queue.push({ nodeId: entry.nodeId, finishAtMs: Math.floor(entry.finishAtMs) });
            }
        }

        const lastObservedAtMs = typeof value.lastObservedAtMs === "number" && Number.isFinite(value.lastObservedAtMs)
            ? Math.max(0, Math.floor(value.lastObservedAtMs))
            : 0;
        return {
            version: SAVE_VERSION,
            points: Math.max(0, pointsValue),
            completed,
            queue,
            lastObservedAtMs,
        };
    }

    private publish(state: ResearchSaveV1): void {
        const snapshot = cloneState(state);
        this.storage.save(snapshot);
        this.state = snapshot;
    }
}
