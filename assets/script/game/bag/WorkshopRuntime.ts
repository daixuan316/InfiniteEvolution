import { WorkshopService } from "./workshop/WorkshopService.ts";
import type { EnqueueResult, SyncResult } from "./workshop/WorkshopTypes.ts";

export type WorkshopRuntimeEvent = "InventoryChanged" | "WorkshopQueueChanged" | "CraftCompleted";
export type WorkshopEventPublisher = (event: WorkshopRuntimeEvent, payload: Readonly<Record<string, unknown>>) => void;

export class WorkshopRuntime {
    readonly service: WorkshopService;
    private readonly now: () => number;
    private readonly publish: WorkshopEventPublisher;

    constructor(service: WorkshopService, now: () => number, publish: WorkshopEventPublisher) {
        this.service = service;
        this.now = now;
        this.publish = publish;
    }

    enqueue(recipeId: string): EnqueueResult {
        const result = this.service.enqueue(recipeId, this.now());
        if (result.ok) {
            this.publish("InventoryChanged", { recipeId });
            this.publish("WorkshopQueueChanged", { recipeId, taskId: result.task.id });
        }
        return result;
    }

    sync(): SyncResult {
        const result = this.service.sync(this.now());
        if (result.changed) {
            this.publish("InventoryChanged", { completedRecipeIds: result.completedRecipeIds });
            this.publish("WorkshopQueueChanged", { completedRecipeIds: result.completedRecipeIds });
            for (const recipeId of result.completedRecipeIds) {
                this.publish("CraftCompleted", { recipeId });
            }
        }
        return result;
    }

    addItem(itemId: string, amount: number): boolean {
        const added = this.service.addItem(itemId, amount);
        if (added) this.publish("InventoryChanged", { itemId, amount });
        return added;
    }
}
