import { Color, HorizontalTextAlignment, Label, Size, Vec3, _decorator } from "cc";

import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { workshopRuntime } from "../bag/WorkshopRuntimeProvider";
import { ITEM_DEFINITIONS, WORKSHOP_RECIPES } from "../bag/workshop/WorkshopCatalog.ts";
import { actionTextForReason, formatRemainingTime, materialRequirementLayout } from "../bag/workshop/WorkshopPresentation.ts";
import type { EnqueueFailure, WorkshopCategory, WorkshopRecipe, WorkshopTask } from "../bag/workshop/WorkshopTypes.ts";
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
        void UIBuilder.backdrop(this.node, "gui/hall/texture/ark-garage", new Size(frame.width + 8, frame.height + 8), new Color(118, 138, 158, 255));
        UIBuilder.panel(this.node, "WorkshopShade", new Size(frame.width + 8, frame.height + 8), Vec3.ZERO, new Color(2, 10, 20, 218), new Color(2, 10, 20, 0));
        this.renderHeader(frame);
        this.renderWorkspace(frame);
    }

    private renderHeader(frame: SafeFrame): void {
        const header = UIBuilder.surface(this.node, "WorkshopHeader", new Size(frame.width - UI_THEME.safeMargin * 2, 76), new Vec3(0, frame.top - 43), "large");
        const back = UIBuilder.navButton(header, "BtnBack", "返回方舟", "system-nav/13-exit", new Size(178, 62), new Vec3(-frame.width / 2 + 118, 0));
        this.bindTouch(back, () => { void uiNavigation.back(); });
        void UIBuilder.icon(header, "system-nav/03-workshop", 50, new Vec3(-112, 0));
        UIBuilder.label(header, "PageTitle", "工坊制造", new Size(390, 52), new Vec3(106, 0), 30, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
    }

    private renderWorkspace(frame: SafeFrame): void {
        const top = frame.top - 92;
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
