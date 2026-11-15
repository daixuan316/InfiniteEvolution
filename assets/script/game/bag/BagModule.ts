import { workshopRuntime } from "./WorkshopRuntimeProvider";
import { persistentEquipmentRuntime } from "../save/SaveModule.ts";

/** 背包 / 物资模块，所有入口共享同一份持久化库存。 */
export class BagModule {
    get inventory() {
        return workshopRuntime.service.inventory;
    }

    get workshop() {
        return workshopRuntime.service;
    }

    addItem(itemId: string, amount: number): boolean {
        return workshopRuntime.addItem(itemId, amount);
    }

    craft(recipeId: string) {
        return workshopRuntime.enqueue(recipeId);
    }

    get equipment() {
        return persistentEquipmentRuntime().snapshot();
    }

    strengthen(instanceId: string) { return persistentEquipmentRuntime().strengthen(instanceId); }
    synchronize(instanceId: string) { return persistentEquipmentRuntime().synchronize(instanceId); }
    reroll(instanceId: string, slot: number) { return persistentEquipmentRuntime().rerollAffix(instanceId, slot, "output"); }
    salvage(instanceId: string, confirmed = false) { return persistentEquipmentRuntime().salvage(instanceId, confirmed); }
}
