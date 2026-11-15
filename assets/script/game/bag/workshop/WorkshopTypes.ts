export type WorkshopCategory = "weapon" | "armor" | "module" | "supply";

export interface ItemDefinition {
    id: string;
    name: string;
    icon: string;
    maxStack: number;
}

export interface RecipeInput {
    itemId: string;
    amount: number;
}

export interface WorkshopRecipe {
    id: string;
    name: string;
    category: WorkshopCategory;
    icon: string;
    inputs: readonly RecipeInput[];
    outputId: string;
    outputAmount: number;
    durationMs: number;
    requiredWorkshopLevel: number;
}

export type InventorySnapshot = Record<string, number>;

export type WorkshopTaskStatus = "crafting" | "ready";

export interface WorkshopTask {
    id: string;
    recipeId: string;
    startedAt: number;
    endsAt: number;
    status: WorkshopTaskStatus;
}

export interface WorkshopSnapshot {
    version: 1;
    initialized: boolean;
    workshopLevel: number;
    inventory: InventorySnapshot;
    tasks: WorkshopTask[];
}

export type EnqueueFailure =
    | "recipe-missing"
    | "recipe-locked"
    | "materials-missing"
    | "queue-full"
    | "output-full"
    | "save-failed";

export type EnqueueResult =
    | { ok: true; task: WorkshopTask }
    | { ok: false; reason: EnqueueFailure };

export interface SyncResult {
    changed: boolean;
    completedRecipeIds: string[];
    saveFailed: boolean;
}
