import { Color, HorizontalTextAlignment, Node, Size, Vec3, _decorator } from "cc";

import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { GameEvent } from "../common/config/GameEvent";
import { GamePage } from "../common/ui/GamePage";
import type { PageParams } from "../common/ui/UINavigationService.ts";
import { UIBuilder, type SafeFrame } from "../common/ui/UIBuilder";
import { uiNavigation } from "../common/ui/UIRuntime";
import { UI_THEME } from "../common/ui/UITheme";
import { createHospitalDistrictMap } from "../battle/BattleMapModel.ts";
import {
    INTEL_EVENTS,
    INTEL_TARGETS,
    NEXT_HORDE_FORECAST,
    findIntelTarget,
    intelTargetDistanceMeters,
    type IntelEventDefinition,
    type IntelRisk,
    type IntelTargetDefinition,
    type IntelTargetId,
} from "./model/IntelCatalog.ts";
import { intelRuntime } from "./model/IntelRuntime.ts";

const { ccclass } = _decorator;

type IntelTab = "map" | "mission" | "event" | "horde";

const TAB_DEFINITIONS: readonly { readonly id: IntelTab; readonly label: string; readonly name: string }[] = [
    { id: "map", label: "地图", name: "TabMap" },
    { id: "mission", label: "任务", name: "TabMission" },
    { id: "event", label: "事件", name: "TabEvent" },
    { id: "horde", label: "尸潮", name: "TabHorde" },
];

const RISK_LABELS: Readonly<Record<IntelRisk, string>> = {
    low: "低危",
    medium: "中危",
    high: "高危",
};

@ccclass("IntelPageViewComp")
export class IntelPageViewComp extends GamePage {
    private readonly map = createHospitalDistrictMap();
    private activeTab: IntelTab = "map";
    private previewTargetId: IntelTargetId | null = intelRuntime.selectedTargetId;
    private selectedEventId: IntelEventDefinition["id"] = INTEL_EVENTS[0].id;
    private started = false;

    configure(params: PageParams): void {
        super.configure(params);
        if (this.started) this.render();
    }

    protected start(): void {
        this.started = true;
        this.render();
    }

    private render(): void {
        this.clearBindings();
        const frame = UIBuilder.prepareRoot(this.node);
        void UIBuilder.backdrop(this.node, "gui/hall/texture/ark-garage", new Size(frame.width + 8, frame.height + 8), new Color(150, 148, 138, 255));
        UIBuilder.panel(this.node, "IntelShade", new Size(frame.width + 8, frame.height + 8), Vec3.ZERO, new Color(10, 11, 10, 218), new Color(10, 11, 10, 0));
        this.renderHeader(frame);
        this.renderWorkspace(frame);
    }

