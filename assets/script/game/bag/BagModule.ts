import { workshopRuntime } from "./WorkshopRuntimeProvider";

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
}
