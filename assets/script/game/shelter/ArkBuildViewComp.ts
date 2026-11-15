import { Color, HorizontalTextAlignment, Size, Vec3, _decorator } from "cc";
import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { GamePage } from "../common/ui/GamePage";
import { UIBuilder, type SafeFrame } from "../common/ui/UIBuilder";
import { uiNavigation } from "../common/ui/UIRuntime";
import { UI_THEME } from "../common/ui/UITheme";
import { ARK_MODULES, ARK_SLOTS, arkEvolutionById, arkModuleById } from "./model/ArkCatalog.ts";
import type { ArkCategory, ArkDerivedState, ArkErrorCode, ArkLayoutId, ArkState, PowerPriority } from "./model/ArkTypes.ts";
import { arkRuntime } from "./ArkRuntime.ts";

const { ccclass } = _decorator;
const CATEGORY_LABEL: Record<ArkCategory, string> = { structure: "结构", energy: "能源", defense: "防御", bio: "生化" };
const ERRORS: Record<ArkErrorCode, string> = {
    unknown_module: "模块不存在", unknown_slot: "槽位不存在", slot_rejects_module: "槽位类型不匹配",
    slot_occupied: "槽位已占用", instance_already_installed: "模块已经安装", insufficient_resources: "资源不足",
    invalid_layout: "方案缺少模块", repair_not_needed: "模块无需维修", repair_cap_reached: "今日维修额度已用尽",
    evolution_incompatible: "进化不兼容", already_evolved: "模块已有进化", settlement_already_applied: "战斗已结算",
};

@ccclass("ArkBuildViewComp")
export class ArkBuildViewComp extends GamePage {
    private state!: ArkState;
    private derived!: ArkDerivedState;
    private category: ArkCategory = "structure";
    private selectedInstanceId = "armor-1";
    private selectedSlotId = "front-left";
    private unsubscribe: (() => void) | null = null;

    protected start(): void {
        this.unsubscribe = arkRuntime.subscribe((state, derived) => {
            this.state = state;
            this.derived = derived;
            this.render();
        });
    }

    protected onDestroy(): void {
        this.unsubscribe?.();
        super.onDestroy();
    }

    private render(): void {
        if (!this.state) return;
        this.clearBindings();
        const frame = UIBuilder.prepareRoot(this.node);
        void UIBuilder.backdrop(this.node, "gui/hall/texture/ark-garage", new Size(frame.width + 8, frame.height + 8), new Color(150, 148, 138, 255));
        UIBuilder.panel(this.node, "ArkBuildShade", new Size(frame.width + 8, frame.height + 8), Vec3.ZERO, new Color(10, 11, 10, 210), Color.TRANSPARENT);
        this.header(frame);
        this.workspace(frame);
    }

    private header(frame: SafeFrame): void {
        const header = UIBuilder.surface(this.node, "ArkBuildHeader", new Size(frame.width - 32, 76), new Vec3(0, frame.top - 43), "large");
        const back = UIBuilder.navButton(header, "BtnBack", "返回方舟", "system-nav/13-exit", new Size(178, 62), new Vec3(-frame.width / 2 + 118, 0));
        this.bindTouch(back, () => { void uiNavigation.back(); });
        UIBuilder.label(header, "Title", "方舟建设", new Size(300, 48), Vec3.ZERO, 29, UI_THEME.colors.white);
        const resourceText = `废料 ${this.state.resources.scrap}  零件 ${this.state.resources.parts}  合金 ${this.state.resources.alloy}  核心 ${this.state.resources.mutationCore}`;
        UIBuilder.label(header, "Resources", resourceText, new Size(510, 34), new Vec3(frame.width / 2 - 330, 0), 16, UI_THEME.colors.orange, HorizontalTextAlignment.RIGHT);
    }

    private workspace(frame: SafeFrame): void {
        const top = frame.top - 92;
        const bottom = frame.bottom + 18;
        const height = top - bottom;
        const y = (top + bottom) / 2;
        const leftWidth = 270;
        const rightWidth = 300;
        const gap = 12;
        const centerWidth = frame.width - 32 - leftWidth - rightWidth - gap * 2;
        const leftX = frame.left + leftWidth / 2;
        this.catalog(leftX, y, leftWidth, height);
        this.layout(leftX + leftWidth / 2 + gap + centerWidth / 2, y, centerWidth, height);
        this.details(frame.right - rightWidth / 2, y, rightWidth, height);
    }

