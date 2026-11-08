import { Color, HorizontalTextAlignment, Size, Vec3, _decorator } from "cc";

import { UIID } from "../common/config/GameUIConfig";
import { GamePage } from "../common/ui/GamePage";
import { FEATURE_DEMO_VIEW_MODELS, FeatureViewModel } from "../common/ui/UIDemoData";
import { SafeFrame, UIBuilder } from "../common/ui/UIBuilder";
import { uiNavigation } from "../common/ui/UIRuntime";
import { UI_THEME } from "../common/ui/UITheme";

const { ccclass } = _decorator;

interface FeatureVisual {
    tabs: readonly string[];
    workspaceTitle: string;
    workspaceHint: string;
    action: string;
}

const FEATURE_VISUALS: Readonly<Partial<Record<UIID, FeatureVisual>>> = {
    [UIID.Equipment]: { tabs: ["武器", "护甲", "芯片", "消耗品"], workspaceTitle: "装备对比台", workspaceHint: "选择装备查看词条、标签共鸣与进化路线", action: "装备所选" },
    [UIID.Workshop]: { tabs: ["武器", "防具", "模块", "补给"], workspaceTitle: "制造装配台", workspaceHint: "装入材料与改装件，确认属性变化后开始制造", action: "开始制造" },
    [UIID.ArkBuild]: { tabs: ["结构", "能源", "防御", "生化"], workspaceTitle: "方舟模块布局", workspaceHint: "选择模块槽位，检查供电、射界与相邻加成", action: "安装模块" },
    [UIID.Research]: { tabs: ["机械", "生存", "生化", "混合"], workspaceTitle: "研究路线", workspaceHint: "解锁前置节点并权衡永久收益与进化代价", action: "开始研究" },
    [UIID.Crew]: { tabs: ["全体", "岗位", "伤病", "任务"], workspaceTitle: "成员岗位台", workspaceHint: "拖入岗位以激活专长，并留意疲劳与士气", action: "确认岗位" },
    [UIID.Intel]: { tabs: ["地图", "任务", "事件", "尸潮"], workspaceTitle: "灰港行动情报", workspaceHint: "比较风险、资源倾向、距离与撤离窗口", action: "设为目标" },
};

@ccclass("FeaturePageViewComp")
export class FeaturePageViewComp extends GamePage {
    protected start(): void {
        this.render();
    }

    private render(): void {
        const uiid = Number(this.params.uiid) as UIID;
        const model = FEATURE_DEMO_VIEW_MODELS[uiid];
        const visual = FEATURE_VISUALS[uiid];
        if (!model || !visual) throw new Error(`Feature ViewModel missing for UIID ${String(this.params.uiid)}`);

        const frame = UIBuilder.prepareRoot(this.node);
        void UIBuilder.backdrop(this.node, "gui/hall/texture/ark-garage", new Size(frame.width + 8, frame.height + 8), new Color(118, 138, 158, 255));
        UIBuilder.panel(this.node, "FeatureShade", new Size(frame.width + 8, frame.height + 8), Vec3.ZERO, new Color(2, 10, 20, 205), new Color(2, 10, 20, 0));
        this.renderHeader(frame, model);
        this.renderWorkspace(frame, model, visual);
    }

