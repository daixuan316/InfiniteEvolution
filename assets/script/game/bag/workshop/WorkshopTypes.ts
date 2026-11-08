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
