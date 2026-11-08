import { Color, HorizontalTextAlignment, Node, Size, UITransform, Vec3, _decorator } from "cc";

import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { GameEvent } from "../common/config/GameEvent";
import { UIID } from "../common/config/GameUIConfig";
import { GamePage } from "../common/ui/GamePage";
import { HALL_DEMO_VIEW_MODEL } from "../common/ui/UIDemoData";
import { UIBuilder } from "../common/ui/UIBuilder";
import { FEATURE_ROUTES } from "../common/ui/UIRoute";
import { uiNavigation } from "../common/ui/UIRuntime";
import { UI_THEME } from "../common/ui/UITheme";
import { filledSegments, fitSizeWithin } from "./HallLayout";

const { ccclass } = _decorator;

const BUTTON_NAMES: Readonly<Partial<Record<UIID, string>>> = {
    [UIID.Equipment]: "BtnEquipment",
    [UIID.Workshop]: "BtnWorkshop",
    [UIID.ArkBuild]: "BtnArkBuild",
    [UIID.Research]: "BtnResearch",
    [UIID.Crew]: "BtnCrew",
    [UIID.Intel]: "BtnIntel",
};

const RESOURCE_ICONS: Readonly<Record<string, string>> = {
    scrap: "resources-items/01-scrap",
    alloy: "resources-items/02-alloy",
    energy: "resources-items/04-energy-cell",
};

const RESOURCE_LABELS: Readonly<Record<string, string>> = {
    scrap: "废料",
    alloy: "合金",
    energy: "能源",
};

@ccclass("HallViewComp")
export class HallViewComp extends GamePage {
    protected onLoad(): void {
        this.render();
    }

    private render(): void {
        const frame = UIBuilder.prepareRoot(this.node);
        void UIBuilder.backdrop(this.node, "gui/hall/texture/ark-garage", new Size(frame.width + 8, frame.height + 8), new Color(174, 190, 210, 255));
        UIBuilder.panel(this.node, "HallBackdropShade", new Size(frame.width + 8, frame.height + 8), Vec3.ZERO, new Color(2, 9, 18, 118), new Color(2, 9, 18, 0));

        const topHeight = 82;
        const bottomHeight = 102;
        const topY = frame.top - topHeight / 2;
        const bottomY = frame.bottom + bottomHeight / 2;
        this.renderTopBar(frame.width, topY, topHeight);

        const contentTop = topY - topHeight / 2 - 8;
        const contentBottom = bottomY + bottomHeight / 2 + 8;
        const contentHeight = contentTop - contentBottom;
        const sideWidth = Math.min(258, frame.width * 0.19);
        const gap = 12;
        const contentWidth = frame.width - UI_THEME.safeMargin * 2;
        const centerWidth = contentWidth - sideWidth * 2 - gap * 2;
        const centerY = (contentTop + contentBottom) / 2;
        const leftX = frame.left + sideWidth / 2;
        const rightX = frame.right - sideWidth / 2;
        const centerX = (leftX + sideWidth / 2 + gap + rightX - sideWidth / 2 - gap) / 2;

        this.renderArkStatus(leftX, centerY, sideWidth, contentHeight);
        this.renderArkOverview(centerX, centerY, centerWidth, contentHeight);
        this.renderThreat(rightX, centerY, sideWidth, contentHeight);
        this.renderNavigation(frame.width, bottomY, bottomHeight);
    }

