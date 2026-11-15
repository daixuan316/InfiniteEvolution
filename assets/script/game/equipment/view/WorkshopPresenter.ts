import { getTemplate } from "../config/EquipmentCatalog.ts";
import type { EquipmentRuntime } from "../EquipmentRuntime.ts";
import type { EquipmentCatalog, EquipmentCommandResult, EquipmentState, MaterialId } from "../model/EquipmentTypes.ts";

export type WorkshopMode = "craft" | "strengthen" | "synchronize" | "reroll" | "salvage";

export class WorkshopPresenter {
    private readonly runtime: EquipmentRuntime;
    private readonly catalog: EquipmentCatalog;
    private mode: WorkshopMode = "craft";
    private recipeId: string;
    private instanceId: string | null = null;

    constructor(runtime: EquipmentRuntime, catalog: EquipmentCatalog) {
        this.runtime = runtime;
        this.catalog = catalog;
        this.recipeId = catalog.recipes[0]?.id ?? "";
    }

    setMode(mode: WorkshopMode): this {
        this.mode = mode;
        return this;
    }

    selectRecipe(id: string): this {
        this.recipeId = id;
        return this;
    }

    selectInstance(id: string): this {
        this.instanceId = id;
        return this;
    }

    view() {
        const state = this.runtime.snapshot();
        const recipe = this.catalog.recipes.find((item) => item.id === this.recipeId) ?? this.catalog.recipes[0] ?? null;
        const selected = state.instances.find((item) => item.instanceId === this.instanceId) ?? state.instances[0] ?? null;
        if (selected) this.instanceId = selected.instanceId;
        const referenced = selected ? state.loadouts.some((loadout) => Object.values(loadout.slots).includes(selected.instanceId)) : false;
        let enabled = true;
        let reason = "";
        if (this.mode === "craft" && recipe) {
            if (recipe.minimumWorkshopLevel > state.workshopLevel) { enabled = false; reason = "工坊等级不足"; }
            else if (state.instances.length >= state.capacity) { enabled = false; reason = "仓库已满"; }
            else if (!this.canAfford(state, recipe.costs)) { enabled = false; reason = "材料不足"; }
        } else if (!selected) {
            enabled = false;
            reason = "未选择装备";
        } else if (this.mode === "salvage") {
            if (referenced) { enabled = false; reason = "方案正在使用该装备"; }
            else if (selected.favorite) { enabled = false; reason = "收藏装备受到保护"; }
            else if (selected.locked) { enabled = false; reason = "锁定装备受到保护"; }
            else if (selected.evolutionId) { enabled = false; reason = "已进化装备受到保护"; }
        }
        return {
            mode: this.mode,
            modes: ["craft", "strengthen", "synchronize", "reroll", "salvage"] as WorkshopMode[],
            recipes: this.catalog.recipes.map((item) => ({ ...item, name: getTemplate(this.catalog, item.templateId)?.name ?? item.templateId })),
            selectedRecipe: recipe ? { ...recipe, name: getTemplate(this.catalog, recipe.templateId)?.name ?? recipe.templateId } : null,
            instances: state.instances.map((item) => ({ ...structuredClone(item), name: getTemplate(this.catalog, item.templateId)?.name ?? item.templateId })),
            selectedInstance: selected,
            materials: structuredClone(state.materials),
            action: { enabled, reason },
        };
    }

    confirm(): EquipmentCommandResult<EquipmentState> {
        const model = this.view();
        if (!model.action.enabled) return { ok: false, error: model.action.reason.includes("材料") ? "insufficient-materials" : "protected-instance" };
        if (this.mode === "craft") return this.runtime.craft(this.recipeId);
        if (!this.instanceId) return { ok: false, error: "missing-instance" };
        if (this.mode === "strengthen") return this.runtime.strengthen(this.instanceId);
        if (this.mode === "synchronize") return this.runtime.synchronize(this.instanceId);
        if (this.mode === "reroll") return this.runtime.rerollAffix(this.instanceId, 0, "output");
        return this.runtime.salvage(this.instanceId, false);
    }

    private canAfford(state: EquipmentState, costs: Partial<Record<MaterialId, number>>): boolean {
        return (Object.entries(costs) as Array<[MaterialId, number]>).every(([id, amount]) => state.materials[id] >= amount);
    }
}