    private catalog(x: number, y: number, width: number, height: number): void {
        const panel = UIBuilder.surface(this.node, "ModuleCatalog", new Size(width, height), new Vec3(x, y), "large");
        (["structure", "energy", "defense", "bio"] as ArkCategory[]).forEach((category, index) => {
            const tab = UIBuilder.button(panel, `Category:${category}`, CATEGORY_LABEL[category], new Size(116, 50), new Vec3(index % 2 ? 64 : -64, height / 2 - 40 - Math.floor(index / 2) * 56), category === this.category);
            this.bindTouch(tab, () => {
                this.category = category;
                this.selectedInstanceId = this.categoryInstances()[0]?.instanceId ?? this.selectedInstanceId;
                this.render();
            });
        });
        this.categoryInstances().slice(0, 4).forEach((instance, index) => {
            const definition = arkModuleById(instance.definitionId)!;
            const selected = instance.instanceId === this.selectedInstanceId;
            const row = UIBuilder.slot(panel, `Module:${instance.instanceId}`, new Size(width - 34, 66), new Vec3(0, height / 2 - 172 - index * 72), selected);
            UIBuilder.label(row, "Name", definition.name, new Size(190, 26), new Vec3(0, 13), 17, selected ? UI_THEME.colors.orange : UI_THEME.colors.white);
            UIBuilder.label(row, "Stats", `电 ${definition.powerDemand} · 噪 ${definition.noise} · 耐久 ${Math.ceil(instance.durability)}`, new Size(205, 22), new Vec3(0, -15), 13, UI_THEME.colors.muted);
            this.bindTouch(row, () => { this.selectedInstanceId = instance.instanceId; this.render(); });
        });
    }

    private layout(x: number, y: number, width: number, height: number): void {
        const panel = UIBuilder.surface(this.node, "ArkLayout", new Size(width, height), new Vec3(x, y), "large");
        UIBuilder.label(panel, "LayoutTitle", "方舟模块布局", new Size(width - 40, 38), new Vec3(0, height / 2 - 28), 24, UI_THEME.colors.white);
        (["alpha", "beta", "gamma"] as ArkLayoutId[]).forEach((id, index) => {
            const button = UIBuilder.button(panel, `Layout:${id}`, `方案 ${index + 1}`, new Size(112, 46), new Vec3((index - 1) * 124, height / 2 - 72), this.state.activeLayoutId === id);
            this.bindTouch(button, () => this.handle(arkRuntime.switchLayout(id)));
        });
        const positions: Record<string, Vec3> = {
            "front-left": new Vec3(-width * .29, 64), "front-right": new Vec3(width * .29, 64),
            "top-left": new Vec3(-width * .29, -48), "top-right": new Vec3(width * .29, -48),
            side: new Vec3(-width * .22, -155), internal: new Vec3(0, 22), bio: new Vec3(width * .22, -155),
        };
        const layout = this.state.layouts[this.state.activeLayoutId];
        for (const slotDefinition of ARK_SLOTS) {
            const instanceId = layout.slots[slotDefinition.id];
            const instance = this.state.modules.find((item) => item.instanceId === instanceId);
            const definition = instance ? arkModuleById(instance.definitionId) : undefined;
            const large = slotDefinition.id === "internal";
            const slot = UIBuilder.slot(panel, `Slot:${slotDefinition.id}`, new Size(large ? 150 : 118, large ? 106 : 86), positions[slotDefinition.id], this.selectedSlotId === slotDefinition.id);
            UIBuilder.label(slot, "SlotName", slotDefinition.label, new Size(130, 22), new Vec3(0, 18), 13, UI_THEME.colors.muted);
            UIBuilder.label(slot, "ModuleName", definition?.name ?? "+ 空槽位", new Size(132, 28), new Vec3(0, -12), 15, definition ? UI_THEME.colors.cyan : UI_THEME.colors.white);
            this.bindTouch(slot, () => { this.selectedSlotId = slotDefinition.id; if (instanceId) this.selectedInstanceId = instanceId; this.render(); });
        }
    }

