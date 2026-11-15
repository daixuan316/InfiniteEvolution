import { ARK_SLOTS, arkModuleById, createDefaultArkState } from "./ArkCatalog.ts";
import type { ArkLayoutId, ArkResourceId, ArkState } from "./ArkTypes.ts";

export interface KeyValueStore {
    getItem(key: string): string | null;
    setItem(key: string, value: string): void;
}

const STORAGE_KEY = "infinite-evolution.ark.v1";
const LAYOUT_IDS: readonly ArkLayoutId[] = ["alpha", "beta", "gamma"];
const RESOURCE_IDS: readonly ArkResourceId[] = ["scrap", "parts", "alloy", "energyCell", "mutationCore"];
const finiteNonNegative = (value: unknown, fallback: number) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : fallback;

export class ArkRepository {
    private readonly storage: KeyValueStore;

    constructor(storage: KeyValueStore) {
        this.storage = storage;
    }

    load(): ArkState {
        const fallback = createDefaultArkState();
        try {
            const raw = this.storage.getItem(STORAGE_KEY);
            if (!raw) return fallback;
            const parsed = JSON.parse(raw) as Partial<ArkState>;
            if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.modules)) return fallback;
            const modules = parsed.modules.filter((item) => item && typeof item.instanceId === "string" && typeof item.definitionId === "string" && arkModuleById(item.definitionId)).map((item) => {
                const definition = arkModuleById(item.definitionId)!;
                return {
                    instanceId: item.instanceId,
                    definitionId: item.definitionId,
                    durability: Math.min(definition.maxDurability, finiteNonNegative(item.durability, definition.maxDurability)),
                    priority: item.priority === "core" || item.priority === "important" ? item.priority : "normal" as const,
                    evolutionId: typeof item.evolutionId === "string" ? item.evolutionId : null,
                    commissioned: item.commissioned !== false,
                };
            });
            if (modules.length === 0) return fallback;
            const known = new Set(modules.map((item) => item.instanceId));
            const layouts = Object.fromEntries(LAYOUT_IDS.map((layoutId) => {
                const source = parsed.layouts?.[layoutId]?.slots ?? {};
                const slots = Object.fromEntries(ARK_SLOTS.map((slot) => {
                    const id = source[slot.id];
                    return [slot.id, typeof id === "string" && known.has(id) ? id : null];
                }));
                return [layoutId, { slots }];
            })) as ArkState["layouts"];
            const resources = { ...fallback.resources };
            for (const id of RESOURCE_IDS) resources[id] = finiteNonNegative(parsed.resources?.[id], fallback.resources[id]);
            return {
                schemaVersion: 1,
                resources,
                modules,
                layouts,
                activeLayoutId: LAYOUT_IDS.includes(parsed.activeLayoutId as ArkLayoutId) ? parsed.activeLayoutId as ArkLayoutId : "alpha",
                repairQueue: Array.isArray(parsed.repairQueue) ? parsed.repairQueue.filter((id): id is string => typeof id === "string" && known.has(id)) : [],
                repairSpentToday: finiteNonNegative(parsed.repairSpentToday, 0),
                coreDurability: finiteNonNegative(parsed.coreDurability, fallback.coreDurability),
                coreMaxDurability: finiteNonNegative(parsed.coreMaxDurability, fallback.coreMaxDurability),
                appliedBattleIds: Array.isArray(parsed.appliedBattleIds) ? parsed.appliedBattleIds.filter((id): id is string => typeof id === "string").slice(-20) : [],
            };
        } catch {
            return fallback;
        }
    }

    save(state: ArkState): void {
        this.storage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
}
