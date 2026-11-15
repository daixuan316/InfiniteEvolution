import type { BattleMemoryDelta } from "../equipment/EquipmentRuntime.ts";
import { persistentEquipmentRuntime } from "../save/SaveModule.ts";

/** Equipment combat-memory and evolution command adapter. */
export class EvolveModule {
    recordBattle(battleId: string, deltas: readonly BattleMemoryDelta[]) { return persistentEquipmentRuntime().recordBattleMemory(battleId, deltas); }
    choose(instanceId: string, evolutionId: string) { return persistentEquipmentRuntime().chooseEvolution(instanceId, evolutionId); }
    reset(instanceId: string) { return persistentEquipmentRuntime().resetEvolution(instanceId); }
}
