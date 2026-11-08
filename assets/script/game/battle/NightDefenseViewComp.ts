import {
    Color,
    EventTouch,
    Graphics,
    Label,
    Node,
    Size,
    UITransform,
    Vec3,
    _decorator,
} from "cc";

import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { GameEvent } from "../common/config/GameEvent";
import { UIID } from "../common/config/GameUIConfig";
import { GamePage } from "../common/ui/GamePage";
import { type SafeFrame, UIBuilder } from "../common/ui/UIBuilder";
import { uiNavigation } from "../common/ui/UIRuntime";
import { UI_THEME } from "../common/ui/UITheme";
import type { HordePhase } from "../monster/model/HordeDirector";
import { createArkDefenseMap } from "./ArkDefenseMap";
import { BattleSimulation, type EnemyAgent, type EnemyKind } from "./BattleSimulation";

const { ccclass } = _decorator;

const PHASE_PRESENTATION: Readonly<Record<HordePhase, { readonly name: string; readonly color: Color }>> = {
    warning: { name: "尸潮预警", color: UI_THEME.colors.orange },
    probe: { name: "试探波", color: UI_THEME.colors.cyan },
    assault: { name: "主攻波", color: UI_THEME.colors.danger },
    respite: { name: "喘息维修", color: UI_THEME.colors.success },
    climax: { name: "高潮波", color: UI_THEME.colors.magenta },
    cleanup: { name: "清剿残敌", color: UI_THEME.colors.orange },
};

const ENEMY_ART: Readonly<Record<EnemyKind, { readonly asset: string; readonly size: number }>> = {
    walker: { asset: "gui/battle-hud/actors/walker", size: 92 },
    runner: { asset: "gui/battle-hud/actors/runner", size: 96 },
    mutant: { asset: "gui/battle-hud/actors/walker", size: 108 },
    brute: { asset: "gui/battle-hud/actors/brute", size: 142 },
};

/** The post-sunset page: the player is back at the Ark and the horde attacks its core. */
@ccclass("NightDefenseViewComp")
export class NightDefenseViewComp extends GamePage {
    private readonly map = createArkDefenseMap();
    private readonly simulation = new BattleSimulation(this.map, {
        spawnInitialEnemies: false,
        arkCore: {
            position: this.map.cellToWorld(this.map.extraction),
            maxHealth: 1800,
            defense: 35,
            radius: 88,
        },
    });
    private frame!: SafeFrame;
    private worldLayer!: Node;
    private worldTouchLayer!: Node;
    private playerNode!: Node;
    private coreHealthBar!: Node;
    private playerHealthBar!: Node;
    private playerShieldBar!: Node;
    private phaseProgressBar!: Node;
    private phaseLabel!: Label;
    private threatLabel!: Label;
    private coreLabel!: Label;
    private resultPanel!: Node;
    private resultTitle!: Label;
    private resultDetail!: Label;
    private returnButton!: Node;
    private readonly enemyNodes = new Map<string, Node>();
    private readonly enemyHealthBars = new Map<string, Node>();
    private readonly projectileNodes = new Map<string, Node>();
    private lastHordePhase: HordePhase | null = null;
    private paused = false;
    private ended = false;

    protected onLoad(): void {
        this.render();
        this.simulation.startHorde(1);
        this.syncAll();
        oops.message.on(GameEvent.GamePaused, this.onGamePaused, this);
        oops.message.on(GameEvent.GameResumed, this.onGameResumed, this);
    }

    update(deltaTime: number): void {
        if (!this.paused && !this.ended) this.simulation.update(deltaTime);
        this.syncHordeEvents();
        this.syncAll();
        this.syncResult();
    }

    protected onDestroy(): void {
        oops.message.off(GameEvent.GamePaused, this.onGamePaused, this);
        oops.message.off(GameEvent.GameResumed, this.onGameResumed, this);
        this.worldTouchLayer?.off(Node.EventType.TOUCH_END, this.onWorldTouchEnd, this);
        super.onDestroy();
    }

