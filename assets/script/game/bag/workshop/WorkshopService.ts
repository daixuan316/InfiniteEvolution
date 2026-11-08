import { Inventory } from "./Inventory.ts";
import {
    ITEM_DEFINITIONS,
    STARTER_INVENTORY,
    WORKSHOP_RECIPES,
    WORKSHOP_RECIPES_BY_ID,
} from "./WorkshopCatalog.ts";
import type { WorkshopRepository } from "./WorkshopRepository.ts";
import type {
    EnqueueFailure,
    EnqueueResult,
    InventorySnapshot,
    ItemDefinition,
    SyncResult,
    WorkshopRecipe,
    WorkshopSnapshot,
    WorkshopTask,
} from "./WorkshopTypes.ts";

export interface WorkshopServiceOptions {
    repository: WorkshopRepository;
    capacity?: number;
    workshopLevel?: number;
    idFactory?: () => string;
    definitions?: Readonly<Record<string, ItemDefinition>>;
    recipes?: readonly WorkshopRecipe[];
    starterInventory?: Readonly<InventorySnapshot>;
}

function validTimestamp(value: number): boolean {
    return Number.isSafeInteger(value) && value >= 0;
}

function validTask(value: WorkshopTask): boolean {
    return Boolean(value)
        && typeof value.id === "string"
        && value.id.length > 0
        && typeof value.recipeId === "string"
        && value.recipeId.length > 0
        && validTimestamp(value.startedAt)
        && validTimestamp(value.endsAt)
        && value.endsAt >= value.startedAt
        && (value.status === "crafting" || value.status === "ready");
}

export class WorkshopService {
    readonly capacity: number;
    readonly recipes: readonly WorkshopRecipe[];
    inventory: Inventory;
    workshopLevel: number;

    private readonly repository: WorkshopRepository;
    private readonly idFactory: () => string;
    private readonly definitions: Readonly<Record<string, ItemDefinition>>;
    private readonly recipesById: Readonly<Record<string, WorkshopRecipe>>;
    private tasks: WorkshopTask[];
    private initialized: boolean;

    constructor(options: WorkshopServiceOptions) {
        this.repository = options.repository;
        this.capacity = options.capacity ?? 80;
        this.idFactory = options.idFactory ?? (() => `${Date.now()}`);
        this.definitions = options.definitions ?? ITEM_DEFINITIONS;
        this.recipes = options.recipes ?? WORKSHOP_RECIPES;
        this.recipesById = options.recipes
            ? Object.fromEntries(options.recipes.map((recipe) => [recipe.id, recipe]))
            : WORKSHOP_RECIPES_BY_ID;

        const loaded = this.repository.load();
        this.initialized = loaded?.initialized === true;
        this.workshopLevel = Number.isSafeInteger(loaded?.workshopLevel) && loaded!.workshopLevel > 0
            ? loaded!.workshopLevel
            : (options.workshopLevel ?? 1);
        const initialInventory = this.initialized ? (loaded?.inventory ?? {}) : (options.starterInventory ?? STARTER_INVENTORY);
        this.inventory = new Inventory(this.capacity, this.definitions, initialInventory);
        this.tasks = (loaded?.tasks ?? []).filter(validTask).slice(0, 3).map((task) => ({ ...task }));

        if (!this.initialized) {
            this.initialized = true;
            this.persist();
        }
    }

    getTasks(): readonly WorkshopTask[] {
        return this.tasks.map((task) => ({ ...task }));
    }

    getRecipe(recipeId: string): WorkshopRecipe | undefined {
        return this.recipesById[recipeId];
    }

    getRecipeAvailability(recipeId: string): EnqueueFailure | null {
        const recipe = this.recipesById[recipeId];
        if (!recipe) return "recipe-missing";
        if (recipe.requiredWorkshopLevel > this.workshopLevel) return "recipe-locked";
        if (this.tasks.length >= 3) return "queue-full";
        for (const input of recipe.inputs) {
            if (this.inventory.count(input.itemId) < input.amount) return "materials-missing";
        }
        if (!this.canReserveOutput(recipe)) return "output-full";
        return null;
    }