    private renderHeader(frame: SafeFrame): void {
        const header = UIBuilder.surface(this.node, "IntelHeader", new Size(frame.width - UI_THEME.safeMargin * 2, 76), new Vec3(0, frame.top - 43), "large");
        const back = UIBuilder.navButton(header, "BtnBack", "返回方舟", "system-nav/13-exit", new Size(178, 62), new Vec3(-frame.width / 2 + 118, 0));
        this.bindTouch(back, () => { void uiNavigation.back(); });
        void UIBuilder.icon(header, "system-nav/01-map", 50, new Vec3(-120, 0));
        UIBuilder.label(header, "PageTitle", "地图与情报", new Size(390, 52), new Vec3(100, 0), 30, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
    }

    private renderWorkspace(frame: SafeFrame): void {
        const top = frame.top - 92;
        const bottom = frame.bottom + 18;
        const height = top - bottom;
        const y = (top + bottom) / 2;
        const gap = 12;
        const leftWidth = Math.min(224, frame.width * 0.18);
        const rightWidth = Math.min(324, frame.width * 0.25);
        const centerWidth = frame.width - UI_THEME.safeMargin * 2 - leftWidth - rightWidth - gap * 2;
        const leftX = frame.left + leftWidth / 2;
        const centerX = leftX + leftWidth / 2 + gap + centerWidth / 2;
        const rightX = frame.right - rightWidth / 2;

        this.renderTabs(leftX, y, leftWidth, height);
        const center = UIBuilder.surface(this.node, "IntelContent", new Size(centerWidth, height), new Vec3(centerX, y), "large");
        if (this.activeTab === "map") this.renderMapContent(center, centerWidth, height);
        else if (this.activeTab === "mission") this.renderMissionContent(center, centerWidth, height);
        else if (this.activeTab === "event") this.renderEventContent(center, centerWidth, height);
        else this.renderHordeContent(center, centerWidth, height);
        this.renderDetail(rightX, y, rightWidth, height);
    }

    private renderTabs(x: number, y: number, width: number, height: number): void {
        const rail = UIBuilder.surface(this.node, "IntelTabs", new Size(width, height), new Vec3(x, y), "large");
        UIBuilder.label(rail, "IntelTabsTitle", "行动情报", new Size(width - 30, 38), new Vec3(0, height / 2 - 32), 20, UI_THEME.colors.muted);
        TAB_DEFINITIONS.forEach((tab, index) => {
            const selected = tab.id === this.activeTab;
            const button = UIBuilder.surface(
                rail,
                tab.name,
                new Size(width - 32, 78),
                new Vec3(0, height / 2 - 92 - index * 88),
                selected ? "tabSelected" : "tab",
            );
            UIBuilder.label(button, `${tab.name}Label`, tab.label, new Size(width - 54, 42), Vec3.ZERO, 21, selected ? UI_THEME.colors.orange : UI_THEME.colors.white);
            this.bindTouch(button, () => this.selectTab(tab.id));
        });
    }

    private renderMapContent(parent: Node, width: number, height: number): void {
        UIBuilder.label(parent, "MapTitle", "灰港行动地图", new Size(width - 44, 40), new Vec3(0, height / 2 - 34), 25, UI_THEME.colors.white);
        UIBuilder.label(parent, "MapHint", "选择地点查看风险、路程与收益，再设为本次探索目标", new Size(width - 50, 32), new Vec3(0, height / 2 - 72), 16, UI_THEME.colors.muted);
        INTEL_TARGETS.forEach((target, index) => {
            const selected = target.id === this.previewTargetId;
            const card = UIBuilder.slot(parent, `MapTarget:${target.id}`, new Size(width - 44, 112), new Vec3(0, height / 2 - 146 - index * 122), selected);
            UIBuilder.label(card, "Location", target.locationName, new Size(190, 34), new Vec3(-width / 2 + 136, 26), 21, selected ? UI_THEME.colors.orange : UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
            UIBuilder.label(card, "Objective", target.objectiveTitle, new Size(width - 250, 30), new Vec3(72, 26), 16, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);
            UIBuilder.label(card, "Risk", `${RISK_LABELS[target.risk]}  ·  ${intelTargetDistanceMeters(target, this.map)}m`, new Size(190, 28), new Vec3(-width / 2 + 136, -24), 16, this.riskColor(target.risk), HorizontalTextAlignment.LEFT);
            UIBuilder.label(card, "Rewards", target.rewardLabels.join(" / "), new Size(width - 250, 28), new Vec3(72, -24), 15, UI_THEME.colors.cyan, HorizontalTextAlignment.LEFT);
            this.bindTouch(card, () => this.previewTarget(target.id));
        });
    }

    private renderMissionContent(parent: Node, width: number, height: number): void {
        UIBuilder.label(parent, "MissionTitle", "可执行任务", new Size(width - 44, 40), new Vec3(0, height / 2 - 34), 25, UI_THEME.colors.white);
        UIBuilder.label(parent, "MissionHint", "任务与地图地点共用同一目标，不会生成虚假的第二套进度", new Size(width - 50, 32), new Vec3(0, height / 2 - 72), 16, UI_THEME.colors.muted);
        INTEL_TARGETS.forEach((target, index) => {
            const selected = target.id === this.previewTargetId;
            const card = UIBuilder.slot(parent, `MissionTarget:${target.id}`, new Size(width - 44, 112), new Vec3(0, height / 2 - 146 - index * 122), selected);
            UIBuilder.label(card, "MissionName", target.objectiveTitle, new Size(width - 80, 34), new Vec3(0, 27), 21, selected ? UI_THEME.colors.orange : UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
            UIBuilder.label(card, "MissionSummary", target.summary, new Size(width - 80, 30), new Vec3(0, -7), 15, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);
            UIBuilder.label(card, "MissionMeta", `${target.locationName}  ·  预计 ${target.estimatedMinutes} 分钟`, new Size(width - 80, 26), new Vec3(0, -38), 15, this.riskColor(target.risk), HorizontalTextAlignment.LEFT);
            this.bindTouch(card, () => this.previewTarget(target.id));
        });
    }

    private renderEventContent(parent: Node, width: number, height: number): void {
        UIBuilder.label(parent, "EventTitle", "区域事件", new Size(width - 44, 40), new Vec3(0, height / 2 - 34), 25, UI_THEME.colors.white);
        UIBuilder.label(parent, "EventHint", "已知设施会显示作用；未侦测目标不会泄露坐标", new Size(width - 50, 32), new Vec3(0, height / 2 - 72), 16, UI_THEME.colors.muted);
        INTEL_EVENTS.forEach((event, index) => {
            const selected = event.id === this.selectedEventId;
            const card = UIBuilder.slot(parent, `Event:${event.id}`, new Size(width - 44, 112), new Vec3(0, height / 2 - 146 - index * 122), selected);
            UIBuilder.label(card, "EventName", event.title, new Size(width - 80, 34), new Vec3(0, 25), 21, selected ? UI_THEME.colors.orange : UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
            UIBuilder.label(card, "EventStatus", event.status === "known" ? "已知情报" : "待雷达侦测", new Size(160, 28), new Vec3(-width / 2 + 118, -25), 15, event.status === "known" ? UI_THEME.colors.cyan : UI_THEME.colors.orange, HorizontalTextAlignment.LEFT);
            UIBuilder.label(card, "EventDetail", event.detail, new Size(width - 250, 32), new Vec3(78, -25), 15, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);
            this.bindTouch(card, () => this.selectEvent(event.id));
        });
    }

    private renderHordeContent(parent: Node, width: number, height: number): void {
        UIBuilder.label(parent, "HordeTitle", "次夜尸潮预报", new Size(width - 44, 40), new Vec3(0, height / 2 - 34), 25, UI_THEME.colors.white);
        UIBuilder.label(parent, "HordeHint", "预报只提供整备依据，当前阶段不伪造可执行反制按钮", new Size(width - 50, 32), new Vec3(0, height / 2 - 72), 16, UI_THEME.colors.muted);
        this.renderForecastCard(parent, "HordeThreat", "威胁等级", NEXT_HORDE_FORECAST.threat, height / 2 - 154, width, UI_THEME.colors.orange);
        this.renderForecastCard(parent, "HordeEnemies", "预计敌群", NEXT_HORDE_FORECAST.enemies.join(" / "), height / 2 - 276, width, UI_THEME.colors.danger);
        this.renderForecastCard(parent, "HordeAdvice", "整备建议", NEXT_HORDE_FORECAST.advice, height / 2 - 398, width, UI_THEME.colors.cyan);
    }

    private renderForecastCard(parent: Node, name: string, label: string, value: string, y: number, width: number, color: Color): void {
        const card = UIBuilder.surface(parent, name, new Size(width - 44, 104), new Vec3(0, y), "card");
        UIBuilder.label(card, `${name}Label`, label, new Size(150, 30), new Vec3(-width / 2 + 112, 18), 16, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);
        UIBuilder.label(card, `${name}Value`, value, new Size(width - 230, 48), new Vec3(74, -8), 20, color, HorizontalTextAlignment.LEFT);
    }

    private renderDetail(x: number, y: number, width: number, height: number): void {
        const panel = UIBuilder.surface(this.node, "IntelDetail", new Size(width, height), new Vec3(x, y), "large");
        UIBuilder.label(panel, "DetailTitle", "情报详情", new Size(width - 34, 40), new Vec3(0, height / 2 - 32), 21, UI_THEME.colors.white);
        if (this.activeTab === "map" || this.activeTab === "mission") this.renderTargetDetail(panel, width, height);
        else if (this.activeTab === "event") this.renderEventDetail(panel, width, height);
        else this.renderHordeDetail(panel, width, height);
    }

    private renderTargetDetail(panel: Node, width: number, height: number): void {
        const target = findIntelTarget(this.previewTargetId);
        if (!target) {
            UIBuilder.label(panel, "NoTarget", "选择地图地点或任务\n查看完整行动情报", new Size(width - 54, 100), new Vec3(0, 72), 20, UI_THEME.colors.muted);
            const disabled = UIBuilder.surface(panel, "BtnSetTarget", new Size(width - 34, 78), new Vec3(0, -height / 2 + 58), "secondary", new Color(90, 100, 104, 190));
            UIBuilder.label(disabled, "BtnSetTargetLabel", "先选择目标", new Size(width - 60, 40), Vec3.ZERO, 20, UI_THEME.colors.muted);
            return;
        }

        UIBuilder.label(panel, "TargetName", target.locationName, new Size(width - 50, 40), new Vec3(0, height / 2 - 88), 24, UI_THEME.colors.orange);
        UIBuilder.label(panel, "TargetObjective", target.objectiveTitle, new Size(width - 50, 34), new Vec3(0, height / 2 - 128), 18, UI_THEME.colors.white);
        UIBuilder.label(panel, "TargetSummary", target.summary, new Size(width - 54, 72), new Vec3(0, height / 2 - 184), 16, UI_THEME.colors.muted);
        this.renderMetric(panel, "TargetRisk", "风险", RISK_LABELS[target.risk], width, height / 2 - 254, this.riskColor(target.risk));
        this.renderMetric(panel, "TargetDistance", "距离", `${intelTargetDistanceMeters(target, this.map)}m`, width, height / 2 - 326, UI_THEME.colors.cyan);
        this.renderMetric(panel, "TargetTime", "预计耗时", `${target.estimatedMinutes} 分钟`, width, height / 2 - 398, UI_THEME.colors.cyan);
        UIBuilder.label(panel, "TargetRewards", `奖励倾向\n${target.rewardLabels.join(" / ")}`, new Size(width - 52, 70), new Vec3(0, -height / 2 + 126), 16, UI_THEME.colors.white);
        const action = UIBuilder.navButton(panel, "BtnSetTarget", "设为目标", "system-nav/01-map", new Size(width - 34, 78), new Vec3(0, -height / 2 + 58), true);
        this.bindTouch(action, () => { void this.setTarget(target); });
    }

    private renderEventDetail(panel: Node, width: number, height: number): void {
        const event = INTEL_EVENTS.find((candidate) => candidate.id === this.selectedEventId) ?? INTEL_EVENTS[0];
        UIBuilder.label(panel, "EventDetailName", event.title, new Size(width - 50, 40), new Vec3(0, height / 2 - 94), 24, event.status === "known" ? UI_THEME.colors.cyan : UI_THEME.colors.orange);
        UIBuilder.label(panel, "EventDetailStatus", event.status === "known" ? "状态 · 已知" : "状态 · 待侦测", new Size(width - 50, 32), new Vec3(0, height / 2 - 140), 17, UI_THEME.colors.muted);
        UIBuilder.label(panel, "EventDetailText", event.detail, new Size(width - 54, 110), new Vec3(0, 52), 18, UI_THEME.colors.white);
        UIBuilder.label(panel, "EventReadOnly", "事件情报仅用于路线规划\n现场调查后才会结算结果", new Size(width - 54, 76), new Vec3(0, -height / 2 + 100), 16, UI_THEME.colors.muted);
    }

    private renderHordeDetail(panel: Node, width: number, height: number): void {
        UIBuilder.label(panel, "HordeDetailThreat", `威胁 · ${NEXT_HORDE_FORECAST.threat}`, new Size(width - 50, 42), new Vec3(0, height / 2 - 100), 24, UI_THEME.colors.orange);
        UIBuilder.label(panel, "HordeDetailEnemies", NEXT_HORDE_FORECAST.enemies.join(" / "), new Size(width - 50, 42), new Vec3(0, height / 2 - 154), 19, UI_THEME.colors.danger);
        UIBuilder.label(panel, "HordeDetailAdvice", NEXT_HORDE_FORECAST.advice, new Size(width - 54, 100), new Vec3(0, 42), 18, UI_THEME.colors.white);
        UIBuilder.label(panel, "HordeReadOnly", "完成本次白昼探索后\n返回方舟进行防守整备", new Size(width - 54, 76), new Vec3(0, -height / 2 + 100), 16, UI_THEME.colors.muted);
    }

    private renderMetric(parent: Node, name: string, label: string, value: string, width: number, y: number, color: Color): void {
        const card = UIBuilder.surface(parent, name, new Size(width - 38, 62), new Vec3(0, y), "card");
        UIBuilder.label(card, `${name}Label`, label, new Size(110, 28), new Vec3(-width / 2 + 78, 0), 15, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);
        UIBuilder.label(card, `${name}Value`, value, new Size(width - 150, 34), new Vec3(46, 0), 19, color, HorizontalTextAlignment.RIGHT);
    }

    private selectTab(tab: IntelTab): void {
        if (this.activeTab === tab) return;
        this.activeTab = tab;
        this.render();
    }

    private previewTarget(id: IntelTargetId): void {
        this.previewTargetId = id;
        this.render();
    }

    private selectEvent(id: IntelEventDefinition["id"]): void {
        this.selectedEventId = id;
        this.render();
    }

    private async setTarget(target: IntelTargetDefinition): Promise<void> {
        if (!intelRuntime.selectTarget(target.id)) {
            oops.gui.toast("目标情报无效，请重新选择");
            return;
        }
        oops.message.dispatchEvent(GameEvent.IntelTargetChanged, target.id);
        oops.gui.toast(`已将${target.locationName}设为探索目标`);
        await uiNavigation.back();
    }

    private riskColor(risk: IntelRisk): Color {
        if (risk === "high") return UI_THEME.colors.danger;
        if (risk === "medium") return UI_THEME.colors.orange;
        return UI_THEME.colors.cyan;
    }
}