    private render(): void {
        this.frame = UIBuilder.prepareRoot(this.node);
        void UIBuilder.backdrop(
            this.node,
            "gui/hall/texture/ark-garage",
            new Size(this.frame.width, this.frame.height),
            new Color(105, 118, 128, 255),
        );
        this.renderArena();
        this.renderTouchLayer();
        this.renderStatus();
        this.renderResult();
    }

    private renderArena(): void {
        this.worldLayer = this.createNode(this.node, "ArkDefenseArena", new Size(this.map.worldWidth, this.map.worldHeight), Vec3.ZERO);
        const grid = this.worldLayer.addComponent(Graphics);
        grid.fillColor = new Color(2, 8, 13, 92);
        grid.rect(-this.map.worldWidth / 2, -this.map.worldHeight / 2, this.map.worldWidth, this.map.worldHeight);
        grid.fill();
        grid.lineWidth = 1;
        grid.strokeColor = new Color(36, 228, 239, 28);
        for (let x = 1; x < this.map.columns; x++) {
            const px = -this.map.worldWidth / 2 + x * this.map.tileSize;
            grid.moveTo(px, -this.map.worldHeight / 2);
            grid.lineTo(px, this.map.worldHeight / 2);
        }
        for (let y = 1; y < this.map.rows; y++) {
            const py = -this.map.worldHeight / 2 + y * this.map.tileSize;
            grid.moveTo(-this.map.worldWidth / 2, py);
            grid.lineTo(this.map.worldWidth / 2, py);
        }
        grid.stroke();

        const core = this.simulation.structures[0];
        void UIBuilder.sprite(
            this.worldLayer,
            "gui/hall/texture/ark-base",
            new Size(290, 210),
            new Vec3(core.x, core.y + 24),
            false,
            new Color(190, 210, 220, 255),
            "contain",
        );
        const coreMarker = this.createNode(this.worldLayer, "ArkCoreMarker", new Size(190, 190), new Vec3(core.x, core.y));
        const marker = coreMarker.addComponent(Graphics);
        marker.lineWidth = 5;
        marker.strokeColor = UI_THEME.colors.orange;
        marker.circle(0, 0, 88);
        marker.stroke();
        this.coreHealthBar = UIBuilder.progressBar(coreMarker, "ArkCoreHealth", new Size(220, 22), new Vec3(0, 120), 1, UI_THEME.colors.orange);

        this.playerNode = this.createNode(this.worldLayer, "Defender", new Size(128, 128), Vec3.ZERO);
        void UIBuilder.sprite(this.playerNode, "gui/battle-hud/actors/player-fire", new Size(128, 128), Vec3.ZERO, false, Color.WHITE, "contain");
    }

    private renderTouchLayer(): void {
        this.worldTouchLayer = this.createNode(this.node, "DefenseMoveTouch", new Size(this.map.worldWidth, this.map.worldHeight), Vec3.ZERO);
        this.worldTouchLayer.on(Node.EventType.TOUCH_END, this.onWorldTouchEnd, this);
    }

