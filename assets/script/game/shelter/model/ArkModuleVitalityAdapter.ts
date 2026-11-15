import { VitalityRuntime } from "../../combat/Vitality.ts";

export interface ArkModuleDurabilityState {
    durability: number;
    maxDurability: number;
    operational: boolean;
    destroyed: boolean;
}

function createRuntime(state: ArkModuleDurabilityState): VitalityRuntime {
    return new VitalityRuntime({
        maxHealth: state.maxDurability,
        initialHealth: state.durability,
        zeroState: "disabled",
    });
}

function project<T extends ArkModuleDurabilityState>(state: T, runtime: VitalityRuntime): T {
    return {
        ...state,
        durability: runtime.currentHealth,
        operational: runtime.active,
        destroyed: false,
    } as T;
}

export function damageArkModule<T extends ArkModuleDurabilityState>(state: T, amount: number): T {
    const runtime = createRuntime(state);
    runtime.applyDamage(amount);
    return project(state, runtime);
}

export function repairArkModule<T extends ArkModuleDurabilityState>(state: T, amount: number): T {
    const runtime = createRuntime(state);
    runtime.repair(amount);
    return project(state, runtime);
}