    enqueue(recipeId: string, now: number): EnqueueResult {
        const reason = this.getRecipeAvailability(recipeId);
        if (reason) return { ok: false, reason };

        const recipe = this.recipesById[recipeId];
        const before = this.toSnapshot();
        for (const input of recipe.inputs) {
            this.inventory.remove(input.itemId, input.amount);
        }
        const safeNow = validTimestamp(now) ? now : 0;
        const task: WorkshopTask = {
            id: this.idFactory(),
            recipeId,
            startedAt: safeNow,
            endsAt: safeNow + recipe.durationMs,
            status: "crafting",
        };
        this.tasks.push(task);

        try {
            this.persist();
            return { ok: true, task: { ...task } };
        } catch {
            this.restore(before);
            return { ok: false, reason: "save-failed" };
        }
    }

    addItem(itemId: string, amount: number): boolean {
        const before = this.toSnapshot();
        if (!this.inventory.add(itemId, amount)) return false;
        try {
            this.persist();
            return true;
        } catch {
            this.restore(before);
            return false;
        }
    }

    sync(now: number): SyncResult {
        const before = this.toSnapshot();
        const completedRecipeIds: string[] = [];
        let changed = false;
        const remaining: WorkshopTask[] = [];

        for (const current of this.tasks) {
            const task = { ...current };
            const recipe = this.recipesById[task.recipeId];
            const effectiveNow = validTimestamp(now) ? Math.max(task.startedAt, now) : task.startedAt;
            if (task.status === "crafting" && effectiveNow < task.endsAt) {
                remaining.push(task);
                continue;
            }
            if (!recipe) {
                if (task.status !== "ready") changed = true;
                task.status = "ready";
                remaining.push(task);
                continue;
            }
            if (this.inventory.add(recipe.outputId, recipe.outputAmount)) {
                completedRecipeIds.push(recipe.id);
                changed = true;
            } else {
                if (task.status !== "ready") changed = true;
                task.status = "ready";
                remaining.push(task);
            }
        }

        if (!changed) return { changed: false, completedRecipeIds: [], saveFailed: false };
        this.tasks = remaining;
        try {
            this.persist();
            return { changed: true, completedRecipeIds, saveFailed: false };
        } catch {
            this.restore(before);
            return { changed: false, completedRecipeIds: [], saveFailed: true };
        }
    }

    remainingMs(taskId: string, now: number): number {
        const task = this.tasks.find((candidate) => candidate.id === taskId);
        if (!task || task.status === "ready") return 0;
        const duration = task.endsAt - task.startedAt;
        const effectiveNow = validTimestamp(now) ? Math.max(task.startedAt, now) : task.startedAt;
        return Math.min(duration, Math.max(0, task.endsAt - effectiveNow));
    }

    persist(): void {
        this.repository.save(this.toSnapshot());
    }

    private canReserveOutput(candidate: WorkshopRecipe): boolean {
        const projected = new Inventory(this.capacity, this.definitions, this.inventory.toSnapshot());
        for (const input of candidate.inputs) {
            if (!projected.remove(input.itemId, input.amount)) return false;
        }
        const additions: InventorySnapshot = {};
        for (const task of this.tasks) {
            const recipe = this.recipesById[task.recipeId];
            if (recipe) additions[recipe.outputId] = (additions[recipe.outputId] ?? 0) + recipe.outputAmount;
        }
        additions[candidate.outputId] = (additions[candidate.outputId] ?? 0) + candidate.outputAmount;
        return projected.canFit(additions);
    }

    private toSnapshot(): WorkshopSnapshot {
        return {
            version: 1,
            initialized: this.initialized,
            workshopLevel: this.workshopLevel,
            inventory: this.inventory.toSnapshot(),
            tasks: this.tasks.map((task) => ({ ...task })),
        };
    }

    private restore(snapshot: WorkshopSnapshot): void {
        this.initialized = snapshot.initialized;
        this.workshopLevel = snapshot.workshopLevel;
        this.inventory = new Inventory(this.capacity, this.definitions, snapshot.inventory);
        this.tasks = snapshot.tasks.map((task) => ({ ...task }));
    }
}
