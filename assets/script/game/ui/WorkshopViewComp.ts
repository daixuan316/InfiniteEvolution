import { Color, HorizontalTextAlignment, Label, Size, Vec3, _decorator } from "cc";

import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { workshopRuntime } from "../bag/WorkshopRuntimeProvider";
import { EQUIPMENT_CATALOG } from "../equipment/config/EquipmentCatalog.ts";
import { WorkshopPresenter, type WorkshopMode } from "../equipment/view/WorkshopPresenter.ts";
import { persistentEquipmentRuntime } from "../save/SaveModule.ts";
import { ITEM_DEFINITIONS, WORKSHOP_RECIPES } from "../bag/workshop/WorkshopCatalog.ts";
import { actionTextForReason, formatRemainingTime, materialRequirementLayout } from "../bag/workshop/WorkshopPresentation.ts";
import type { EnqueueFailure, WorkshopCategory, WorkshopRecipe, WorkshopTask } from "../bag/workshop/WorkshopTypes.ts";
import { UIID } from "../common/config/GameUIConfig";
import { GamePage } from "../common/ui/GamePage";
import type { SafeFrame } from "../common/ui/UIBuilder";
import { UIBuilder } from "../common/ui/UIBuilder";
import { uiNavigation } from "../common/ui/UIRuntime";
import { UI_THEME } from "../common/ui/UITheme";

const { ccclass } = _decorator;

const CATEGORIES: readonly { id: WorkshopCategory; label: string }[] = [
    { id: "weapon", label: "武器" },
    { id: "armor", label: "防具" },
    { id: "module", label: "模块" },
    { id: "supply", label: "补给" },
];

const QUEUE_SLOT_NAMES = ["QueueSlot0", "QueueSlot1", "QueueSlot2"] as const;

const FAILURE_TOAST: Readonly<Record<EnqueueFailure, string>> = {
    "recipe-missing": "配方数据不存在",
    "recipe-locked": "当前工坊等级不足",
    "materials-missing": "制造材料不足",
    "queue-full": "三个制造槽均在工作",
    "output-full": "仓库没有足够的产物空间",
    "save-failed": "保存失败，请重试",
};

@ccclass("WorkshopViewComp")
export class WorkshopViewComp extends GamePage {
    private selectedCategory: WorkshopCategory = "weapon";
    private selectedRecipeId = WORKSHOP_RECIPES[0].id;
    private refreshElapsed = 0;
    private queueLabels: Label[] = [];
    private equipmentMode: WorkshopMode = "craft";
    private equipmentBlueprints = false;
    private equipmentPresenter = new WorkshopPresenter(persistentEquipmentRuntime(), EQUIPMENT_CATALOG);

    protected start(): void {
        workshopRuntime.sync();
        this.render();
    }

    update(deltaTime: number): void {
        this.refreshElapsed += Math.max(0, deltaTime);
        if (this.refreshElapsed < 0.25) return;
        this.refreshElapsed = 0;
        const result = workshopRuntime.sync();
        if (result.changed) this.render();
        else this.refreshQueueLabels();
    }

    private render(): void {
        this.clearBindings();
        this.queueLabels = [];
        const frame = UIBuilder.prepareRoot(this.node);
        void UIBuilder.backdrop(this.node, "gui/hall/texture/ark-garage", new Size(frame.width + 8, frame.height + 8), new Color(150, 148, 138, 255));
        UIBuilder.panel(this.node, "WorkshopShade", new Size(frame.width + 8, frame.height + 8), Vec3.ZERO, new Color(10, 11, 10, 218), new Color(10, 11, 10, 0));
        this.renderHeader(frame);
        this.renderWorkspace(frame);
    }