    private renderStatus(): void {
        const top = UIBuilder.hudPlate(this.node, "DefenseStatus", "defense-hud/01-top-wave-status", new Size(620, 116), new Vec3(0, this.frame.top - 58));
        UIBuilder.label(top, "DefenseTitle", "方舟庇护所 · 夜间防线", new Size(290, 34), new Vec3(-142, 27), 22, UI_THEME.colors.white);
        this.phaseLabel = UIBuilder.label(top, "WavePhase", "尸潮预警", new Size(180, 34), new Vec3(175, 27), 21, UI_THEME.colors.orange);
        this.phaseProgressBar = UIBuilder.progressBar(top, "WaveProgress", new Size(430, 18), new Vec3(-40, -23), 0, UI_THEME.colors.orange);
        this.threatLabel = UIBuilder.label(top, "ThreatCount", "威胁 0", new Size(130, 30), new Vec3(235, -23), 18, UI_THEME.colors.orange);

        const left = UIBuilder.surface(this.node, "ArkVitality", new Size(300, 114), new Vec3(this.frame.left + 150, this.frame.top - 58), "medium");
        this.coreLabel = UIBuilder.label(left, "ArkVitalityText", "方舟核心", new Size(250, 34), new Vec3(0, 28), 20, UI_THEME.colors.orange);
        UIBuilder.label(left, "ArkMission", "守住核心，击退尸潮", new Size(250, 28), new Vec3(0, -27), 16, UI_THEME.colors.muted);

        const player = UIBuilder.surface(this.node, "DefenderVitality", new Size(300, 112), new Vec3(this.frame.right - 150, this.frame.top - 58), "medium");
        UIBuilder.label(player, "DefenderTitle", "守卫者", new Size(90, 28), new Vec3(-91, 31), 17, UI_THEME.colors.white);
        this.playerHealthBar = UIBuilder.progressBar(player, "DefenderHealth", new Size(176, 18), new Vec3(47, 28), 1, UI_THEME.colors.danger);
        this.playerShieldBar = UIBuilder.progressBar(player, "DefenderShield", new Size(176, 16), new Vec3(47, -10), 1, UI_THEME.colors.cyan);

        const pause = UIBuilder.navButton(this.node, "BtnDefensePause", "暂停", "system-nav/10-pause", new Size(102, 76), new Vec3(this.frame.right - 55, this.frame.bottom + 44));
        this.bindTouch(pause, () => { void this.openPause(); });
    }

    private renderResult(): void {
        this.resultPanel = UIBuilder.surface(this.node, "DefenseResult", new Size(560, 310), Vec3.ZERO, "large");
        this.resultTitle = UIBuilder.label(this.resultPanel, "ResultTitle", "防守完成", new Size(460, 62), new Vec3(0, 86), 36, UI_THEME.colors.success);
        this.resultDetail = UIBuilder.label(this.resultPanel, "ResultDetail", "方舟核心仍在运转", new Size(460, 44), new Vec3(0, 25), 20, UI_THEME.colors.white);
        this.returnButton = UIBuilder.navButton(this.resultPanel, "BtnDefenseReturn", "返回方舟大厅", "system-nav/13-exit", new Size(320, 78), new Vec3(0, -72), true);
        this.bindTouch(this.returnButton, () => { void this.returnToHall(); });
        this.resultPanel.active = false;
    }

    private syncAll(): void {
        const core = this.simulation.structures[0];
        this.playerNode.setPosition(this.simulation.player.x, this.simulation.player.y);
        UIBuilder.setProgressBarRatio(this.coreHealthBar, core.vitality.healthRatio);
        UIBuilder.setProgressBarRatio(this.playerHealthBar, this.simulation.player.vitality.healthRatio);
        UIBuilder.setProgressBarRatio(this.playerShieldBar, this.simulation.player.vitality.shieldRatio);
        this.coreLabel.string = `方舟核心  ${Math.ceil(core.vitality.currentHealth)} / ${core.vitality.maxHealth}`;

        const phase = this.simulation.hordePhase ?? "warning";
        const presentation = PHASE_PRESENTATION[phase];
        this.phaseLabel.string = presentation.name;
        this.phaseLabel.color = presentation.color;
        this.threatLabel.string = `威胁 ${this.simulation.remainingHordeThreats}`;
        this.threatLabel.color = presentation.color;
        UIBuilder.setProgressBarRatio(this.phaseProgressBar, this.simulation.hordeProgressRatio);
        this.syncEnemies();
        this.syncProjectiles();
    }

    private syncEnemies(): void {
        for (const enemy of this.simulation.enemies) {
            let node = this.enemyNodes.get(enemy.id);
            if (!node) node = this.createEnemyNode(enemy);
            node.setPosition(enemy.x, enemy.y);
            node.active = enemy.vitality.active;
            const health = this.enemyHealthBars.get(enemy.id);
            if (health) UIBuilder.setProgressBarRatio(health, enemy.vitality.healthRatio);
        }
    }