    private renderTopBar(width: number, y: number, height: number): void {
        const topWidth = width - UI_THEME.safeMargin * 2;
        const top = UIBuilder.surface(this.node, "TopStatus", new Size(topWidth, height), new Vec3(0, y), "large");
        const chapterWidth = 330;
        UIBuilder.label(top, "ChapterBadge", "01", new Size(84, 54), new Vec3(-width / 2 + 76, 0), 32, UI_THEME.colors.white);
        UIBuilder.label(top, "Chapter", HALL_DEMO_VIEW_MODEL.chapter, new Size(210, 42), new Vec3(-width / 2 + 210, 0), 21, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
        void UIBuilder.icon(top, "hud-combat/05-day-timer", 48, new Vec3(-width / 2 + chapterWidth + 38, 0));
        UIBuilder.label(top, "Day", `${String(HALL_DEMO_VIEW_MODEL.day).padStart(2, "0")}  ${HALL_DEMO_VIEW_MODEL.phase}`, new Size(220, 42), new Vec3(-width / 2 + chapterWidth + 160, 0), 22, UI_THEME.colors.orange, HorizontalTextAlignment.LEFT);

        const resourceRailWidth = Math.min(404, topWidth * 0.34);
        const resourceRail = UIBuilder.surface(
            top,
            "TopResourceRail",
            new Size(resourceRailWidth, 60),
            new Vec3(topWidth / 2 - resourceRailWidth / 2 - 14, 0),
            "card",
            new Color(194, 226, 232, 255),
        );
        const resourceCellWidth = resourceRailWidth / HALL_DEMO_VIEW_MODEL.resources.length;
        HALL_DEMO_VIEW_MODEL.resources.forEach((resource, index) => {
            const x = -resourceRailWidth / 2 + resourceCellWidth * (index + 0.5);
            const cell = new Node(`ResourceCell:${resource.id}`);
            cell.layer = resourceRail.layer;
            cell.addComponent(UITransform).setContentSize(resourceCellWidth, 52);
            cell.setPosition(x, 0);
            resourceRail.addChild(cell);

            const iconChip = UIBuilder.panel(cell, `ResourceIconChip:${resource.id}`, new Size(42, 42), new Vec3(-resourceCellWidth / 2 + 29, 0), new Color(3, 22, 34, 248), UI_THEME.colors.cyanDark);
            void UIBuilder.icon(iconChip, RESOURCE_ICONS[resource.id], 34);
            UIBuilder.label(cell, `ResourceLabel:${resource.id}`, RESOURCE_LABELS[resource.id], new Size(68, 20), new Vec3(24, 13), 12, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);
            UIBuilder.label(cell, `ResourceValue:${resource.id}`, `${resource.value}`, new Size(72, 28), new Vec3(26, -10), 22, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);

            if (index > 0) {
                UIBuilder.panel(cell, `ResourceDivider:${resource.id}`, new Size(3, 40), new Vec3(-resourceCellWidth / 2, 0), UI_THEME.colors.cyanDark, UI_THEME.colors.cyanDark);
            }
        });
    }

    private renderArkStatus(x: number, y: number, width: number, height: number): void {
        const panel = UIBuilder.surface(this.node, "ArkStatus", new Size(width, height), new Vec3(x, y), "large");
        const header = UIBuilder.panel(panel, "ArkStatusHeader", new Size(width - 30, 46), new Vec3(0, height / 2 - 38), new Color(5, 55, 68, 238), UI_THEME.colors.cyanDark);
        void UIBuilder.icon(header, "system-nav/02-layout", 34, new Vec3(-width / 2 + 44, 0));
        UIBuilder.label(header, "ArkStatusTitle", "方舟状态", new Size(width - 84, 38), new Vec3(24, 0), 21, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);

        this.renderStatusModule(
            panel,
            "CoreStatusModule",
            "hud-combat/01-health",
            "核心耐久",
            HALL_DEMO_VIEW_MODEL.ark.core,
            HALL_DEMO_VIEW_MODEL.ark.coreMax,
            new Vec3(0, height / 2 - 112),
            UI_THEME.colors.cyan,
        );
        this.renderStatusModule(
            panel,
            "PowerStatusModule",
            "hud-combat/02-shield",
            "能源负载",
            HALL_DEMO_VIEW_MODEL.ark.power,
            HALL_DEMO_VIEW_MODEL.ark.powerMax,
            new Vec3(0, height / 2 - 214),
            UI_THEME.colors.orange,
        );

        const module = UIBuilder.slot(panel, "ModuleSlotLights", new Size(width - 34, 104), new Vec3(0, -height / 2 + 72), true);
        const moduleChip = UIBuilder.panel(module, "ModuleIconChip", new Size(48, 48), new Vec3(-width / 2 + 58, 12), new Color(3, 23, 35, 248), UI_THEME.colors.cyanDark);
        void UIBuilder.icon(moduleChip, "system-nav/02-layout", 38);
        UIBuilder.label(module, "ModuleLabel", "可用模块槽", new Size(112, 24), new Vec3(34, 21), 14, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);
        UIBuilder.label(module, "ModuleValue", `${HALL_DEMO_VIEW_MODEL.ark.modules} / ${HALL_DEMO_VIEW_MODEL.ark.modulesMax}`, new Size(112, 32), new Vec3(34, -4), 24, UI_THEME.colors.orange, HorizontalTextAlignment.LEFT);
        this.addSegmentedBar(
            module,
            "ModuleSlotSegments",
            new Size(width - 62, 12),
            new Vec3(0, -35),
            filledSegments(HALL_DEMO_VIEW_MODEL.ark.modules, HALL_DEMO_VIEW_MODEL.ark.modulesMax, HALL_DEMO_VIEW_MODEL.ark.modulesMax),
            HALL_DEMO_VIEW_MODEL.ark.modulesMax,
            UI_THEME.colors.cyan,
        );
    }

    private renderArkOverview(x: number, y: number, width: number, height: number): void {
        const panel = UIBuilder.surface(this.node, "ArkOverview", new Size(width, height), new Vec3(x, y), "large");
        const artSize = fitSizeWithin(768, 512, width - 64, height - 118);
        UIBuilder.panel(
            panel,
            "ArkHeroGlow",
            new Size(Math.min(width - 54, artSize.width + 56), Math.min(height - 102, artSize.height + 34)),
            new Vec3(0, -8),
            new Color(3, 30, 46, 112),
            new Color(22, 154, 174, 150),
        );
        void UIBuilder.sprite(panel, "gui/hall/texture/ark-base", new Size(artSize.width, artSize.height), new Vec3(0, -8)).then((sprite) => {
            if (sprite?.node.isValid) sprite.node.name = "ArkHeroArt";
        });
        UIBuilder.label(panel, "ArkTitle", "移动方舟 · 改装运输车", new Size(width - 48, 44), new Vec3(0, height / 2 - 34), 24, UI_THEME.colors.white);
        UIBuilder.label(panel, "ArkHint", "选择功能模块完成整备 · 日落前出发", new Size(width - 50, 34), new Vec3(0, -height / 2 + 27), 17, UI_THEME.colors.muted);
    }

    private renderThreat(x: number, y: number, width: number, height: number): void {
        const panel = UIBuilder.surface(this.node, "ThreatSummary", new Size(width, height), new Vec3(x, y), "large");
        const header = UIBuilder.panel(panel, "ThreatHeader", new Size(width - 30, 46), new Vec3(0, height / 2 - 38), new Color(61, 8, 34, 238), UI_THEME.colors.magenta);
        void UIBuilder.icon(header, "hud-combat/04-pollution", 36, new Vec3(-width / 2 + 46, 0));
        UIBuilder.label(header, "ThreatTitle", "次夜尸潮", new Size(width - 86, 38), new Vec3(25, 0), 21, UI_THEME.colors.magenta, HorizontalTextAlignment.LEFT);

        const hazard = UIBuilder.panel(panel, "ThreatHazardPlate", new Size(width - 32, 158), new Vec3(0, height / 2 - 152), new Color(87, 12, 39, 246), UI_THEME.colors.danger);
        UIBuilder.label(hazard, "ThreatWarning", "▲  WARNING  ▲", new Size(width - 60, 22), new Vec3(0, 49), 12, UI_THEME.colors.orange);
        UIBuilder.label(hazard, "ThreatLevel", HALL_DEMO_VIEW_MODEL.threat.level, new Size(width - 58, 36), new Vec3(0, 13), 23, UI_THEME.colors.orange);
        UIBuilder.label(hazard, "ThreatEnemy", HALL_DEMO_VIEW_MODEL.threat.enemy, new Size(width - 58, 42), new Vec3(0, -32), 17, UI_THEME.colors.white);

        const countdown = UIBuilder.panel(panel, "ThreatCountdownModule", new Size(width - 34, 104), new Vec3(0, -height / 2 + 74), new Color(18, 13, 23, 248), new Color(111, 57, 78, 255));
        void UIBuilder.icon(countdown, "hud-combat/04-pollution", 38, new Vec3(-width / 2 + 58, 8));
        UIBuilder.label(countdown, "CountdownLabel", "尸潮抵达", new Size(116, 24), new Vec3(35, 22), 14, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);
        UIBuilder.label(countdown, "CountdownValue", HALL_DEMO_VIEW_MODEL.threat.countdown, new Size(116, 42), new Vec3(35, -11), 29, UI_THEME.colors.danger, HorizontalTextAlignment.LEFT);
        this.addSegmentedBar(countdown, "ThreatWarningSegments", new Size(width - 58, 9), new Vec3(0, -42), 4, 8, UI_THEME.colors.orange);
    }

    private renderStatusModule(parent: Node, name: string, icon: string, label: string, value: number, maximum: number, position: Vec3, color: Color): Node {
        const parentWidth = parent.getComponent(UITransform)?.width ?? 240;
        const module = UIBuilder.panel(parent, name, new Size(parentWidth - 32, 88), position, new Color(3, 24, 36, 242), new Color(34, 72, 83, 255));
        const iconChip = UIBuilder.panel(module, `${name}IconChip`, new Size(42, 42), new Vec3(-parentWidth / 2 + 52, 12), new Color(3, 18, 29, 252), UI_THEME.colors.cyanDark);
        void UIBuilder.icon(iconChip, icon, 34);
        UIBuilder.label(module, `${name}Label`, label, new Size(100, 26), new Vec3(-6, 20), 15, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);
        UIBuilder.label(module, `${name}Value`, `${value} / ${maximum}`, new Size(102, 26), new Vec3(50, 20), 16, UI_THEME.colors.white, HorizontalTextAlignment.RIGHT);
        this.addSegmentedBar(module, `${name}Segments`, new Size(parentWidth - 94, 13), new Vec3(24, -23), filledSegments(value, maximum, 10), 10, color);
        return module;
    }

    private addSegmentedBar(parent: Node, name: string, size: Size, position: Vec3, filled: number, count: number, color: Color): Node {
        const root = new Node(name);
        root.layer = parent.layer;
        root.addComponent(UITransform).setContentSize(size);
        root.setPosition(position);
        parent.addChild(root);

        const gap = 4;
        const segmentWidth = (size.width - gap * (count - 1)) / count;
        for (let index = 0; index < count; index += 1) {
            const x = -size.width / 2 + segmentWidth / 2 + index * (segmentWidth + gap);
            const active = index < filled;
            UIBuilder.panel(
                root,
                `${name}:${index + 1}`,
                new Size(segmentWidth, size.height),
                new Vec3(x, 0),
                active ? color : new Color(7, 28, 38, 255),
                active ? color : UI_THEME.colors.cyanDark,
            );
        }
        return root;
    }

    private renderNavigation(width: number, y: number, height: number): void {
        const available = width - UI_THEME.safeMargin * 2;
        const gap = 10;
        const departWidth = Math.min(230, available * 0.18);
        const featureWidth = Math.floor((available - departWidth - gap * 6) / 6);
        const total = featureWidth * 6 + departWidth + gap * 6;
        let x = -total / 2 + featureWidth / 2;

        FEATURE_ROUTES.forEach((route) => {
            const name = BUTTON_NAMES[route.id]!;
            const button = this.createHallNavButton(name, route.title, route.icon, new Size(featureWidth, height - 12), new Vec3(x, y));
            this.bindTouch(button, () => { void uiNavigation.push(route.id); });
            x += featureWidth + gap;
        });

        const departX = x - featureWidth / 2 + departWidth / 2;
        const depart = this.createHallNavButton("BtnDepart", "出发探索", "system-nav/01-map", new Size(departWidth, height - 12), new Vec3(departX, y), true);
        this.bindTouch(depart, () => { void this.depart(); });
    }

    private createHallNavButton(name: string, text: string, icon: string, size: Size, position: Vec3, primary = false): Node {
        const button = UIBuilder.navButton(this.node, name, text, icon, size, position, primary);
        const iconX = primary ? -size.width / 2 + 48 : 0;
        const iconY = primary ? 0 : 10;
        const chip = UIBuilder.panel(
            button,
            `${name}IconChip`,
            new Size(primary ? 58 : 52, primary ? 58 : 52),
            new Vec3(iconX, iconY),
            primary ? new Color(57, 34, 7, 242) : new Color(3, 25, 37, 242),
            primary ? UI_THEME.colors.orange : UI_THEME.colors.cyanDark,
        );
        chip.setSiblingIndex(1);
        UIBuilder.panel(
            button,
            `${name}EnergyRail`,
            new Size(size.width - 24, 5),
            new Vec3(0, size.height / 2 - 8),
            primary ? UI_THEME.colors.orange : UI_THEME.colors.cyan,
            primary ? UI_THEME.colors.orange : UI_THEME.colors.cyan,
        );
        if (primary) {
            UIBuilder.label(button, `${name}Arrow`, "›", new Size(30, 46), new Vec3(size.width / 2 - 24, 1), 34, UI_THEME.colors.orange);
        }
        return button;
    }

    private async depart(): Promise<void> {
        if (await uiNavigation.replace(UIID.BattleHUD)) {
            oops.message.dispatchEvent(GameEvent.EnterBattle);
        }
    }
}
