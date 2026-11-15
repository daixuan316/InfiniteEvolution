import type { EquipmentSlot } from "../equipment/model/EquipmentTypes.ts";
import { persistentEquipmentRuntime } from "../save/SaveModule.ts";

/** Role build and combat-snapshot adapter. */
export class RoleModule {
    combatSnapshot() { return persistentEquipmentRuntime().combatSnapshot(); }
    equip(loadoutId: string, slot: EquipmentSlot, instanceId: string) { return persistentEquipmentRuntime().equip(loadoutId, slot, instanceId); }
    unequip(loadoutId: string, slot: EquipmentSlot) { return persistentEquipmentRuntime().unequip(loadoutId, slot); }
    selectLoadout(loadoutId: string) { return persistentEquipmentRuntime().selectLoadout(loadoutId); }
    swapPrimaries(loadoutId?: string) { return persistentEquipmentRuntime().swapPrimaries(loadoutId); }
}