    private details(x: number, y: number, width: number, height: number): void {
        const panel = UIBuilder.surface(this.node, "ArkDetails", new Size(width, height), new Vec3(x, y), "large");
        const instance = this.state.modules.find((item) => item.instanceId === this.selectedInstanceId) ?? this.state.modules[0];
        const definition = arkModuleById(instance.definitionId)!;
        const installed = this.derived.installedInstanceIds.includes(instance.instanceId);
        const powered = this.derived.poweredInstanceIds.includes(instance.instanceId);
        UIBuilder.label(panel, "DetailTitle", definition.name, new Size(width - 34, 38), new Vec3(0, height / 2 - 30), 22, UI_THEME.colors.white);
        const rows = [
            `状态：${installed ? (powered ? "运行中" : "停机") : "库存"}`,
            `耐久：${Math.ceil(instance.durability)} / ${definition.maxDurability}`,
            `供电：${this.derived.powerUsed} / ${this.derived.powerCapacity}`,
            `噪音：${this.derived.noise} · ${this.noiseName(this.derived.noiseTier)}`,
            `优先级：${instance.priority}`,
            instance.evolutionId ? `进化：${arkEvolutionById(instance.evolutionId)?.name}` : "进化：未植入",
        ];
        rows.forEach((text, index) => UIBuilder.label(panel, `Row:${index}`, text, new Size(width - 44, 28), new Vec3(0, height / 2 - 80 - index * 34), 16, index === 3 ? UI_THEME.colors.orange : UI_THEME.colors.muted, HorizontalTextAlignment.LEFT));
        const layout = this.state.layouts[this.state.activeLayoutId];
        const occupied = layout.slots[this.selectedSlotId];
        this.action(panel, "BtnEvolution", instance.evolutionId ? "拆除活体进化" : "植入活体进化", -height / 2 + 218, () => {
            const evolutionId = definition.evolutionIds[0] ?? "";
            this.handle(instance.evolutionId ? arkRuntime.removeEvolution(instance.instanceId) : arkRuntime.applyEvolution(instance.instanceId, evolutionId));
        });
        this.action(panel, "BtnRepair", "加入维修队列 / 执行", -height / 2 + 160, () => {
            const queued = arkRuntime.enqueueRepair(instance.instanceId);
            this.handle(queued.ok ? arkRuntime.processRepair(100) : queued);
        });
        this.action(panel, "BtnPriority", "切换供电优先级", -height / 2 + 102, () => this.handle(arkRuntime.setPriority(instance.instanceId, this.nextPriority(instance.priority))));
        this.action(panel, "BtnPrimary", occupied ? "拆卸所选槽位" : "安装到所选槽位", -height / 2 + 40, () => this.handle(occupied
            ? arkRuntime.remove(this.state.activeLayoutId, this.selectedSlotId)
            : arkRuntime.install(this.state.activeLayoutId, this.selectedSlotId, instance.instanceId)), true);
    }

    private action(parent: any, name: string, text: string, y: number, handler: () => void, primary = false): void {
        const button = UIBuilder.button(parent, name, text, new Size(266, primary ? 58 : 50), new Vec3(0, y), primary);
        this.bindTouch(button, handler);
    }

    private categoryInstances() {
        const ids = new Set(ARK_MODULES.filter((item) => item.category === this.category).map((item) => item.id));
        return this.state.modules.filter((item) => ids.has(item.definitionId));
    }

    private handle(result: { ok: boolean; error?: ArkErrorCode }): void {
        if (!result.ok && result.error) oops.gui.toast(ERRORS[result.error]);
    }

    private nextPriority(value: PowerPriority): PowerPriority { return value === "normal" ? "important" : value === "important" ? "core" : "normal"; }
    private noiseName(value: ArkDerivedState["noiseTier"]): string { return ({ hidden: "隐蔽", noticed: "可察觉", danger: "高危", bait: "诱敌" })[value]; }
}