    private createEnemyNode(enemy: EnemyAgent): Node {
        const art = ENEMY_ART[enemy.kind];
        const node = this.createNode(this.worldLayer, `Horde:${enemy.id}`, new Size(art.size, art.size), new Vec3(enemy.x, enemy.y));
        void UIBuilder.sprite(node, art.asset, new Size(art.size, art.size), Vec3.ZERO, false, Color.WHITE, "contain");
        const health = UIBuilder.progressBar(node, `EnemyHealth:${enemy.id}`, new Size(art.size * 0.86, 14), new Vec3(0, art.size * 0.48), 1, UI_THEME.colors.danger);
        this.enemyNodes.set(enemy.id, node);
        this.enemyHealthBars.set(enemy.id, health);
        return node;
    }

    private syncProjectiles(): void {
        const active = new Set<string>();
        for (const projectile of this.simulation.projectiles) {
            active.add(projectile.id);
            let node = this.projectileNodes.get(projectile.id);
            if (!node) {
                node = this.createNode(this.worldLayer, `Shot:${projectile.id}`, new Size(16, 16), new Vec3(projectile.x, projectile.y));
                const graphics = node.addComponent(Graphics);
                graphics.fillColor = UI_THEME.colors.orange;
                graphics.circle(0, 0, 7);
                graphics.fill();
                this.projectileNodes.set(projectile.id, node);
            }
            node.setPosition(projectile.x, projectile.y);
        }
        for (const [id, node] of this.projectileNodes) {
            if (active.has(id)) continue;
            node.destroy();
            this.projectileNodes.delete(id);
        }
    }

    private syncHordeEvents(): void {
        const phase = this.simulation.hordePhase;
        if (phase && phase !== this.lastHordePhase) {
            this.lastHordePhase = phase;
            if (phase === "warning") oops.message.dispatchEvent(GameEvent.HordeWarning);
            oops.message.dispatchEvent(GameEvent.HordeWaveChanged, phase, this.simulation.remainingHordeThreats);
        }
    }

    private syncResult(): void {
        if (this.ended) return;
        const core = this.simulation.structures[0];
        if (!core.vitality.active) {
            this.ended = true;
            this.resultTitle.string = "庇护所失守";
            this.resultTitle.color = UI_THEME.colors.danger;
            this.resultDetail.string = "方舟核心已被尸潮摧毁";
            this.resultPanel.active = true;
            return;
        }
        if (this.simulation.hordeCompleted) {
            this.ended = true;
            this.resultTitle.string = "防守完成";
            this.resultTitle.color = UI_THEME.colors.success;
            this.resultDetail.string = `尸潮击退 · 核心完整度 ${Math.ceil(core.vitality.healthRatio * 100)}%`;
            this.resultPanel.active = true;
            oops.message.dispatchEvent(GameEvent.NightCompleted);
        }
    }

    private onWorldTouchEnd(event: EventTouch): void {
        if (this.paused || this.ended || !this.simulation.player.vitality.active) return;
        const location = event.getUILocation();
        const local = this.worldLayer.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(location.x, location.y));
        this.simulation.setPlayerDestination({ x: local.x, y: local.y });
    }

    private async openPause(): Promise<void> {
        if (this.paused) return;
        if (await uiNavigation.openOverlay(UIID.PauseOverlay, { mode: "defense" })) {
            oops.message.dispatchEvent(GameEvent.GamePaused);
        }
    }

    private onGamePaused(): void {
        this.paused = true;
    }

    private onGameResumed(): void {
        this.paused = false;
    }

    private async returnToHall(): Promise<void> {
        oops.message.dispatchEvent(GameEvent.LeaveBattle);
        await uiNavigation.resetToRoot();
    }

    private createNode(parent: Node, name: string, size: Size, position: Vec3): Node {
        const node = new Node(name);
        node.layer = parent.layer;
        node.addComponent(UITransform).setContentSize(size);
        node.setPosition(position);
        parent.addChild(node);
        return node;
    }
}
