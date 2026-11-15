import { Color, HorizontalTextAlignment, Size, Vec3, _decorator } from "cc";

import { oops } from "../../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { UIID } from "../../common/config/GameUIConfig";
import { GamePage } from "../../common/ui/GamePage";
import type { SafeFrame } from "../../common/ui/UIBuilder";
import { UIBuilder } from "../../common/ui/UIBuilder";
import { uiNavigation } from "../../common/ui/UIRuntime";
import { UI_THEME } from "../../common/ui/UITheme";
import { persistentEquipmentRuntime } from "../../save/SaveModule.ts";
import { EQUIPMENT_CATALOG } from "../config/EquipmentCatalog.ts";
import type { EquipmentCommandResult, EquipmentState } from "../model/EquipmentTypes.ts";
import { EquipmentPresenter, type EquipmentCategory } from "./EquipmentPresenter.ts";

const { ccclass } = _decorator;

const CATEGORY_BUTTONS: Array<{ name: string; label: string; slot: EquipmentCategory }> = [
    { name: "TabWeapons", label: "武器", slot: "weapon" },
    { name: "TabArmor", label: "防具", slot: "armor" },
    { name: "TabTactical", label: "战术装置", slot: "tactical" },
    { name: "TabOrgan", label: "进化器官", slot: "organ" },
];
const LOADOUT_BUTTONS = ["BtnLoadout1", "BtnLoadout2", "BtnLoadout3"] as const;

@ccclass("EquipmentViewComp")
export class EquipmentViewComp extends GamePage {
    private presenter = new EquipmentPresenter(persistentEquipmentRuntime(), EQUIPMENT_CATALOG);

    protected start(): void {
        this.render();
    }

    private render(): void {
        this.clearBindings();
        const frame = UIBuilder.prepareRoot(this.node);
        void UIBuilder.backdrop(this.node, "gui/hall/texture/ark-garage", new Size(frame.width + 8, frame.height + 8), new Color(150, 148, 138, 255));
        UIBuilder.panel(this.node, "EquipmentShade", new Size(frame.width + 8, frame.height + 8), Vec3.ZERO, new Color(10, 11, 10, 220), new Color(10, 11, 10, 0));
        this.renderHeader(frame);
        this.renderWorkspace(frame);
    }

