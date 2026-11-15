import { ArkService } from "./model/ArkService.ts";
import { ArkRepository, type KeyValueStore } from "./model/ArkRepository.ts";
import type { ArkBattleSettlement, ArkDerivedState, ArkLayoutId, ArkResult, ArkState, PowerPriority } from "./model/ArkTypes.ts";

class MemoryStore implements KeyValueStore {
    private readonly values = new Map<string, string>();
    getItem(key: string): string | null { return this.values.get(key) ?? null; }
    setItem(key: string, value: string): void { this.values.set(key, value); }
}

function defaultStore(): KeyValueStore {
    const candidate = (globalThis as { localStorage?: KeyValueStore }).localStorage;
    return candidate?.getItem && candidate?.setItem ? candidate : new MemoryStore();
}

export type ArkRuntimeListener = (state: ArkState, derived: ArkDerivedState) => void;

class ArkRuntime {
    readonly service: ArkService;
    private readonly repository: ArkRepository;
    private readonly listeners = new Set<ArkRuntimeListener>();

    constructor(store: KeyValueStore = defaultStore()) {
        this.repository = new ArkRepository(store);
        this.service = new ArkService(this.repository.load());
    }

    subscribe(listener: ArkRuntimeListener): () => void {
        this.listeners.add(listener);
        listener(this.service.snapshot(), this.service.derived());
        return () => this.listeners.delete(listener);
    }

    install(layoutId: ArkLayoutId, slotId: string, instanceId: string) { return this.perform(() => this.service.install(layoutId, slotId, instanceId)); }
    remove(layoutId: ArkLayoutId, slotId: string) { return this.perform(() => this.service.remove(layoutId, slotId)); }
    move(layoutId: ArkLayoutId, fromSlotId: string, toSlotId: string) { return this.perform(() => this.service.move(layoutId, fromSlotId, toSlotId)); }
    setPriority(instanceId: string, priority: PowerPriority) { return this.perform(() => this.service.setPriority(instanceId, priority)); }
    switchLayout(layoutId: ArkLayoutId) { return this.perform(() => this.service.switchLayout(layoutId)); }
    enqueueRepair(instanceId: string) { return this.perform(() => this.service.enqueueRepair(instanceId)); }
    processRepair(maxPoints = 100, night = false) { return this.perform(() => this.service.processRepair(maxPoints, night)); }
    applyEvolution(instanceId: string, evolutionId: string) { return this.perform(() => this.service.applyEvolution(instanceId, evolutionId)); }
    removeEvolution(instanceId: string) { return this.perform(() => this.service.removeEvolution(instanceId)); }
    settleBattle(settlement: ArkBattleSettlement) { return this.perform(() => this.service.applyBattleSettlement(settlement)); }

    private perform(command: () => ArkResult<ArkDerivedState>): ArkResult<ArkDerivedState> {
        const result = command();
        if (result.ok) {
            const state = this.service.snapshot();
            this.repository.save(state);
            const derived = this.service.derived();
            for (const listener of this.listeners) listener(state, derived);
        }
        return result;
    }
}

export const arkRuntime = new ArkRuntime();