    private renderHeader(frame: SafeFrame): void {
        const header = UIBuilder.surface(this.node, "WorkshopHeader", new Size(frame.width - UI_THEME.safeMargin * 2, 76), new Vec3(0, frame.top - 43), "large");
        const back = UIBuilder.navButton(header, "BtnBack", "返回方舟", "system-nav/13-exit", new Size(178, 62), new Vec3(-frame.width / 2 + 118, 0));
        this.bindTouch(back, () => { void uiNavigation.back(); });
        void UIBuilder.icon(header, "system-nav/03-workshop", 50, new Vec3(-112, 0));
        UIBuilder.label(header, "PageTitle", "工坊制造", new Size(390, 52), new Vec3(106, 0), 30, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
        const blueprints = UIBuilder.button(header, "BtnEquipmentBlueprints", this.equipmentBlueprints ? "返回补给队列" : "装备蓝图", new Size(176, 54), new Vec3(frame.width / 2 - 132, 0), this.equipmentBlueprints);
        this.bindTouch(blueprints, () => {
            this.equipmentMode = "craft";
            this.equipmentPresenter.setMode("craft");
            this.equipmentBlueprints = !this.equipmentBlueprints;
            this.render();
        });
    }

    private renderWorkspace(frame: SafeFrame): void {
        const tabs: Array<{ name: string; label: string; mode: WorkshopMode }> = [
            { name: "TabCraft", label: "制造", mode: "craft" },
            { name: "TabStrengthen", label: "强化", mode: "strengthen" },
            { name: "TabSynchronize", label: "同步", mode: "synchronize" },
            { name: "TabReroll", label: "改装", mode: "reroll" },
            { name: "TabSalvage", label: "拆解", mode: "salvage" },
        ];
        tabs.forEach((tab, index) => {
            const button = UIBuilder.slot(this.node, tab.name, new Size(150, 52), new Vec3((index - 2) * 158, frame.top - 112), tab.mode === this.equipmentMode);
            UIBuilder.label(button, `${tab.name}Label`, tab.label, new Size(132, 28), Vec3.ZERO, 17, tab.mode === this.equipmentMode ? UI_THEME.colors.orange : UI_THEME.colors.white);
            this.bindTouch(button, () => {
                this.equipmentMode = tab.mode;
                this.equipmentPresenter.setMode(tab.mode);
                if (tab.mode !== "craft") this.equipmentBlueprints = false;
                this.render();
            });
        });
        if (this.equipmentMode === "craft" && this.equipmentBlueprints) {
            this.renderEquipmentCraft(frame);
            return;
        }
        if (this.equipmentMode !== "craft") {
            this.renderEquipmentOperations(frame);
            return;
        }
        const top = frame.top - 146;
        const bottom = frame.bottom + 18;
        const height = top - bottom;
        const y = (top + bottom) / 2;
        const gap = 12;
        const leftWidth = Math.min(274, frame.width * 0.21);
        const rightWidth = Math.min(330, frame.width * 0.25);
        const centerWidth = frame.width - UI_THEME.safeMargin * 2 - leftWidth - rightWidth - gap * 2;
        const leftX = frame.left + leftWidth / 2;
        const centerX = leftX + leftWidth / 2 + gap + centerWidth / 2;
        const rightX = frame.right - rightWidth / 2;

        this.renderRecipeRail(leftX, y, leftWidth, height);
        this.renderRecipePreview(centerX, y, centerWidth, height);
        this.renderQueuePanel(rightX, y, rightWidth, height);
    }

    private renderEquipmentCraft(frame: SafeFrame): void {
        const model = this.equipmentPresenter.setMode("craft").view();
        const top = frame.top - 146;
        const bottom = frame.bottom + 18;
        const height = top - bottom;
        const y = (top + bottom) / 2;
        const leftWidth = Math.min(430, frame.width * 0.35);
        const rightWidth = frame.width - UI_THEME.safeMargin * 2 - leftWidth - 12;
        const left = UIBuilder.surface(this.node, "EquipmentBlueprintList", new Size(leftWidth, height), new Vec3(frame.left + leftWidth / 2, y), "large");
        UIBuilder.label(left, "EquipmentBlueprintTitle", "九类武器蓝图", new Size(leftWidth - 30, 38), new Vec3(0, height / 2 - 30), 22, UI_THEME.colors.white);
        model.recipes.forEach((recipe, index) => {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const selected = model.selectedRecipe?.id === recipe.id;
            const button = UIBuilder.slot(left, `EquipmentRecipe-${recipe.id}`, new Size((leftWidth - 44) / 2, 72), new Vec3((column === 0 ? -1 : 1) * (leftWidth - 30) / 4, height / 2 - 88 - row * 78), selected);
            UIBuilder.label(button, `EquipmentRecipeName-${recipe.id}`, recipe.name, new Size((leftWidth - 66) / 2, 48), Vec3.ZERO, 15, selected ? UI_THEME.colors.orange : UI_THEME.colors.white);
            this.bindTouch(button, () => { this.equipmentPresenter.selectRecipe(recipe.id); this.render(); });
        });

        const details = UIBuilder.surface(this.node, "EquipmentBlueprintDetails", new Size(rightWidth, height), new Vec3(frame.right - rightWidth / 2, y), "large");
        const recipe = model.selectedRecipe;
        UIBuilder.label(details, "EquipmentBlueprintName", recipe?.name ?? "未选择蓝图", new Size(rightWidth - 50, 52), new Vec3(0, height / 2 - 42), 28, UI_THEME.colors.orange);
        const costs = recipe ? Object.entries(recipe.costs).map(([id, amount]) => `${this.materialName(id)} ${model.materials[id as keyof typeof model.materials]} / ${amount}`).join("\n") : "";
        UIBuilder.label(details, "EquipmentBlueprintCosts", costs, new Size(rightWidth - 100, 190), new Vec3(0, 65), 21, model.action.enabled ? UI_THEME.colors.cyan : UI_THEME.colors.danger, HorizontalTextAlignment.LEFT);
        UIBuilder.label(details, "EquipmentBlueprintCapacity", `仓库容量 ${model.instances.length} / ${persistentEquipmentRuntime().snapshot().capacity}\n工坊等级 ${persistentEquipmentRuntime().snapshot().workshopLevel}`, new Size(rightWidth - 100, 70), new Vec3(0, -85), 18, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);
        if (!model.action.enabled) UIBuilder.label(details, "EquipmentCraftBlocked", model.action.reason, new Size(rightWidth - 80, 38), new Vec3(0, -145), 18, UI_THEME.colors.danger);
        const action = UIBuilder.navButton(details, "BtnConfirmEquipmentCraft", model.action.enabled ? "制造并存入装备仓库" : "当前无法制造", "system-nav/14-confirm", new Size(Math.min(430, rightWidth - 100), 78), new Vec3(0, -height / 2 + 58), model.action.enabled);
        this.bindTouch(action, () => {
            const result = this.equipmentPresenter.confirm();
            oops.gui.toast(result.ok === true ? `${recipe?.name ?? "装备"} 制造完成` : `制造失败：${result.error}`);
            this.render();
        });
    }

    private materialName(id: string): string {
        return ({ gold: "金币", scrap: "废料", parts: "零件", electronics: "电子元件", tissue: "异化组织", tagSample: "标签样本", evolutionSample: "进化样本" } as Record<string, string>)[id] ?? id;
    }

    private renderEquipmentOperations(frame: SafeFrame): void {
        const model = this.equipmentPresenter.view();
        const top = frame.top - 146;
        const bottom = frame.bottom + 18;
        const height = top - bottom;
        const y = (top + bottom) / 2;
        const leftWidth = Math.min(440, frame.width * 0.36);
        const rightWidth = frame.width - UI_THEME.safeMargin * 2 - leftWidth - 12;
        const leftX = frame.left + leftWidth / 2;
        const rightX = frame.right - rightWidth / 2;
        const inventory = UIBuilder.surface(this.node, "EquipmentOperationInventory", new Size(leftWidth, height), new Vec3(leftX, y), "large");
        UIBuilder.label(inventory, "OperationInventoryTitle", "选择装备", new Size(leftWidth - 30, 34), new Vec3(0, height / 2 - 28), 21, UI_THEME.colors.white);
        model.instances.slice(0, 12).forEach((item, index) => {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const selected = model.selectedInstance?.instanceId === item.instanceId;
            const card = UIBuilder.slot(inventory, `WorkshopEquipment-${item.instanceId}`, new Size((leftWidth - 44) / 2, 64), new Vec3((column === 0 ? -1 : 1) * (leftWidth - 30) / 4, height / 2 - 82 - row * 70), selected);
            UIBuilder.label(card, `WorkshopEquipmentName-${item.instanceId}`, `${item.name}  Lv.${item.level} +${item.strengthen}`, new Size((leftWidth - 70) / 2, 42), Vec3.ZERO, 14, selected ? UI_THEME.colors.orange : UI_THEME.colors.white);
            this.bindTouch(card, () => { this.equipmentPresenter.selectInstance(item.instanceId); this.render(); });
        });
        const details = UIBuilder.surface(this.node, "EquipmentOperationDetails", new Size(rightWidth, height), new Vec3(rightX, y), "large");
        const selected = model.selectedInstance;
        const title = this.equipmentMode === "strengthen" ? "装备强化" : this.equipmentMode === "synchronize" ? "等级同步" : this.equipmentMode === "reroll" ? "词条改装" : "装备拆解";
        UIBuilder.label(details, "OperationTitle", title, new Size(rightWidth - 36, 44), new Vec3(0, height / 2 - 34), 25, UI_THEME.colors.white);
        UIBuilder.label(details, "OperationSelection", selected ? `${model.instances.find((item) => item.instanceId === selected.instanceId)?.name ?? selected.templateId}\n等级 ${selected.level} · 强化 +${selected.strengthen}\n${selected.affixIds.length} 条词条 · ${selected.evolutionId ? "已进化" : "未进化"}` : "未选择装备", new Size(rightWidth - 70, 118), new Vec3(0, height / 2 - 125), 20, UI_THEME.colors.cyan);
        UIBuilder.label(details, "OperationMaterials", `金币 ${model.materials.gold}    废料 ${model.materials.scrap}    零件 ${model.materials.parts}\n电子元件 ${model.materials.electronics}    标签样本 ${model.materials.tagSample}`, new Size(rightWidth - 70, 74), new Vec3(0, 30), 18, UI_THEME.colors.muted);
        if (!model.action.enabled) UIBuilder.label(details, "OperationBlockedReason", model.action.reason, new Size(rightWidth - 70, 42), new Vec3(0, -55), 18, UI_THEME.colors.danger);
        const actionLabel = this.equipmentMode === "strengthen" ? "确认强化" : this.equipmentMode === "synchronize" ? "确认同步" : this.equipmentMode === "reroll" ? "确认改装" : "确认拆解";
        const actionName = this.equipmentMode === "salvage" ? "BtnConfirmProtectedSalvage" : "BtnConfirmWorkshop";
        const action = UIBuilder.navButton(details, actionName, model.action.enabled ? actionLabel : `${actionLabel}·不可用`, "system-nav/14-confirm", new Size(rightWidth - 72, 76), new Vec3(0, -height / 2 + 58), model.action.enabled);
        this.bindTouch(action, () => {
            if (this.equipmentMode === "salvage" && selected) {
                void uiNavigation.openOverlay(UIID.ConfirmDialog, {
                    title: "确认拆解装备",
                    message: "高品质装备也将被拆解，材料会立即存入仓库。",
                    confirmText: "确认拆解",
                    cancelText: "取消",
                    onConfirm: () => {
                        const result = persistentEquipmentRuntime().salvage(selected.instanceId, true);
                        oops.gui.toast(result.ok === true ? "装备拆解成功" : `拆解失败：${result.error}`);
                        this.render();
                    },
                });
                return;
            }
            const result = this.equipmentPresenter.confirm();
            oops.gui.toast("error" in result ? `操作失败：${result.error}` : `${title}成功`);
            this.render();
        });
    }

    private renderRecipeRail(x: number, y: number, width: number, height: number): void {
        const panel = UIBuilder.surface(this.node, "CategoryRail", new Size(width, height), new Vec3(x, y), "large");
        UIBuilder.label(panel, "CategoryTitle", "制造分类", new Size(width - 30, 34), new Vec3(0, height / 2 - 28), 19, UI_THEME.colors.muted);

        CATEGORIES.forEach((category, index) => {
            const selected = category.id === this.selectedCategory;
            const button = UIBuilder.slot(panel, `Category:${category.id}`, new Size((width - 42) / 2, UI_THEME.touchMin), new Vec3((index % 2 === 0 ? -1 : 1) * (width - 30) / 4, height / 2 - 86 - Math.floor(index / 2) * 80), selected);
            UIBuilder.label(button, `CategoryLabel:${category.id}`, category.label, new Size((width - 58) / 2, 34), Vec3.ZERO, 18, selected ? UI_THEME.colors.orange : UI_THEME.colors.white);
            this.bindTouch(button, () => this.selectCategory(category.id));
        });

        const listHeight = height - 238;
        const list = UIBuilder.surface(panel, "RecipeList", new Size(width - 30, listHeight), new Vec3(0, -height / 2 + listHeight / 2 + 16), "card");
        const recipes = WORKSHOP_RECIPES.filter((recipe) => recipe.category === this.selectedCategory);
        recipes.forEach((recipe, index) => {
            const selected = recipe.id === this.selectedRecipeId;
            const button = UIBuilder.slot(list, `Recipe:${recipe.id}`, new Size(width - 54, 82), new Vec3(0, listHeight / 2 - 52 - index * 90), selected);
            void UIBuilder.icon(button, recipe.icon, 42, new Vec3(-width / 2 + 56, 0));
            UIBuilder.label(button, `RecipeName:${recipe.id}`, recipe.name, new Size(width - 116, 32), new Vec3(28, 14), 18, selected ? UI_THEME.colors.orange : UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
            UIBuilder.label(button, `RecipeTime:${recipe.id}`, formatRemainingTime(recipe.durationMs), new Size(width - 116, 24), new Vec3(28, -18), 14, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);
            this.bindTouch(button, () => {
                this.selectedRecipeId = recipe.id;
                this.render();
            });
        });
    }

    private renderRecipePreview(x: number, y: number, width: number, height: number): void {
        const recipe = this.selectedRecipe();
        const panel = UIBuilder.surface(this.node, "RecipePreview", new Size(width, height), new Vec3(x, y), "large");
        UIBuilder.label(panel, "PreviewTitle", "制造装配台", new Size(width - 40, 42), new Vec3(0, height / 2 - 30), 24, UI_THEME.colors.white);
        UIBuilder.label(panel, "PreviewHint", "扣除材料后进入队列，离开工坊仍会继续制造", new Size(width - 48, 30), new Vec3(0, height / 2 - 68), 15, UI_THEME.colors.muted);

        const product = UIBuilder.slot(panel, "SelectedProduct", new Size(Math.min(250, width * 0.44), 174), new Vec3(0, height / 2 - 178), true);
        void UIBuilder.icon(product, recipe.icon, 92, new Vec3(0, 18));
        UIBuilder.label(product, "SelectedProductName", recipe.name, new Size(220, 34), new Vec3(0, -60), 20, UI_THEME.colors.orange);

        const materialsHeight = Math.max(210, height - 310);
        const materials = UIBuilder.surface(panel, "MaterialRequirements", new Size(width - 36, materialsHeight), new Vec3(0, -height / 2 + materialsHeight / 2 + 16), "card");
        UIBuilder.label(materials, "MaterialsTitle", "材料需求", new Size(width - 70, 34), new Vec3(0, materialsHeight / 2 - 28), 19, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
        const materialLayout = materialRequirementLayout(materialsHeight, recipe.inputs.length);
        recipe.inputs.forEach((input, index) => {
            const item = ITEM_DEFINITIONS[input.itemId];
            const owned = workshopRuntime.service.inventory.count(input.itemId);
            const enough = owned >= input.amount;
            const rowY = materialLayout.rows[index];
            void UIBuilder.icon(materials, item.icon, 34, new Vec3(-width / 2 + 58, rowY));
            UIBuilder.label(materials, `MaterialName:${input.itemId}`, item.name, new Size(width * 0.48, 30), new Vec3(-18, rowY), 17, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
            UIBuilder.label(materials, `MaterialAmount:${input.itemId}`, `${owned} / ${input.amount}`, new Size(width * 0.3, 30), new Vec3(width / 2 - 92, rowY), 18, enough ? UI_THEME.colors.cyan : UI_THEME.colors.orange, HorizontalTextAlignment.RIGHT);
        });
        UIBuilder.label(materials, "CraftDuration", `制造耗时  ${formatRemainingTime(recipe.durationMs)}`, new Size(width - 72, 30), new Vec3(0, materialLayout.footerY), 16, UI_THEME.colors.muted, HorizontalTextAlignment.RIGHT);
    }

    private renderQueuePanel(x: number, y: number, width: number, height: number): void {
        const panel = UIBuilder.surface(this.node, "QueuePanel", new Size(width, height), new Vec3(x, y), "large");
        const tasks = workshopRuntime.service.getTasks();
        UIBuilder.label(panel, "QueueTitle", `制造队列  ${tasks.length} / 3`, new Size(width - 34, 40), new Vec3(0, height / 2 - 30), 22, UI_THEME.colors.white);
        UIBuilder.label(panel, "QueueHint", "三个槽位可同时工作", new Size(width - 40, 28), new Vec3(0, height / 2 - 64), 15, UI_THEME.colors.muted);

        QUEUE_SLOT_NAMES.forEach((name, index) => {
            const task = tasks[index];
            const slot = UIBuilder.slot(panel, name, new Size(width - 34, 112), new Vec3(0, height / 2 - 132 - index * 122), Boolean(task));
            const label = UIBuilder.label(slot, `QueueLabel${index}`, this.queueText(task), new Size(width - 62, 84), Vec3.ZERO, 17, task ? UI_THEME.colors.cyan : UI_THEME.colors.muted);
            this.queueLabels.push(label);
        });

        const reason = workshopRuntime.service.getRecipeAvailability(this.selectedRecipeId);
        const action = UIBuilder.navButton(panel, "BtnPrimaryAction", actionTextForReason(reason), "system-nav/03-workshop", new Size(width - 34, 82), new Vec3(0, -height / 2 + 54), reason === null);
        this.bindTouch(action, () => this.startCraft());
    }

    private refreshQueueLabels(): void {
        const tasks = workshopRuntime.service.getTasks();
        this.queueLabels.forEach((label, index) => {
            label.string = this.queueText(tasks[index]);
        });
    }

    private queueText(task: WorkshopTask | undefined): string {
        if (!task) return "空队列";
        const recipe = workshopRuntime.service.getRecipe(task.recipeId);
        const name = recipe?.name ?? "未知配方";
        if (task.status === "ready") return `${name}\n待领取`;
        return `${name}\n制造中  ${formatRemainingTime(workshopRuntime.service.remainingMs(task.id, Date.now()))}`;
    }

    private selectCategory(category: WorkshopCategory): void {
        this.selectedCategory = category;
        const first = WORKSHOP_RECIPES.find((recipe) => recipe.category === category);
        if (first) this.selectedRecipeId = first.id;
        this.render();
    }

    private selectedRecipe(): WorkshopRecipe {
        return workshopRuntime.service.getRecipe(this.selectedRecipeId) ?? WORKSHOP_RECIPES[0];
    }

    private startCraft(): void {
        const result = workshopRuntime.enqueue(this.selectedRecipeId);
        if ("reason" in result) {
            oops.gui.toast(FAILURE_TOAST[result.reason]);
            return;
        }
        oops.gui.toast(`${this.selectedRecipe().name} 已加入制造队列`);
        this.render();
    }
}
