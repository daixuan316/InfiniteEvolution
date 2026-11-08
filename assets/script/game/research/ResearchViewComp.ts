import { Color, HorizontalTextAlignment, Size, Vec3, _decorator } from "cc";

import { UIID } from "../common/config/GameUIConfig";
import { GamePage } from "../common/ui/GamePage";
import { SafeFrame, UIBuilder } from "../common/ui/UIBuilder";
import { uiNavigation } from "../common/ui/UIRuntime";
import { UI_THEME } from "../common/ui/UITheme";
import { RESEARCH_DEFINITIONS, researchById } from "./model/ResearchCatalog.ts";
import { formatCountdown } from "./model/ResearchPresentation.ts";
import type {
    ResearchBranch,
    ResearchDefinition,
    ResearchNodeStatus,
    ResearchSaveV1,
    StartResearchFailureReason,
} from "./model/ResearchTypes.ts";
import { researchRuntime } from "./ResearchService";

const { ccclass } = _decorator;

const BRANCHES: readonly { readonly id: ResearchBranch; readonly label: string }[] = [
    { id: "mechanical", label: "机械" },
    { id: "survival", label: "生存" },
    { id: "biochemical", label: "生化" },
    { id: "hybrid", label: "混合" },
];

const STATUS_TEXT: Readonly<Record<ResearchNodeStatus, string>> = {
    locked: "前置锁定",
    available: "可研究",
    queued: "等待中",
    researching: "研究中",
    completed: "已完成",
};

const FAILURE_TEXT: Readonly<Record<StartResearchFailureReason, string>> = {
    unknown: "研究节点不存在",
    completed: "该研究已经完成",
    queued: "该研究已在队列中",
    prerequisite: "需要先完成前置研究",
    points: "研究点不足",
    "queue-full": "研究队列已满",
};

@ccclass("ResearchViewComp")
export class ResearchViewComp extends GamePage {
    private selectedBranch: ResearchBranch = "mechanical";
    private selectedNodeId = "mech_plating_1";
    private feedback = "选择节点查看永久收益与研究条件";
    private lastRenderedSecond = -1;

    protected start(): void {
        this.render();
    }

    update(): void {
        const second = Math.floor(Date.now() / 1000);
        if (second === this.lastRenderedSecond) return;
        this.render();
    }

    private render(): void {
        const now = Date.now();
        const state = researchRuntime.snapshot(now);
        this.lastRenderedSecond = Math.floor(now / 1000);
        this.clearBindings();
        const frame = UIBuilder.prepareRoot(this.node);
        void UIBuilder.backdrop(this.node, "gui/hall/texture/ark-garage", new Size(frame.width + 8, frame.height + 8), new Color(94, 130, 148, 255));
        UIBuilder.panel(this.node, "ResearchShade", new Size(frame.width + 8, frame.height + 8), Vec3.ZERO, new Color(2, 10, 20, 218), new Color(2, 10, 20, 0));
        this.renderHeader(frame, state, now);
        this.renderWorkspace(frame, state, now);
    }

    private renderHeader(frame: SafeFrame, state: ResearchSaveV1, now: number): void {
        const headerY = frame.top - 43;
        const header = UIBuilder.surface(this.node, "ResearchHeader", new Size(frame.width - UI_THEME.safeMargin * 2, 76), new Vec3(0, headerY), "large");
        const back = UIBuilder.navButton(header, "BtnBack", "返回方舟", "system-nav/13-exit", new Size(178, 62), new Vec3(-frame.width / 2 + 118, 0));
        this.bindTouch(back, () => { void uiNavigation.back(); });
        void UIBuilder.icon(header, "system-nav/04-research", 50, new Vec3(-155, 0));
        UIBuilder.label(header, "PageTitle", "研究与进化", new Size(330, 48), new Vec3(40, 0), 30, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);

        const available = RESEARCH_DEFINITIONS.filter((node) => this.statusOf(node, state) === "available").length;
        const summary = `研究点 ${state.points}    可研究 ${available}    生化负荷 ${researchRuntime.bioLoad(now)}`;
        UIBuilder.label(header, "ResearchSummary", summary, new Size(430, 42), new Vec3(frame.width / 2 - 270, 0), 19, UI_THEME.colors.cyan, HorizontalTextAlignment.RIGHT);
    }

    private renderWorkspace(frame: SafeFrame, state: ResearchSaveV1, now: number): void {
        const top = frame.top - 92;
        const bottom = frame.bottom + 18;
        const height = top - bottom;
        const y = (top + bottom) / 2;
        const gap = 12;
        const leftWidth = Math.min(220, frame.width * 0.17);
        const rightWidth = Math.min(310, frame.width * 0.24);
        const centerWidth = frame.width - UI_THEME.safeMargin * 2 - leftWidth - rightWidth - gap * 2;
        const leftX = frame.left + leftWidth / 2;
        const rightX = frame.right - rightWidth / 2;
        const centerX = leftX + leftWidth / 2 + gap + centerWidth / 2;

        this.renderBranches(leftX, y, leftWidth, height, state);
        this.renderNodes(centerX, y, centerWidth, height, state, now);
        this.renderDetails(rightX, y, rightWidth, height, state, now);
    }

