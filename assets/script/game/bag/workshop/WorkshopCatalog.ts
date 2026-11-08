import type { InventorySnapshot, ItemDefinition, WorkshopRecipe } from "./WorkshopTypes.ts";

const ITEMS: readonly ItemDefinition[] = [
    { id: "scrap", name: "废料", icon: "resources-items/01-scrap", maxStack: 99 },
    { id: "mechanical_parts", name: "机械零件", icon: "system-nav/03-workshop", maxStack: 99 },
    { id: "alloy", name: "合金", icon: "resources-items/02-alloy", maxStack: 99 },
    { id: "electronics", name: "电子元件", icon: "resources-items/04-energy-cell", maxStack: 99 },
    { id: "medical_supplies", name: "医疗物资", icon: "hud-combat/01-health", maxStack: 99 },
    { id: "assault_rifle", name: "突击步枪", icon: "system-nav/06-storage", maxStack: 1 },
    { id: "shotgun", name: "霰弹枪", icon: "system-nav/06-storage", maxStack: 1 },
    { id: "armor_plate", name: "装甲板", icon: "hud-combat/02-shield", maxStack: 1 },
    { id: "machine_turret", name: "机枪塔模块", icon: "system-nav/03-workshop", maxStack: 1 },
    { id: "medkit", name: "医疗包", icon: "hud-combat/01-health", maxStack: 10 },
    { id: "energy_cell", name: "能源电池", icon: "resources-items/04-energy-cell", maxStack: 10 },
];

export const ITEM_DEFINITIONS: Readonly<Record<string, ItemDefinition>> = Object.freeze(
    Object.fromEntries(ITEMS.map((item) => [item.id, Object.freeze({ ...item })])),
);

export const STARTER_INVENTORY: Readonly<InventorySnapshot> = Object.freeze({
    scrap: 120,
    mechanical_parts: 45,
    alloy: 60,
    electronics: 30,
    medical_supplies: 20,
});

export const WORKSHOP_RECIPES: readonly WorkshopRecipe[] = Object.freeze([
    {
        id: "assault_rifle",
        name: "突击步枪",
        category: "weapon",
        icon: "system-nav/06-storage",
        inputs: [
            { itemId: "scrap", amount: 30 },
            { itemId: "mechanical_parts", amount: 20 },
            { itemId: "electronics", amount: 5 },
        ],
        outputId: "assault_rifle",
        outputAmount: 1,
        durationMs: 45_000,
        requiredWorkshopLevel: 1,
    },
    {
        id: "shotgun",
        name: "霰弹枪",
        category: "weapon",
        icon: "system-nav/06-storage",
        inputs: [
            { itemId: "scrap", amount: 35 },
            { itemId: "mechanical_parts", amount: 25 },
            { itemId: "alloy", amount: 10 },
        ],
        outputId: "shotgun",
        outputAmount: 1,
        durationMs: 60_000,
        requiredWorkshopLevel: 1,
    },
    {
        id: "armor_plate",
        name: "装甲板",
        category: "armor",
        icon: "hud-combat/02-shield",
        inputs: [
            { itemId: "scrap", amount: 25 },
            { itemId: "alloy", amount: 20 },
        ],
        outputId: "armor_plate",
        outputAmount: 1,
        durationMs: 50_000,
        requiredWorkshopLevel: 1,
    },
    {
        id: "machine_turret",
        name: "机枪塔模块",
        category: "module",
        icon: "system-nav/03-workshop",
        inputs: [
            { itemId: "scrap", amount: 40 },
            { itemId: "mechanical_parts", amount: 30 },
            { itemId: "electronics", amount: 15 },
            { itemId: "alloy", amount: 15 },
        ],
        outputId: "machine_turret",
        outputAmount: 1,
        durationMs: 90_000,
        requiredWorkshopLevel: 1,
    },
    {
        id: "medkit",
        name: "医疗包",
        category: "supply",
        icon: "hud-combat/01-health",
        inputs: [
            { itemId: "medical_supplies", amount: 8 },
            { itemId: "scrap", amount: 3 },
        ],
        outputId: "medkit",
        outputAmount: 1,
        durationMs: 25_000,
        requiredWorkshopLevel: 1,
    },
    {
        id: "energy_cell",
        name: "能源电池",
        category: "supply",
        icon: "resources-items/04-energy-cell",
        inputs: [
            { itemId: "scrap", amount: 8 },
            { itemId: "electronics", amount: 6 },
            { itemId: "alloy", amount: 4 },
        ],
        outputId: "energy_cell",
        outputAmount: 1,
        durationMs: 30_000,
        requiredWorkshopLevel: 1,
    },
].map((recipe) => Object.freeze({
    ...recipe,
    inputs: Object.freeze(recipe.inputs.map((input) => Object.freeze({ ...input }))),
})));

export const WORKSHOP_RECIPES_BY_ID: Readonly<Record<string, WorkshopRecipe>> = Object.freeze(
    Object.fromEntries(WORKSHOP_RECIPES.map((recipe) => [recipe.id, recipe])),
);