    private renderHeader(frame: SafeFrame): void {
        const header = UIBuilder.surface(this.node, "EquipmentHeader", new Size(frame.width - UI_THEME.safeMargin * 2, 76), new Vec3(0, frame.top - 43), "large");
        const back = UIBuilder.navButton(header, "BtnBack", "返回方舟", "system-nav/13-exit", new Size(178, 62), new Vec3(-frame.width / 2 + 118, 0));
        this.bindTouch(back, () => { void uiNavigation.back(); });
        void UIBuilder.icon(header, "system-nav/06-storage", 50, new Vec3(-120, 0));
        UIBuilder.label(header, "PageTitle", "装备与仓库", new Size(390, 52), new Vec3(100, 0), 30, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
    }

    private renderWorkspace(frame: SafeFrame): void {
        const model = this.presenter.view();
        const top = frame.top - 92;
        const bottom = frame.bottom + 18;
        const height = top - bottom;
        const y = (top + bottom) / 2;
        const leftWidth = 220;
        const rightWidth = 310;
        const gap = 12;
        const centerWidth = frame.width - UI_THEME.safeMargin * 2 - leftWidth - rightWidth - gap * 2;
        const leftX = frame.left + leftWidth / 2;
        const centerX = leftX + leftWidth / 2 + gap + centerWidth / 2;
        const rightX = frame.right - rightWidth / 2;
        this.renderCategories(leftX, y, leftWidth, height, model);
        this.renderLoadout(centerX, y, centerWidth, height, model);
        this.renderDetails(rightX, y, rightWidth, height, model);
    }

    private renderCategories(x: number, y: number, width: number, height: number, model: ReturnType<EquipmentPresenter["view"]>): void {
        const panel = UIBuilder.surface(this.node, "CategoryRail", new Size(width, height), new Vec3(x, y), "large");
        UIBuilder.label(panel, "CategoryTitle", `仓库 ${model.capacity.used}/${model.capacity.max}`, new Size(width - 24, 32), new Vec3(0, height / 2 - 28), 18, UI_THEME.colors.muted);
        CATEGORY_BUTTONS.forEach((category, index) => {
            const selected = category.slot === model.category;
            const button = UIBuilder.slot(panel, category.name, new Size(width - 28, 58), new Vec3(0, height / 2 - 78 - index * 64), selected);
            UIBuilder.label(button, `${category.name}Label`, category.label, new Size(width - 44, 30), Vec3.ZERO, 18, selected ? UI_THEME.colors.orange : UI_THEME.colors.white);
            this.bindTouch(button, () => { this.presenter.setCategory(category.slot); this.render(); });
        });
        const materialY = -height / 2 + 86;
        UIBuilder.label(panel, "MaterialScrap", `废料 ${model.materials.scrap}`, new Size(width - 30, 28), new Vec3(0, materialY + 30), 16, UI_THEME.colors.cyan, HorizontalTextAlignment.LEFT);
        UIBuilder.label(panel, "MaterialParts", `零件 ${model.materials.parts}`, new Size(width - 30, 28), new Vec3(0, materialY), 16, UI_THEME.colors.cyan, HorizontalTextAlignment.LEFT);
        UIBuilder.label(panel, "MaterialSamples", `进化样本 ${model.materials.evolutionSample}`, new Size(width - 30, 28), new Vec3(0, materialY - 30), 16, UI_THEME.colors.orange, HorizontalTextAlignment.LEFT);
    }

    private renderLoadout(x: number, y: number, width: number, height: number, model: ReturnType<EquipmentPresenter["view"]>): void {
        const panel = UIBuilder.surface(this.node, "LoadoutWorkspace", new Size(width, height), new Vec3(x, y), "large");
        UIBuilder.label(panel, "WorkspaceTitle", "装备对比台", new Size(width - 32, 38), new Vec3(0, height / 2 - 28), 23, UI_THEME.colors.white);
        model.loadouts.forEach((loadout, index) => {
            const name = LOADOUT_BUTTONS[index];
            const button = UIBuilder.slot(panel, name, new Size(142, 52), new Vec3((index - 1) * 150, height / 2 - 78), loadout.active);
            UIBuilder.label(button, `${name}Label`, loadout.name, new Size(128, 28), Vec3.ZERO, 16, loadout.active ? UI_THEME.colors.orange : UI_THEME.colors.white);
            this.bindTouch(button, () => this.execute(this.presenter.selectLoadout(loadout.id), "方案已切换"));
        });
        const slotStartY = height / 2 - 150;
        model.slots.forEach((slot, index) => {
            const column = index % 4;
            const row = Math.floor(index / 4);
            const node = UIBuilder.slot(panel, `EquipmentSlot-${slot.id}`, new Size((width - 58) / 4, 74), new Vec3(-width / 2 + 25 + (column + 0.5) * ((width - 42) / 4), slotStartY - row * 82), Boolean(slot.instanceId));
            UIBuilder.label(node, `SlotName-${slot.id}`, slot.name, new Size((width - 82) / 4, 52), Vec3.ZERO, 14, slot.instanceId ? UI_THEME.colors.cyan : UI_THEME.colors.muted);
        });
        const listTop = slotStartY - 190;
        model.inventory.slice(0, 9).forEach((item, index) => {
            const column = index % 3;
            const row = Math.floor(index / 3);
            const selected = model.selected?.instanceId === item.instanceId;
            const card = UIBuilder.slot(panel, `EquipmentCard-${item.instanceId}`, new Size((width - 48) / 3, 72), new Vec3((column - 1) * ((width - 36) / 3), listTop - row * 78), selected);
            UIBuilder.label(card, `EquipmentName-${item.instanceId}`, `${item.name}\nLv.${item.level} +${item.strengthen}${item.equipped ? "  [方案]" : ""}`, new Size((width - 70) / 3, 54), Vec3.ZERO, 14, selected ? UI_THEME.colors.orange : UI_THEME.colors.white);
            this.bindTouch(card, () => { this.presenter.select(item.instanceId); this.render(); });
        });
    }

    private renderDetails(x: number, y: number, width: number, height: number, model: ReturnType<EquipmentPresenter["view"]>): void {
        const panel = UIBuilder.surface(this.node, "EquipmentDetails", new Size(width, height), new Vec3(x, y), "large");
        UIBuilder.label(panel, "DetailTitle", model.selected?.name ?? "未选择装备", new Size(width - 28, 40), new Vec3(0, height / 2 - 30), 21, UI_THEME.colors.white);
        const comparisons = [
            ["伤害", model.comparison.damage], ["生命", model.comparison.health], ["护盾", model.comparison.shield],
            ["防御", model.comparison.defense], ["移速", model.comparison.speed],
        ] as const;
        comparisons.forEach(([label, value], index) => {
            const color = value.delta > 0 ? UI_THEME.colors.cyan : value.delta < 0 ? UI_THEME.colors.danger : UI_THEME.colors.muted;
            UIBuilder.label(panel, `Compare-${label}`, `${label}  ${value.current} → ${value.candidate}  (${value.delta >= 0 ? "+" : ""}${value.delta})`, new Size(width - 34, 28), new Vec3(0, height / 2 - 82 - index * 30), 15, color, HorizontalTextAlignment.LEFT);
        });
        const active = model.resonances.filter((item) => item.tier > 0);
        UIBuilder.label(panel, "ResonanceSummary", active.length ? active.map((item) => `${item.tag} ${item.count}/3`).join(" · ") : "暂无标签共鸣", new Size(width - 34, 40), new Vec3(0, 76), 15, UI_THEME.colors.orange);
        const buttons: Array<[string, string, () => void, boolean]> = [
            ["BtnEquip", "装备", () => this.execute(this.presenter.equipSelected(), "装备已生效"), model.actions.equip.enabled],
            ["BtnUnequip", "卸下", () => this.execute(this.presenter.unequipSelected(), "已卸下"), model.actions.unequip.enabled],
            ["BtnFavorite", model.selected?.favorite ? "取消收藏" : "收藏", () => this.execute(this.presenter.toggleFavorite(), "收藏状态已更新"), Boolean(model.selected)],
            ["BtnLock", model.selected?.locked ? "解锁" : "锁定", () => this.execute(this.presenter.toggleLock(), "锁定状态已更新"), Boolean(model.selected)],
            ["BtnEvolve", model.selected?.evolutionId ? "重置进化" : "进化路线 A", () => {
                if (model.selected?.evolutionId) this.execute(this.presenter.resetEvolution(), "进化路线已重置");
                else if (model.evolutionIds[0]) this.execute(this.presenter.chooseEvolution(model.evolutionIds[0]), "进化路线 A 已激活");
            }, model.selected?.evolutionId ? model.actions.resetEvolution.enabled : model.actions.evolve.enabled],
            ["BtnEvolutionB", "进化路线 B", () => {
                if (model.evolutionIds[1]) this.execute(this.presenter.chooseEvolution(model.evolutionIds[1]), "进化路线 B 已激活");
            }, !model.selected?.evolutionId && Boolean(model.evolutionIds[1])],
            ["BtnSwapWeapons", "主副武器换位", () => this.execute(this.presenter.swapWeapons(), "主副武器顺序已切换"), model.category === "weapon"],
            ["BtnSalvage", "拆解", () => this.confirmSalvage(model.selected?.instanceId ?? ""), model.actions.salvage.enabled],
        ];
        buttons.forEach(([name, label, handler, enabled], index) => {
            const column = index % 2;
            const row = Math.floor(index / 2);
            const button = UIBuilder.navButton(panel, name, enabled ? label : `${label}·不可用`, "system-nav/14-confirm", new Size((width - 46) / 2, 58), new Vec3((column === 0 ? -1 : 1) * (width - 30) / 4, 20 - row * 66), enabled && name === "BtnEquip");
            this.bindTouch(button, () => enabled ? handler() : oops.gui.toast("当前操作不可用或装备受到保护"));
        });
        const workshop = UIBuilder.navButton(panel, "BtnOpenWorkshop", "前往工坊强化/改装", "system-nav/03-workshop", new Size(width - 34, 64), new Vec3(0, -height / 2 + 42), true);
        this.bindTouch(workshop, () => { void uiNavigation.push(UIID.Workshop); });
    }

    private execute(result: EquipmentCommandResult<EquipmentState>, success: string): void {
        oops.gui.toast(result.ok === true ? success : `操作失败：${result.error}`);
        this.render();
    }

    private confirmSalvage(instanceId: string): void {
        void uiNavigation.openOverlay(UIID.ConfirmDialog, {
            title: "确认拆解",
            message: "拆解会返还材料，操作不可撤销。",
            confirmText: "确认拆解",
            cancelText: "取消",
            onConfirm: () => this.execute(persistentEquipmentRuntime().salvage(instanceId, true), "装备已拆解"),
        });
    }
}