    private renderBranches(x: number, y: number, width: number, height: number, state: ResearchSaveV1): void {
        const panel = UIBuilder.surface(this.node, "ResearchBranches", new Size(width, height), new Vec3(x, y), "large");
        UIBuilder.label(panel, "BranchTitle", "研究路线", new Size(width - 30, 38), new Vec3(0, height / 2 - 30), 21, UI_THEME.colors.white);
        BRANCHES.forEach((branch, index) => {
            const selected = branch.id === this.selectedBranch;
            const completed = RESEARCH_DEFINITIONS.filter((node) => node.branch === branch.id && state.completed.includes(node.id)).length;
            const button = UIBuilder.slot(panel, `Branch:${branch.id}`, new Size(width - 28, 82), new Vec3(0, height / 2 - 94 - index * 92), selected);
            UIBuilder.label(button, `BranchLabel:${branch.id}`, branch.label, new Size(width - 78, 32), new Vec3(-13, 12), 21, selected ? UI_THEME.colors.orange : UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
            UIBuilder.label(button, `BranchProgress:${branch.id}`, `${completed} / 3`, new Size(70, 26), new Vec3(width / 2 - 56, -17), 15, completed === 3 ? UI_THEME.colors.success : UI_THEME.colors.muted, HorizontalTextAlignment.RIGHT);
            this.bindTouch(button, () => {
                this.selectedBranch = branch.id;
                this.selectedNodeId = RESEARCH_DEFINITIONS.find((node) => node.branch === branch.id)!.id;
                this.feedback = `已切换到${branch.label}路线`;
                this.render();
            });
        });
    }

    private renderNodes(x: number, y: number, width: number, height: number, state: ResearchSaveV1, now: number): void {
        const panel = UIBuilder.surface(this.node, "ResearchTree", new Size(width, height), new Vec3(x, y), "large");
        UIBuilder.label(panel, "ResearchTreeTitle", "研究路线", new Size(width - 36, 40), new Vec3(0, height / 2 - 30), 24, UI_THEME.colors.white);
        UIBuilder.label(panel, "ResearchTreeHint", "完成前置节点后可解锁下一层研究", new Size(width - 42, 30), new Vec3(0, height / 2 - 66), 15, UI_THEME.colors.muted);

        const nodes = RESEARCH_DEFINITIONS.filter((node) => node.branch === this.selectedBranch);
        const cardGap = 12;
        const cardWidth = Math.min(210, (width - 44 - cardGap * 2) / 3);
        nodes.forEach((definition, index) => {
            const status = this.statusOf(definition, state);
            const selected = definition.id === this.selectedNodeId;
            const nodeX = (index - 1) * (cardWidth + cardGap);
            const card = UIBuilder.slot(panel, `ResearchNode:${definition.id}`, new Size(cardWidth, 204), new Vec3(nodeX, 38), selected);
            UIBuilder.label(card, `ResearchTier:${definition.id}`, `T${definition.tier}`, new Size(44, 28), new Vec3(-cardWidth / 2 + 30, 76), 15, UI_THEME.colors.orange);
            UIBuilder.label(card, `ResearchName:${definition.id}`, definition.name, new Size(cardWidth - 28, 38), new Vec3(0, 34), 21, UI_THEME.colors.white);
            UIBuilder.label(card, `ResearchStatus:${definition.id}`, STATUS_TEXT[status], new Size(cardWidth - 28, 30), new Vec3(0, -10), 17, this.statusColor(status));
            UIBuilder.label(card, `ResearchCost:${definition.id}`, `${definition.cost} 研究点 · ${formatCountdown(definition.durationSeconds * 1000)}`, new Size(cardWidth - 22, 28), new Vec3(0, -53), 14, UI_THEME.colors.muted);
            if (index < nodes.length - 1) UIBuilder.label(panel, `ResearchArrow:${index}`, "›", new Size(30, 48), new Vec3(nodeX + cardWidth / 2 + cardGap / 2, 38), 34, UI_THEME.colors.cyanDark);
            this.bindTouch(card, () => {
                this.selectedNodeId = definition.id;
                this.feedback = status === "locked" ? "完成前置节点后即可研究" : definition.description;
                this.render();
            });
        });

        UIBuilder.label(panel, "QueueTitle", "研究队列", new Size(width - 40, 30), new Vec3(-width / 2 + 95, -height / 2 + 120), 18, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
        const queueWidth = Math.min(190, (width - 44 - cardGap * 2) / 3);
        for (let index = 0; index < 3; index += 1) {
            const entry = state.queue[index];
            const queue = UIBuilder.slot(panel, `QueueSlot:${index}`, new Size(queueWidth, 76), new Vec3((index - 1) * (queueWidth + cardGap), -height / 2 + 62), index === 0 && Boolean(entry));
            const definition = entry ? researchById(entry.nodeId) : undefined;
            const prefix = index === 0 && entry ? "进行中" : entry ? "等待中" : "空队列";
            const time = entry ? formatCountdown(entry.finishAtMs - now) : "--:--";
            UIBuilder.label(queue, `QueueName:${index}`, definition ? definition.name : prefix, new Size(queueWidth - 18, 27), new Vec3(0, 15), 15, entry ? UI_THEME.colors.white : UI_THEME.colors.muted);
            UIBuilder.label(queue, `QueueTime:${index}`, entry ? `${prefix}  ${time}` : time, new Size(queueWidth - 18, 26), new Vec3(0, -16), 14, index === 0 && entry ? UI_THEME.colors.cyan : UI_THEME.colors.muted);
        }
    }

    private renderDetails(x: number, y: number, width: number, height: number, state: ResearchSaveV1, now: number): void {
        const panel = UIBuilder.surface(this.node, "ResearchDetails", new Size(width, height), new Vec3(x, y), "large");
        const definition = researchById(this.selectedNodeId) ?? RESEARCH_DEFINITIONS[0];
        const status = this.statusOf(definition, state);
        UIBuilder.label(panel, "DetailTitle", definition.name, new Size(width - 32, 40), new Vec3(0, height / 2 - 34), 24, UI_THEME.colors.white);
        UIBuilder.label(panel, "DetailStatus", STATUS_TEXT[status], new Size(width - 38, 30), new Vec3(0, height / 2 - 72), 17, this.statusColor(status));
        UIBuilder.label(panel, "DetailDescription", definition.description, new Size(width - 44, 76), new Vec3(0, height / 2 - 130), 16, UI_THEME.colors.muted, HorizontalTextAlignment.LEFT);

        const effects = definition.effects.map((effect) => this.effectText(effect)).join("\n");
        const prerequisite = definition.prerequisites.length > 0
            ? definition.prerequisites.map((id) => researchById(id)?.name ?? id).join("、")
            : "无";
        const details = `永久收益\n${effects}\n\n前置研究\n${prerequisite}\n\n生化负荷  +${definition.bioLoad ?? 0}`;
        UIBuilder.label(panel, "EffectSummary", details, new Size(width - 44, 210), new Vec3(0, 10), 17, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
        UIBuilder.label(panel, "ResearchFeedback", this.feedback, new Size(width - 42, 52), new Vec3(0, -height / 2 + 128), 15, status === "available" ? UI_THEME.colors.cyan : UI_THEME.colors.orange);

        const buttonText = status === "available" ? `开始研究 · ${definition.cost} 点` : STATUS_TEXT[status];
        const action = UIBuilder.navButton(panel, "BtnStartResearch", buttonText, "system-nav/04-research", new Size(width - 34, 82), new Vec3(0, -height / 2 + 58), status === "available");
        this.bindTouch(action, () => {
            const result = researchRuntime.startResearch(this.selectedNodeId, Date.now());
            if ("reason" in result) this.feedback = FAILURE_TEXT[result.reason];
            else this.feedback = "研究已加入队列";
            this.render();
        });
        void now;
    }

    private statusOf(definition: ResearchDefinition, state: ResearchSaveV1): ResearchNodeStatus {
        if (state.completed.includes(definition.id)) return "completed";
        const queueIndex = state.queue.findIndex((entry) => entry.nodeId === definition.id);
        if (queueIndex === 0) return "researching";
        if (queueIndex > 0) return "queued";
        return definition.prerequisites.every((id) => state.completed.includes(id)) ? "available" : "locked";
    }

    private statusColor(status: ResearchNodeStatus): Color {
        if (status === "completed") return UI_THEME.colors.success;
        if (status === "researching") return UI_THEME.colors.cyan;
        if (status === "available") return UI_THEME.colors.orange;
        if (status === "queued") return UI_THEME.colors.white;
        return UI_THEME.colors.muted;
    }

    private effectText(effect: ResearchDefinition["effects"][number]): string {
        if (effect.stat === "maxHealth") return `最大生命  +${effect.add}`;
        if (effect.stat === "maxShield") return `最大护盾  +${effect.add}`;
        if (effect.stat === "attackDamage") return `攻击伤害  +${Math.round((effect.multiplier - 1) * 100)}%`;
        return `移动速度  +${Math.round((effect.multiplier - 1) * 100)}%`;
    }
}