    private renderHeader(frame: SafeFrame, model: FeatureViewModel): void {
        const headerY = frame.top - 43;
        const header = UIBuilder.surface(this.node, "FeatureHeader", new Size(frame.width - UI_THEME.safeMargin * 2, 76), new Vec3(0, headerY), "large");
        const back = UIBuilder.navButton(header, "BtnBack", "返回方舟", "system-nav/13-exit", new Size(178, 62), new Vec3(-frame.width / 2 + 118, 0));
        this.bindTouch(back, () => { void uiNavigation.back(); });
        void UIBuilder.icon(header, model.icon, 50, new Vec3(-120, 0));
        UIBuilder.label(header, "PageTitle", model.title, new Size(390, 52), new Vec3(100, 0), 30, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
    }

    private renderWorkspace(frame: SafeFrame, model: FeatureViewModel, visual: FeatureVisual): void {
        const top = frame.top - 92;
        const bottom = frame.bottom + 18;
        const height = top - bottom;
        const y = (top + bottom) / 2;
        const gap = 12;
        const leftWidth = Math.min(250, frame.width * 0.19);
        const rightWidth = Math.min(286, frame.width * 0.22);
        const centerWidth = frame.width - UI_THEME.safeMargin * 2 - leftWidth - rightWidth - gap * 2;
        const leftX = frame.left + leftWidth / 2;
        const rightX = frame.right - rightWidth / 2;

        const tabs = UIBuilder.surface(this.node, "CategoryRail", new Size(leftWidth, height), new Vec3(leftX, y), "large");
        UIBuilder.label(tabs, "CategoryTitle", "功能分类", new Size(leftWidth - 30, 36), new Vec3(0, height / 2 - 30), 19, UI_THEME.colors.muted);
        visual.tabs.forEach((label, index) => {
            const selected = index === 0;
            const slot = UIBuilder.slot(tabs, `Category${index}`, new Size(leftWidth - 34, 80), new Vec3(0, height / 2 - 88 - index * 88), selected);
            if (selected) void UIBuilder.icon(slot, model.icon, 42, new Vec3(-leftWidth / 2 + 56, 0));
            UIBuilder.label(slot, `CategoryLabel${index}`, label, new Size(leftWidth - 98, 40), new Vec3(32, 0), 20, selected ? UI_THEME.colors.orange : UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
        });

        const centerX = leftX + leftWidth / 2 + gap + centerWidth / 2;
        const workspace = UIBuilder.surface(this.node, "MainWorkspace", new Size(centerWidth, height), new Vec3(centerX, y), "large");
        UIBuilder.label(workspace, "WorkspaceTitle", visual.workspaceTitle, new Size(centerWidth - 44, 44), new Vec3(0, height / 2 - 34), 25, UI_THEME.colors.white);
        UIBuilder.label(workspace, "WorkspaceHint", visual.workspaceHint, new Size(centerWidth - 56, 36), new Vec3(0, height / 2 - 76), 17, UI_THEME.colors.muted);

        const core = UIBuilder.slot(workspace, "CoreSelection", new Size(Math.min(250, centerWidth * 0.42), 190), new Vec3(0, 18), true);
        void UIBuilder.icon(core, model.icon, 116, new Vec3(0, 15));
        UIBuilder.label(core, "CoreCaption", model.title, new Size(210, 34), new Vec3(0, -68), 18, UI_THEME.colors.orange);

        const orbitX = Math.min(210, centerWidth * 0.31);
        for (let index = 0; index < 4; index += 1) {
            const side = index % 2 === 0 ? -1 : 1;
            const row = index < 2 ? 1 : -1;
            const slot = UIBuilder.slot(workspace, `WorkspaceSlot${index}`, new Size(112, 112), new Vec3(side * orbitX, row * 86 + 10));
            UIBuilder.label(slot, `WorkspacePlus${index}`, "+", new Size(66, 66), Vec3.ZERO, 42, UI_THEME.colors.muted);
        }

        const queueY = -height / 2 + 62;
        for (let index = 0; index < 3; index += 1) {
            const queue = UIBuilder.slot(workspace, `QueueSlot${index}`, new Size(132, 82), new Vec3((index - 1) * 146, queueY), index === 0);
            UIBuilder.label(queue, `Queue${index}`, index === 0 ? "进行中  00:18" : "空队列", new Size(112, 34), Vec3.ZERO, 16, index === 0 ? UI_THEME.colors.cyan : UI_THEME.colors.muted);
        }

        const detail = UIBuilder.surface(this.node, "DetailPanel", new Size(rightWidth, height), new Vec3(rightX, y), "large");
        UIBuilder.label(detail, "DetailTitle", "状态预览", new Size(rightWidth - 34, 40), new Vec3(0, height / 2 - 32), 21, UI_THEME.colors.white);
        model.metrics.forEach((metric, index) => {
            const color = this.metricColor(metric.tone);
            const card = UIBuilder.surface(detail, `Metric${index}`, new Size(rightWidth - 34, 92), new Vec3(0, height / 2 - 100 - index * 102), "card");
            UIBuilder.label(card, "MetricLabel", metric.label, new Size(rightWidth - 64, 28), new Vec3(0, 22), 15, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);
            UIBuilder.label(card, "MetricValue", metric.value, new Size(rightWidth - 64, 40), new Vec3(0, -17), 24, color, HorizontalTextAlignment.RIGHT);
        });

        const action = UIBuilder.navButton(detail, "BtnPrimaryAction", visual.action, model.icon, new Size(rightWidth - 34, 88), new Vec3(0, -height / 2 + 62), true);
        this.bindTouch(action, () => undefined);
    }

    private metricColor(tone: "normal" | "warning" | "danger" | undefined): Color {
        if (tone === "danger") return UI_THEME.colors.danger;
        if (tone === "warning") return UI_THEME.colors.orange;
        return UI_THEME.colors.cyan;
    }
}
