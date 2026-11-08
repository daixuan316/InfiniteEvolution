import {
    BlockInputEvents,
    Color,
    EventKeyboard,
    EventTouch,
    Graphics,
    HorizontalTextAlignment,
    Input,
    KeyCode,
    Label,
    Node,
    Size,
    UIOpacity,
    UITransform,
    Vec3,
    input,
    _decorator,
} from "cc";

import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { GameEvent } from "../common/config/GameEvent";
import { UIID } from "../common/config/GameUIConfig";
import { GamePage } from "../common/ui/GamePage";
import { SafeFrame, UIBuilder } from "../common/ui/UIBuilder";
import { uiNavigation } from "../common/ui/UIRuntime";
import { UI_THEME } from "../common/ui/UITheme";
import { type HordePhase } from "../monster/model/HordeDirector";
import { DayClock, explorationTimeScale, formatDayTime, type DayPressure } from "../world/model/DayClock";
import { ActorAction, ActorAnimator } from "./ActorAnimator";
import { cameraTargetFor } from "./BattleCamera";
import { battleControlLayout, playerStatusLayout } from "./BattleHUDLayout";
import { createHospitalDistrictMap, WorldPoint } from "./BattleMapModel";
import { BattleSimulation, type EnemyKind } from "./BattleSimulation";

const { ccclass } = _decorator;

const DAY_DURATION_SECONDS = 8 * 60;
const DAY_WARNING_SECONDS = 2 * 60;
const DAY_NIGHT_SECONDS = 0;
const DAY_HUNT_SECONDS = -60;
const DAY_PRESSURE_PRESENTATION: Readonly<Record<DayPressure, { readonly text: string; readonly color: Color }>> = {
    safe: { text: "安全探索", color: UI_THEME.colors.cyan },
    warning: { text: "日落警戒", color: UI_THEME.colors.orange },
    night: { text: "夜幕降临", color: UI_THEME.colors.danger },
    hunt: { text: "尸群追猎", color: UI_THEME.colors.magenta },
};
const HORDE_PHASE_PRESENTATION: Readonly<Record<HordePhase, { readonly text: string; readonly color: Color }>> = {
    warning: { text: "尸潮预警", color: UI_THEME.colors.orange },
    probe: { text: "试探波", color: UI_THEME.colors.cyan },
    assault: { text: "主攻波", color: UI_THEME.colors.danger },
    respite: { text: "喘息维修", color: UI_THEME.colors.success },
    climax: { text: "高潮波", color: UI_THEME.colors.magenta },
    cleanup: { text: "清剿残敌", color: UI_THEME.colors.orange },
};
const ENEMY_PRESENTATION: Readonly<Record<EnemyKind, {
    readonly name: string;
    readonly asset: string;
    readonly size: number;
}>> = {
    walker: { name: "Walker", asset: "gui/battle-hud/actors/walker", size: 112 },
    runner: { name: "Runner", asset: "gui/battle-hud/actors/runner", size: 118 },
    mutant: { name: "Mutant", asset: "gui/battle-hud/actors/walker", size: 126 },
    brute: { name: "Brute", asset: "gui/battle-hud/actors/brute", size: 172 },
};

interface DamageFeedback {
    readonly node: Node;
    readonly opacity: UIOpacity;
    readonly startX: number;
    readonly startY: number;
    readonly duration: number;
    elapsed: number;
}

@ccclass("BattleHUDViewComp")
export class BattleHUDViewComp extends GamePage {
    /** Sprite sheet per action for each actor art; generated sheets can land incrementally. */
    private static readonly PLAYER_ASSET = "gui/battle-hud/actors/player-fire";
    private static readonly ACTOR_SHEETS: Readonly<Record<string, Readonly<Partial<Record<ActorAction, string>>>>> = {
        [BattleHUDViewComp.PLAYER_ASSET]: {
            idle: "gui/battle-hud/actors/player-idle",
            walk: "gui/battle-hud/actors/player-walk",
            attack: "gui/battle-hud/actors/player-attack",
            attackWalk: "gui/battle-hud/actors/player-attack-walk",
            dodge: "gui/battle-hud/actors/player-dodge",
        },
        "gui/battle-hud/actors/walker": {
            walk: "gui/battle-hud/actors/walker-walk",
            attack: "gui/battle-hud/actors/walker-attack",
        },
        "gui/battle-hud/actors/runner": {
            walk: "gui/battle-hud/actors/runner-walk",
            attack: "gui/battle-hud/actors/runner-attack",
        },
        "gui/battle-hud/actors/brute": {
            walk: "gui/battle-hud/actors/brute-walk",
            attack: "gui/battle-hud/actors/brute-attack",
        },
    };

    private readonly map = createHospitalDistrictMap();
    private readonly simulation = new BattleSimulation(this.map);
    private frame!: SafeFrame;
    private worldLayer!: Node;
    private worldTouchLayer!: Node;
    private playerNode!: Node;
    private playerAnimator: ActorAnimator | null = null;
    private playerHealthText!: Label;
    private playerShieldText!: Label;
    private playerHealthBar!: Node;
    private playerShieldBar!: Node;
    private downedLabel!: Label;
    private readonly dayClock = new DayClock(DAY_DURATION_SECONDS, DAY_WARNING_SECONDS, DAY_NIGHT_SECONDS, DAY_HUNT_SECONDS);
    private dayTimeLabel!: Label;
    private dayPressureLabel!: Label;
    private dayProgressBar!: Node;
    private enemyNodes: Node[] = [];
    private enemyAnimators: ActorAnimator[] = [];
    private enemyHealthBars: Node[] = [];
    private structureNode!: Node;
    private structureHealthBar!: Node;
    private structureStatusLabel!: Label;
    private readonly lootNodes = new Map<string, Node>();
    private readonly explorationNodes = new Map<string, Node>();
    private readonly fullMapObjectLabels = new Map<string, Label>();
    private readonly projectileNodes = new Map<string, Node>();
    private readonly damageFeedbacks: DamageFeedback[] = [];
    private readonly hitFlashRemaining = new Map<string, number>();
    private lastDodgeCount = 0;
    private pathGraphics!: Graphics;
    private navigationGraphics!: Graphics;
    private minimapStatic!: Graphics;
    private minimapDynamic!: Graphics;
    private fullMapStatic!: Graphics;
    private fullMapDynamic!: Graphics;
    private fullMapPanel!: Node;
    private distanceLabel!: Label;
    private interactionPanel!: Node;
    private interactionNameLabel!: Label;
    private interactionDistanceLabel!: Label;
    private interactionActionLabel!: Label;
    private interactionTargetId: string | null = null;
    private noticePanel!: Node;
    private noticeLabel!: Label;
    private noticeOpacity!: UIOpacity;
    private noticeRemaining = 0;
    private lastNoticeId = "";
    private joystickThumb!: Node;
    private joystickCenter = { x: 0, y: 0 };
    private joystickVector = { x: 0, y: 0 };
    private joystickTouchId: number | null = null;
    private camera = { x: 0, y: 0 };
    private heldKeys = new Set<KeyCode>();
    private sprintTouch = false;
    private paused = false;
    private lastPathSignature = "";
    private lastHordePhase: HordePhase | null = null;
    private nightCompletedDispatched = false;
    private barrierWasActive = true;

    protected onLoad(): void {
        this.render();
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        oops.message.on(GameEvent.GamePaused, this.onGamePaused, this);
        oops.message.on(GameEvent.GameResumed, this.onGameResumed, this);
    }

    update(deltaTime: number): void {
        const fullMapOpen = Boolean(this.fullMapPanel?.active);
        this.advanceDayClock(deltaTime, explorationTimeScale(this.paused, fullMapOpen));
        this.syncHordeEvents();
        if (this.paused || fullMapOpen) return;
        this.simulation.update(deltaTime);
        this.syncDayTimer();
        this.syncHordeEvents();
        this.syncActors();
        this.syncVitality();
        this.syncProjectiles();
        this.syncExplorationObjects();
        this.syncInteractionPanel();
        this.consumeNoticeEvents();
        this.updateNotice(deltaTime);
        this.consumeHitEvents();
        this.updateCombatFeedback(deltaTime);
        this.updateCamera(deltaTime);
        this.syncPath();
        this.drawDynamicMap(this.minimapDynamic, 142, 82, true);
        this.updateDistance();
    }

    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        oops.message.off(GameEvent.GamePaused, this.onGamePaused, this);
        oops.message.off(GameEvent.GameResumed, this.onGameResumed, this);
        this.worldTouchLayer?.off(Node.EventType.TOUCH_END, this.onWorldTouchEnd, this);
        super.onDestroy();
    }

    private render(): void {
        this.frame = UIBuilder.prepareRoot(this.node);
        this.renderWorld();
        this.renderWorldTouchLayer();
        this.renderPlayerStatus(this.frame);
        this.renderDayTimer(this.frame);
        this.renderMinimap(this.frame);
        this.renderTouchControls(this.frame);
        this.renderInteractionPanel(this.frame);
        this.renderNotice(this.frame);
        this.renderObjective(this.frame);
        this.renderFullMap(this.frame);
        this.syncActors();
        this.syncVitality();
        this.syncProjectiles();
        this.syncExplorationObjects();
        this.syncInteractionPanel();
        this.updateCamera(1);
        this.drawDynamicMap(this.minimapDynamic, 142, 82, true);
    }

    private renderWorld(): void {
        this.worldLayer = this.createNode(this.node, "WorldLayer", new Size(this.map.worldWidth, this.map.worldHeight), Vec3.ZERO);
        const tileWidth = this.map.worldWidth / 3 + 2;
        const tileHeight = this.map.worldHeight / 3 + 2;
        const tints = [new Color(224, 238, 244, 255), new Color(205, 228, 238, 255), new Color(232, 236, 224, 255)];
        for (let row = 0; row < 3; row++) {
            for (let column = 0; column < 3; column++) {
                const position = new Vec3((column - 1) * tileWidth, (row - 1) * tileHeight);
                void UIBuilder.sprite(
                    this.worldLayer,
                    "gui/battle-hud/texture/hospital-district",
                    new Size(tileWidth + 2, tileHeight + 2),
                    position,
                    false,
                    tints[(row + column) % tints.length],
                );
            }
        }

        const navigationOverlay = this.createNode(this.worldLayer, "NavigationOverlay", new Size(this.map.worldWidth, this.map.worldHeight), Vec3.ZERO);
        this.navigationGraphics = navigationOverlay.addComponent(Graphics);
        this.redrawNavigationOverlay();

        const pathNode = this.createNode(this.worldLayer, "NavigationPath", new Size(this.map.worldWidth, this.map.worldHeight), Vec3.ZERO);
        this.pathGraphics = pathNode.addComponent(Graphics);
        this.renderExplorationObjects();
        this.renderWorldActors();
    }

    private redrawNavigationOverlay(): void {
        this.navigationGraphics.clear();
        this.navigationGraphics.fillColor = new Color(22, 228, 239, 13);
        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.columns; x++) {
                if (!this.map.isWalkable({ x, y })) continue;
                const point = this.map.cellToWorld({ x, y });
                this.navigationGraphics.rect(point.x - this.map.tileSize / 2, point.y - this.map.tileSize / 2, this.map.tileSize, this.map.tileSize);
            }
        }
        this.navigationGraphics.fill();
    }

    private renderExplorationObjects(): void {
        for (const loot of this.simulation.loot) {
            const node = this.createNode(this.worldLayer, `Loot:${loot.id}`, new Size(120, 100), new Vec3(loot.x, loot.y));
            const opacity = node.addComponent(UIOpacity);
            opacity.opacity = 255;
            const graphics = node.addComponent(Graphics);
            graphics.fillColor = new Color(35, 45, 51, 245);
            graphics.roundRect(-42, -24, 84, 48, 7);
            graphics.fill();
            graphics.lineWidth = 5;
            graphics.strokeColor = UI_THEME.colors.orange;
            graphics.roundRect(-42, -24, 84, 48, 7);
            graphics.stroke();
            graphics.moveTo(-38, 6);
            graphics.lineTo(38, 6);
            graphics.moveTo(0, 6);
            graphics.lineTo(0, -18);
            graphics.stroke();
            UIBuilder.label(node, `LootName:${loot.id}`, loot.name, new Size(156, 28), new Vec3(0, -42), 15, UI_THEME.colors.orange);
            node.active = loot.discovered;
            this.lootNodes.set(loot.id, node);
        }

        for (const point of this.simulation.explorationPoints) {
            const node = this.createNode(this.worldLayer, `Explore:${point.id}`, new Size(116, 116), new Vec3(point.x, point.y));
            const opacity = node.addComponent(UIOpacity);
            opacity.opacity = 255;
            const graphics = node.addComponent(Graphics);
            graphics.fillColor = new Color(9, 57, 70, 235);
            graphics.moveTo(0, 34);
            graphics.lineTo(34, 0);
            graphics.lineTo(0, -34);
            graphics.lineTo(-34, 0);
            graphics.close();
            graphics.fill();
            graphics.lineWidth = 5;
            graphics.strokeColor = UI_THEME.colors.cyan;
            graphics.moveTo(0, 34);
            graphics.lineTo(34, 0);
            graphics.lineTo(0, -34);
            graphics.lineTo(-34, 0);
            graphics.close();
            graphics.stroke();
            graphics.moveTo(0, -16);
            graphics.lineTo(0, 16);
            graphics.moveTo(-12, 4);
            graphics.lineTo(0, 16);
            graphics.lineTo(12, 4);
            graphics.stroke();
            UIBuilder.label(node, `ExploreName:${point.id}`, point.name, new Size(156, 28), new Vec3(0, -48), 15, UI_THEME.colors.cyan);
            this.explorationNodes.set(point.id, node);
        }
    }

    private renderWorldActors(): void {
        this.playerNode = this.createActor("Player", BattleHUDViewComp.PLAYER_ASSET, 158);
        this.playerAnimator = this.playerNode.getComponent(ActorAnimator);
        this.enemyNodes = [];
        this.enemyAnimators = [];
        this.enemyHealthBars = [];
        this.ensureEnemyNodes();
        this.renderBattleStructure();
    }

    private ensureEnemyNodes(): void {
        while (this.enemyNodes.length < this.simulation.enemies.length) {
            const index = this.enemyNodes.length;
            const enemy = this.simulation.enemies[index];
            const presentation = ENEMY_PRESENTATION[enemy.kind];
            const actor = this.createActor(`${presentation.name}:${enemy.id}`, presentation.asset, presentation.size);
            this.enemyNodes[index] = actor;
            this.enemyAnimators[index] = actor.getComponent(ActorAnimator)!;
            this.enemyHealthBars[index] = UIBuilder.progressBar(
                actor,
                `${presentation.name}Health:${enemy.id}`,
                new Size(enemy.kind === "brute" ? 156 : 104, 18),
                new Vec3(0, presentation.size * 0.47),
                enemy.vitality.healthRatio,
                enemy.kind === "brute" ? UI_THEME.colors.magenta : UI_THEME.colors.danger,
            );
        }
    }

    private renderBattleStructure(): void {
        const structure = this.simulation.structures[0];
        this.structureNode = this.createNode(this.worldLayer, "Barricade", new Size(154, 116), new Vec3(structure.x, structure.y));
        this.structureNode.addComponent(UIOpacity);
        const graphics = this.structureNode.addComponent(Graphics);
        graphics.fillColor = new Color(38, 49, 55, 245);
        graphics.roundRect(-68, -25, 136, 50, 8);
        graphics.fill();
        graphics.lineWidth = 5;
        graphics.strokeColor = UI_THEME.colors.orange;
        graphics.moveTo(-58, -18);
        graphics.lineTo(-32, 18);
        graphics.lineTo(-6, -18);
        graphics.lineTo(20, 18);
        graphics.lineTo(48, -18);
        graphics.stroke();
        this.structureHealthBar = UIBuilder.progressBar(
            this.structureNode,
            "BarricadeHealth",
            new Size(144, 18),
            new Vec3(0, 48),
            structure.vitality.healthRatio,
            UI_THEME.colors.orange,
        );
        this.structureStatusLabel = UIBuilder.label(
            this.structureNode,
            "BarricadeStatus",
            "路障",
            new Size(180, 28),
            new Vec3(0, -48),
            16,
            UI_THEME.colors.white,
        );
    }

    private createActor(name: string, asset: string, size: number): Node {
        const actor = this.createNode(this.worldLayer, name, new Size(size, size), Vec3.ZERO);
        actor.addComponent(UIOpacity);
        const animator = actor.addComponent(ActorAnimator);
        animator.setup({
            fallback: asset,
            sheets: BattleHUDViewComp.ACTOR_SHEETS[asset] ?? {},
            facingBase: asset === BattleHUDViewComp.PLAYER_ASSET ? 1 : -1,
        });
        void UIBuilder.sprite(actor, asset, new Size(size, size), Vec3.ZERO).then((sprite) => animator.attach(sprite));
        return actor;
    }

    private renderWorldTouchLayer(): void {
        this.worldTouchLayer = this.createNode(this.node, "WorldTouchLayer", new Size(this.frame.width, this.frame.height), Vec3.ZERO);
        this.worldTouchLayer.on(Node.EventType.TOUCH_END, this.onWorldTouchEnd, this);
    }

    private renderPlayerStatus(frame: SafeFrame): void {
        const status = UIBuilder.hudPlate(this.node, "PlayerStatus", "exploration-hud/01-player-health-frame", new Size(390, 176), new Vec3(frame.left + 195, frame.top - 88));
        const layout = playerStatusLayout();
        void UIBuilder.icon(status, "hud-combat/01-health", 46, new Vec3(-163, 54));
        this.playerHealthBar = UIBuilder.progressBar(status, "Health", new Size(layout.healthBar.width, layout.healthBar.height), new Vec3(layout.healthBar.centerX, layout.healthBar.centerY), 1, UI_THEME.colors.danger);
        this.playerHealthText = UIBuilder.label(status, "HealthText", "", new Size(layout.healthText.width, layout.healthText.height), new Vec3(layout.healthText.centerX, layout.healthText.centerY), 19, UI_THEME.colors.white, HorizontalTextAlignment.RIGHT);
        this.playerShieldBar = UIBuilder.progressBar(status, "Shield", new Size(layout.shieldBar.width, layout.shieldBar.height), new Vec3(layout.shieldBar.centerX, layout.shieldBar.centerY), 1, UI_THEME.colors.cyan);
        this.playerShieldText = UIBuilder.label(status, "ShieldText", "", new Size(layout.shieldText.width, layout.shieldText.height), new Vec3(layout.shieldText.centerX, layout.shieldText.centerY), 15, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
        UIBuilder.label(status, "PollutionText", "污染  32 / 100", new Size(layout.pollutionText.width, layout.pollutionText.height), new Vec3(layout.pollutionText.centerX, layout.pollutionText.centerY), 15, UI_THEME.colors.magenta, HorizontalTextAlignment.LEFT);
        this.downedLabel = UIBuilder.label(status, "DownedText", "已倒地", new Size(layout.downedText.width, layout.downedText.height), new Vec3(layout.downedText.centerX, layout.downedText.centerY), 19, UI_THEME.colors.danger);
        this.downedLabel.node.active = false;
    }

    private renderDayTimer(frame: SafeFrame): void {
        const timer = UIBuilder.hudPlate(this.node, "DayTimer", "exploration-hud/05-day-timer-frame", new Size(340, 112), new Vec3(0, frame.top - 54));
        void UIBuilder.icon(timer, "hud-combat/05-day-timer", 42, new Vec3(-112, 18));
        this.dayTimeLabel = UIBuilder.label(timer, "DayTime", "", new Size(130, 42), new Vec3(5, 18), 28, UI_THEME.colors.white);
        this.dayPressureLabel = UIBuilder.label(timer, "Sunset", "", new Size(94, 28), new Vec3(112, 18), 16, UI_THEME.colors.orange);
        this.dayProgressBar = UIBuilder.progressBar(timer, "DayProgress", new Size(254, 19), new Vec3(0, -24), 1, UI_THEME.colors.orange);
        this.syncDayTimer();
    }

    private advanceDayClock(deltaTime: number, timeScale: number): void {
        if (timeScale <= 0) return;
        const previousSecond = Math.ceil(this.dayClock.remaining);
        const previousPressure = this.dayClock.pressure;
        this.dayClock.tick(deltaTime, timeScale);
        if (this.dayClock.pressure === "night" || this.dayClock.pressure === "hunt") {
            this.simulation.startHorde(1);
        }
        this.syncDayTimer();

        if (Math.ceil(this.dayClock.remaining) !== previousSecond) {
            oops.message.dispatchEvent(GameEvent.DayTimeChanged, this.dayClock.remaining);
        }
        if (this.dayClock.pressure !== previousPressure) {
            oops.message.dispatchEvent(GameEvent.DayPressureChanged, this.dayClock.pressure);
        }
    }

    private syncDayTimer(): void {
        if (this.simulation.hordeStarted) {
            const phase = this.simulation.hordePhase;
            const presentation = phase ? HORDE_PHASE_PRESENTATION[phase] : HORDE_PHASE_PRESENTATION.warning;
            this.dayTimeLabel.string = this.simulation.hordeCompleted
                ? "防守完成"
                : `威胁 ${this.simulation.remainingHordeThreats}`;
            this.dayPressureLabel.string = this.simulation.hordeCompleted ? "尸潮击退" : presentation.text;
            this.dayPressureLabel.color = this.simulation.hordeCompleted ? UI_THEME.colors.success : presentation.color;
            this.dayTimeLabel.color = this.dayPressureLabel.color;
            UIBuilder.setProgressBarRatio(this.dayProgressBar, this.simulation.hordeProgressRatio);
            return;
        }

        this.dayTimeLabel.string = formatDayTime(this.dayClock.remaining);
        UIBuilder.setProgressBarRatio(this.dayProgressBar, this.dayClock.remainingRatio);

        const presentation = DAY_PRESSURE_PRESENTATION[this.dayClock.pressure];
        this.dayPressureLabel.string = presentation.text;
        this.dayPressureLabel.color = presentation.color;
        this.dayTimeLabel.color = presentation.color;
    }

    private syncHordeEvents(): void {
        const phase = this.simulation.hordePhase;
        if (phase && phase !== this.lastHordePhase) {
            this.lastHordePhase = phase;
            if (phase === "warning") oops.message.dispatchEvent(GameEvent.HordeWarning);
            oops.message.dispatchEvent(GameEvent.HordeWaveChanged, phase, this.simulation.remainingHordeThreats);
        }
        if (this.simulation.hordeCompleted && !this.nightCompletedDispatched) {
            this.nightCompletedDispatched = true;
            oops.message.dispatchEvent(GameEvent.NightCompleted);
        }
    }

    private renderMinimap(frame: SafeFrame): void {
        const mapPanel = UIBuilder.hudPlate(this.node, "Minimap", "exploration-hud/09-minimap-bezel", new Size(196, 196), new Vec3(frame.right - 104, frame.top - 104));
        const mapCanvas = this.createNode(mapPanel, "MinimapCanvas", new Size(142, 82), new Vec3(-8, 8));
        this.minimapStatic = mapCanvas.addComponent(Graphics);
        this.drawStaticMap(this.minimapStatic, 142, 82);
        const dynamicNode = this.createNode(mapCanvas, "MinimapDynamic", new Size(142, 82), Vec3.ZERO);
        this.minimapDynamic = dynamicNode.addComponent(Graphics);
        const mapButton = this.createNode(mapPanel, "BtnOpenFullMap", new Size(142, 82), new Vec3(-8, 8));
        this.bindTouch(mapButton, () => this.openFullMap());
        this.distanceLabel = UIBuilder.label(mapPanel, "Distance", "方舟 0m", new Size(142, 28), new Vec3(-8, -56), 16, UI_THEME.colors.orange);

        const pause = UIBuilder.navButton(mapPanel, "BtnPause", "暂停", "system-nav/10-pause", new Size(76, 66), new Vec3(58, 65));
        this.bindTouch(pause, () => { void this.openPause(); });
    }

    private renderTouchControls(frame: SafeFrame): void {
        this.joystickCenter = { x: frame.left + 138, y: frame.bottom + 142 };
        const joystickPosition = new Vec3(this.joystickCenter.x, this.joystickCenter.y);
        void UIBuilder.sprite(this.node, "gui/ui-p0/texture/touch-tutorial/01-joystick-base", new Size(210, 210), joystickPosition);
        this.joystickThumb = this.createNode(this.node, "JoystickThumb", new Size(104, 104), joystickPosition);
        void UIBuilder.sprite(this.joystickThumb, "gui/ui-p0/texture/touch-tutorial/02-joystick-thumb", new Size(104, 104), Vec3.ZERO);
        const touchArea = this.createNode(this.node, "JoystickTouchArea", new Size(230, 230), joystickPosition);
        touchArea.on(Node.EventType.TOUCH_START, this.onJoystickStart, this);
        touchArea.on(Node.EventType.TOUCH_MOVE, this.onJoystickMove, this);
        touchArea.on(Node.EventType.TOUCH_END, this.onJoystickEnd, this);
        touchArea.on(Node.EventType.TOUCH_CANCEL, this.onJoystickEnd, this);

        const controls = battleControlLayout(frame);
        const primary = controls.primaryAction;
        const action = UIBuilder.hudPlate(this.node, "PrimaryAction", "touch-tutorial/03-action-button-large", new Size(primary.width, primary.height), new Vec3(primary.centerX, primary.centerY));
        UIBuilder.label(action, "ActionGlyph", "疾跑", new Size(100, 42), Vec3.ZERO, 22, UI_THEME.colors.white);
        action.on(Node.EventType.TOUCH_START, this.onSprintStart, this);
        action.on(Node.EventType.TOUCH_END, this.onSprintEnd, this);
        action.on(Node.EventType.TOUCH_CANCEL, this.onSprintEnd, this);
        const skillRect = controls.skillAction;
        const skill = UIBuilder.hudPlate(this.node, "SkillAction", "touch-tutorial/04-action-button-medium", new Size(skillRect.width, skillRect.height), new Vec3(skillRect.centerX, skillRect.centerY));
        UIBuilder.label(skill, "SkillGlyph", "技能", new Size(74, 36), Vec3.ZERO, 18, UI_THEME.colors.white);
        const dodgeRect = controls.dodgeAction;
        const dodge = UIBuilder.hudPlate(this.node, "DodgeAction", "touch-tutorial/04-action-button-medium", new Size(dodgeRect.width, dodgeRect.height), new Vec3(dodgeRect.centerX, dodgeRect.centerY));
        UIBuilder.label(dodge, "DodgeGlyph", "翻滚", new Size(70, 34), Vec3.ZERO, 17, UI_THEME.colors.white);
        this.bindTouch(dodge, () => { this.simulation.tryDodge(); });
    }

    private renderInteractionPanel(frame: SafeFrame): void {
        this.interactionPanel = UIBuilder.surface(
            this.node,
            "InteractionPanel",
            new Size(340, 94),
            new Vec3(0, frame.bottom + 140),
            "tooltip",
        );
        this.interactionNameLabel = UIBuilder.label(
            this.interactionPanel,
            "InteractionName",
            "",
            new Size(190, 34),
            new Vec3(-66, 20),
            18,
            UI_THEME.colors.white,
            HorizontalTextAlignment.LEFT,
        );
        this.interactionDistanceLabel = UIBuilder.label(
            this.interactionPanel,
            "InteractionDistance",
            "",
            new Size(190, 26),
            new Vec3(-66, -18),
            14,
            UI_THEME.colors.muted,
            HorizontalTextAlignment.LEFT,
        );
        const action = UIBuilder.button(this.interactionPanel, "BtnInteract", "开启", new Size(112, 62), new Vec3(102, 0), true);
        this.interactionActionLabel = action.getChildByName("BtnInteractLabel")!.getComponent(Label)!;
        this.bindTouch(action, () => this.activateInteraction());
        this.interactionPanel.active = false;
    }

    private renderNotice(frame: SafeFrame): void {
        this.noticePanel = UIBuilder.hudPlate(
            this.node,
            "ExplorationNotice",
            "exploration-hud/12-pickup-notification-card",
            new Size(460, 82),
            new Vec3(0, frame.top - 154),
        );
        this.noticeLabel = UIBuilder.label(this.noticePanel, "ExplorationNoticeText", "", new Size(410, 52), Vec3.ZERO, 17, UI_THEME.colors.orange);
        this.noticeOpacity = this.noticePanel.addComponent(UIOpacity);
        this.noticePanel.active = false;
    }

    private syncInteractionPanel(): void {
        const target = this.simulation.nearestInteraction;
        this.interactionTargetId = target?.id ?? null;
        this.interactionPanel.active = target !== null;
        if (!target) return;
        this.interactionNameLabel.string = target.name;
        this.interactionDistanceLabel.string = `距离 ${Math.ceil(target.distance / 4)}m`;
        this.interactionActionLabel.string = target.action === "open" ? "开启" : "调查";
    }

    private activateInteraction(): void {
        if (!this.interactionTargetId || this.paused || this.fullMapPanel.active) return;
        const result = this.simulation.interact(this.interactionTargetId);
        if (!result.accepted) return;
        this.syncExplorationObjects();
        this.syncInteractionPanel();
        this.syncFullMapObjectLabels();
        this.drawDynamicMap(this.minimapDynamic, 142, 82, true);
        this.consumeNoticeEvents();
    }

    private consumeNoticeEvents(): void {
        const notice = this.simulation.noticeEvents[this.simulation.noticeEvents.length - 1];
        if (!notice || notice.id === this.lastNoticeId) return;
        this.lastNoticeId = notice.id;
        this.noticeLabel.string = notice.message;
        this.noticeOpacity.opacity = 255;
        this.noticeRemaining = 2.4;
        this.noticePanel.active = true;
    }

    private updateNotice(deltaTime: number): void {
        if (this.noticeRemaining <= 0) return;
        this.noticeRemaining = Math.max(0, this.noticeRemaining - Math.max(0, deltaTime));
        this.noticeOpacity.opacity = this.noticeRemaining > 0.4
            ? 255
            : Math.round(255 * this.noticeRemaining / 0.4);
        if (this.noticeRemaining === 0) this.noticePanel.active = false;
    }

    private renderObjective(frame: SafeFrame): void {
        const objective = UIBuilder.surface(this.node, "ObjectivePlate", new Size(570, 68), new Vec3(0, frame.bottom + 48), "tooltip");
        UIBuilder.label(objective, "Objective", "当前目标 · 搜索医院物资并撤离  |  WASD / 摇杆移动 · 点击地面寻路", new Size(538, 38), Vec3.ZERO, 17, UI_THEME.colors.white);
        const returnRect = battleControlLayout(frame).returnArk;
        const returnArk = UIBuilder.navButton(this.node, "BtnReturnArk", "撤回方舟", "hud-combat/07-ark-return", new Size(returnRect.width, returnRect.height), new Vec3(returnRect.centerX, returnRect.centerY), true);
        this.bindTouch(returnArk, () => { void this.requestReturn(); });
    }

    private renderFullMap(frame: SafeFrame): void {
        this.fullMapPanel = UIBuilder.panel(this.node, "FullMapOverlay", new Size(frame.width + 8, frame.height + 8), Vec3.ZERO, new Color(1, 7, 12, 230), UI_THEME.colors.cyanDark);
        this.fullMapPanel.addComponent(BlockInputEvents);
        const panel = UIBuilder.surface(this.fullMapPanel, "FullMapPanel", new Size(930, 610), Vec3.ZERO, "large");
        UIBuilder.label(panel, "FullMapTitle", "医院城区 · 完整战术地图", new Size(620, 48), new Vec3(0, 264), 28, UI_THEME.colors.white);
        UIBuilder.label(panel, "FullMapHint", "青色：可通行道路   橙色：当前路线   红色：感染体   点击右上角小地图可再次打开", new Size(760, 28), new Vec3(0, 225), 15, UI_THEME.colors.muted);
        const mapCanvas = this.createNode(panel, "FullMapCanvas", new Size(800, 440), new Vec3(0, -20));
        this.fullMapStatic = mapCanvas.addComponent(Graphics);
        this.drawStaticMap(this.fullMapStatic, 800, 440);
        const dynamicNode = this.createNode(mapCanvas, "FullMapDynamic", new Size(800, 440), Vec3.ZERO);
        this.fullMapDynamic = dynamicNode.addComponent(Graphics);
        for (const point of this.map.pointsOfInterest) {
            const position = this.mapPosition(this.map.cellToWorld(point.cell), 800, 440);
            UIBuilder.label(mapCanvas, `Poi:${point.id}`, point.name, new Size(116, 24), new Vec3(position.x, position.y + 15), 13, UI_THEME.colors.white);
        }
        for (const loot of this.simulation.loot) {
            const position = this.mapPosition(loot, 800, 440);
            const label = UIBuilder.label(mapCanvas, `LootMap:${loot.id}`, loot.name, new Size(150, 22), new Vec3(position.x, position.y + 14), 12, UI_THEME.colors.orange);
            this.fullMapObjectLabels.set(loot.id, label);
        }
        for (const point of this.simulation.explorationPoints) {
            const position = this.mapPosition(point, 800, 440);
            const label = UIBuilder.label(mapCanvas, `ExploreMap:${point.id}`, point.name, new Size(150, 22), new Vec3(position.x, position.y + 14), 12, UI_THEME.colors.cyan);
            this.fullMapObjectLabels.set(point.id, label);
        }
        this.syncFullMapObjectLabels();
        const close = UIBuilder.button(panel, "BtnCloseFullMap", "关闭地图", new Size(152, 54), new Vec3(365, 260));
        this.bindTouch(close, () => this.closeFullMap());
        this.fullMapPanel.active = false;
    }

    private drawStaticMap(graphics: Graphics, width: number, height: number): void {
        graphics.clear();
        graphics.fillColor = new Color(2, 13, 22, 245);
        graphics.rect(-width / 2, -height / 2, width, height);
        graphics.fill();
        const cellWidth = width / this.map.columns;
        const cellHeight = height / this.map.rows;
        graphics.fillColor = new Color(18, 109, 126, 220);
        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.columns; x++) {
                if (!this.map.isWalkable({ x, y })) continue;
                graphics.rect(-width / 2 + x * cellWidth + 0.5, -height / 2 + y * cellHeight + 0.5, Math.max(1, cellWidth - 1), Math.max(1, cellHeight - 1));
            }
        }
        graphics.fill();
        for (const point of this.map.pointsOfInterest) {
            const position = this.mapPosition(this.map.cellToWorld(point.cell), width, height);
            graphics.fillColor = point.kind === "extraction" ? UI_THEME.colors.orange : UI_THEME.colors.cyan;
            graphics.circle(position.x, position.y, width > 200 ? 7 : 2.8);
            graphics.fill();
        }
        graphics.lineWidth = width > 200 ? 3 : 1;
        graphics.strokeColor = UI_THEME.colors.cyan;
        graphics.rect(-width / 2, -height / 2, width, height);
        graphics.stroke();
    }

    private drawDynamicMap(graphics: Graphics, width: number, height: number, showViewport: boolean): void {
        graphics.clear();
        if (this.simulation.playerPath.length > 0) {
            graphics.strokeColor = UI_THEME.colors.orange;
            graphics.lineWidth = width > 200 ? 4 : 2;
            const start = this.mapPosition(this.simulation.player, width, height);
            graphics.moveTo(start.x, start.y);
            for (const cell of this.simulation.playerPath) {
                const point = this.mapPosition(this.map.cellToWorld(cell), width, height);
                graphics.lineTo(point.x, point.y);
            }
            graphics.stroke();
        }
        graphics.fillColor = UI_THEME.colors.danger;
        for (const enemy of this.simulation.activeEnemies) {
            const position = this.mapPosition(enemy, width, height);
            graphics.circle(position.x, position.y, width > 200 ? 5 : 2.3);
            graphics.fill();
        }
        for (const loot of this.simulation.loot) {
            if (!loot.discovered) continue;
            const position = this.mapPosition(loot, width, height);
            const radius = width > 200 ? (loot.opened ? 4 : 7) : (loot.opened ? 1.8 : 3.2);
            graphics.fillColor = loot.opened ? new Color(220, 232, 235, 150) : UI_THEME.colors.orange;
            graphics.rect(position.x - radius, position.y - radius, radius * 2, radius * 2);
            graphics.fill();
            if (loot.opened && width > 200) {
                graphics.lineWidth = 2;
                graphics.strokeColor = UI_THEME.colors.white;
                graphics.moveTo(position.x - 4, position.y);
                graphics.lineTo(position.x - 1, position.y - 4);
                graphics.lineTo(position.x + 5, position.y + 4);
                graphics.stroke();
            }
        }
        for (const point of this.simulation.explorationPoints) {
            const position = this.mapPosition(point, width, height);
            const radius = width > 200 ? (point.completed ? 4 : 7) : (point.completed ? 1.8 : 3.2);
            graphics.fillColor = point.completed ? new Color(220, 232, 235, 150) : UI_THEME.colors.cyan;
            graphics.moveTo(position.x, position.y + radius);
            graphics.lineTo(position.x + radius, position.y);
            graphics.lineTo(position.x, position.y - radius);
            graphics.lineTo(position.x - radius, position.y);
            graphics.close();
            graphics.fill();
        }
        const barrier = this.simulation.structures[0];
        const barrierPosition = this.mapPosition(barrier, width, height);
        graphics.lineWidth = width > 200 ? 5 : 2;
        graphics.strokeColor = barrier.vitality.active ? UI_THEME.colors.danger : UI_THEME.colors.cyan;
        graphics.moveTo(barrierPosition.x - (width > 200 ? 9 : 4), barrierPosition.y);
        graphics.lineTo(barrierPosition.x + (width > 200 ? 9 : 4), barrierPosition.y);
        graphics.stroke();
        const player = this.mapPosition(this.simulation.player, width, height);
        graphics.fillColor = UI_THEME.colors.white;
        graphics.circle(player.x, player.y, width > 200 ? 7 : 3.2);
        graphics.fill();

        if (showViewport) {
            const camera = this.mapPosition(this.camera, width, height);
            const viewportWidth = width * this.frame.width / this.map.worldWidth;
            const viewportHeight = height * this.frame.height / this.map.worldHeight;
            graphics.lineWidth = 1;
            graphics.strokeColor = new Color(239, 248, 250, 150);
            graphics.rect(camera.x - viewportWidth / 2, camera.y - viewportHeight / 2, viewportWidth, viewportHeight);
            graphics.stroke();
        }
    }

    private mapPosition(point: WorldPoint, width: number, height: number): WorldPoint {
        return { x: point.x / this.map.worldWidth * width, y: point.y / this.map.worldHeight * height };
    }

    private syncExplorationObjects(): void {
        for (const loot of this.simulation.loot) {
            const node = this.lootNodes.get(loot.id);
            if (!node) continue;
            node.active = loot.discovered;
            node.getComponent(UIOpacity)!.opacity = loot.opened ? 100 : 255;
        }
        for (const point of this.simulation.explorationPoints) {
            const node = this.explorationNodes.get(point.id);
            if (!node) continue;
            node.getComponent(UIOpacity)!.opacity = point.completed ? 100 : 255;
        }
        this.syncFullMapObjectLabels();
    }

    private syncFullMapObjectLabels(): void {
        for (const loot of this.simulation.loot) {
            const label = this.fullMapObjectLabels.get(loot.id);
            if (!label) continue;
            label.node.active = loot.discovered;
            label.string = loot.opened ? `✓ ${loot.name}` : loot.name;
            label.color = loot.opened ? UI_THEME.colors.muted : UI_THEME.colors.orange;
        }
        for (const point of this.simulation.explorationPoints) {
            const label = this.fullMapObjectLabels.get(point.id);
            if (!label) continue;
            label.string = point.completed ? `✓ ${point.name}` : point.name;
            label.color = point.completed ? UI_THEME.colors.muted : UI_THEME.colors.cyan;
        }
    }

    private syncActors(): void {
        const simulation = this.simulation;
        this.ensureEnemyNodes();
        this.playerNode.setPosition(simulation.player.x, simulation.player.y);
        const structure = simulation.structures[0];
        this.structureNode.setPosition(structure.x, structure.y);
        if (this.playerAnimator) {
            const target = simulation.playerTarget;
            this.playerAnimator.setFacing(target ? target.x >= simulation.player.x : simulation.facing.x >= 0);
            if (simulation.playerDodgeCount !== this.lastDodgeCount) {
                this.lastDodgeCount = simulation.playerDodgeCount;
                this.playerAnimator.playOnce("dodge");
            } else {
                const action: ActorAction = simulation.playerAutoAttacking
                    ? (simulation.playerMoving ? (this.playerAnimator.hasClip("attackWalk") ? "attackWalk" : "walk") : "attack")
                    : simulation.playerMoving
                        ? "walk"
                        : "idle";
                const speed = (action === "walk" || action === "attackWalk") && simulation.sprinting ? simulation.sprintMultiplier : 1;
                this.playerAnimator.setBase(action, speed);
            }
        }
        simulation.enemies.forEach((enemy, index) => {
            const node = this.enemyNodes[index];
            if (!node || enemy.vitality.state === "dead") return;
            node.setPosition(enemy.x, enemy.y);
            const animator = this.enemyAnimators[index];
            if (!animator) return;
            animator.setFacing(simulation.player.x >= enemy.x);
            animator.setBase(enemy.attacking ? "attack" : "walk");
        });
    }

    private syncVitality(): void {
        this.ensureEnemyNodes();
        const player = this.simulation.player.vitality;
        this.playerHealthText.string = `${Math.ceil(player.currentHealth)} / ${player.maxHealth}`;
        this.playerShieldText.string = `护盾  ${Math.ceil(player.currentShield)} / ${player.maxShield}`;
        UIBuilder.setProgressBarRatio(this.playerHealthBar, player.healthRatio);
        UIBuilder.setProgressBarRatio(this.playerShieldBar, player.shieldRatio);
        this.downedLabel.node.active = player.state === "downed";

        this.simulation.enemies.forEach((enemy, index) => {
            const node = this.enemyNodes[index];
            if (node) node.active = enemy.vitality.state !== "dead";
            const healthBar = this.enemyHealthBars[index];
            if (healthBar) UIBuilder.setProgressBarRatio(healthBar, enemy.vitality.healthRatio);
        });

        const structure = this.simulation.structures[0];
        UIBuilder.setProgressBarRatio(this.structureHealthBar, structure.vitality.healthRatio);
        const destroyed = structure.vitality.state === "destroyed";
        this.structureStatusLabel.string = destroyed
            ? "路障 · 已摧毁 / 捷径已开放"
            : `可破坏路障 ${Math.ceil(structure.vitality.currentHealth)} / ${structure.vitality.maxHealth}`;
        this.structureNode.getComponent(UIOpacity)!.opacity = destroyed ? 90 : 255;
        if (this.barrierWasActive !== structure.vitality.active) {
            this.barrierWasActive = structure.vitality.active;
            this.redrawNavigationOverlay();
            this.drawStaticMap(this.minimapStatic, 142, 82);
            this.drawStaticMap(this.fullMapStatic, 800, 440);
        }
    }

    private createProjectileNode(id: string): Node {
        const node = this.createNode(this.worldLayer, `Projectile:${id}`, new Size(44, 18), Vec3.ZERO);
        const graphics = node.addComponent(Graphics);
        graphics.strokeColor = new Color(255, 220, 112, 90);
        graphics.lineWidth = 10;
        graphics.moveTo(-12, 0);
        graphics.lineTo(8, 0);
        graphics.stroke();
        graphics.strokeColor = new Color(255, 151, 31, 230);
        graphics.lineWidth = 5;
        graphics.moveTo(-18, 0);
        graphics.lineTo(5, 0);
        graphics.stroke();
        graphics.fillColor = new Color(255, 244, 184, 255);
        graphics.circle(8, 0, 4.5);
        graphics.fill();
        return node;
    }

    private syncProjectiles(): void {
        const activeIds = new Set<string>();
        for (const projectile of this.simulation.projectiles) {
            activeIds.add(projectile.id);
            let node = this.projectileNodes.get(projectile.id);
            if (!node) {
                node = this.createProjectileNode(projectile.id);
                this.projectileNodes.set(projectile.id, node);
            }
            node.setPosition(projectile.x, projectile.y);
            const target = this.simulation.findCombatTarget(projectile.targetId);
            if (target) {
                const angle = Math.atan2(target.y - projectile.y, target.x - projectile.x) * 180 / Math.PI;
                node.setRotationFromEuler(0, 0, angle);
            }
        }
        for (const [id, node] of this.projectileNodes) {
            if (activeIds.has(id)) continue;
            node.destroy();
            this.projectileNodes.delete(id);
        }
    }

    private consumeHitEvents(): void {
        for (const event of this.simulation.hitEvents) {
            const idParts = event.id.split("-");
            const eventNumber = Number(idParts[idParts.length - 1]);
            const horizontalOffset = eventNumber % 2 === 0 ? 12 : -12;
            const color = this.hitFeedbackColor(event.targetId, event.shieldDamage, event.healthDamage);
            const startX = event.x + horizontalOffset;
            const startY = event.y + 36;
            const label = UIBuilder.label(
                this.worldLayer,
                `Damage:${event.id}`,
                `-${Math.ceil(event.amount)}`,
                new Size(110, 42),
                new Vec3(startX, startY),
                25,
                color,
            );
            const opacity = label.node.addComponent(UIOpacity);
            this.damageFeedbacks.push({
                node: label.node,
                opacity,
                startX,
                startY,
                duration: 0.65,
                elapsed: 0,
            });
            this.hitFlashRemaining.set(event.targetId, 0.12);
        }
    }

    private hitFeedbackColor(targetId: string, shieldDamage: number, healthDamage: number): Color {
        if (targetId.startsWith("enemy-")) return UI_THEME.colors.orange;
        if (targetId === this.simulation.player.id) {
            return healthDamage > 0 ? UI_THEME.colors.danger : UI_THEME.colors.cyan;
        }
        if (shieldDamage > 0 && healthDamage === 0) return UI_THEME.colors.cyan;
        return new Color(255, 104, 48, 255);
    }

    private updateCombatFeedback(deltaTime: number): void {
        for (let index = this.damageFeedbacks.length - 1; index >= 0; index--) {
            const feedback = this.damageFeedbacks[index];
            feedback.elapsed += Math.max(0, deltaTime);
            const progress = Math.min(1, feedback.elapsed / feedback.duration);
            feedback.node.setPosition(feedback.startX, feedback.startY + progress * 64);
            const fade = progress <= 0.45 ? 1 : 1 - (progress - 0.45) / 0.55;
            feedback.opacity.opacity = Math.round(Math.max(0, fade) * 255);
            if (progress < 1) continue;
            feedback.node.destroy();
            this.damageFeedbacks.splice(index, 1);
        }

        for (const [targetId, remaining] of this.hitFlashRemaining) {
            const next = Math.max(0, remaining - Math.max(0, deltaTime));
            this.applyHitOpacity(targetId, next > 0);
            if (next === 0) this.hitFlashRemaining.delete(targetId);
            else this.hitFlashRemaining.set(targetId, next);
        }
    }

    private applyHitOpacity(targetId: string, flashing: boolean): void {
        let targetNode: Node | undefined;
        let restingOpacity = 255;
        if (targetId === this.simulation.player.id) {
            targetNode = this.playerNode;
        } else {
            const enemyIndex = this.simulation.enemies.findIndex((enemy) => enemy.id === targetId);
            if (enemyIndex >= 0) targetNode = this.enemyNodes[enemyIndex];
            const structure = this.simulation.structures.find((candidate) => candidate.id === targetId);
            if (structure) {
                targetNode = this.structureNode;
                restingOpacity = structure.vitality.state === "destroyed" ? 90 : 255;
            }
        }
        if (!targetNode) return;
        const opacity = targetNode.getComponent(UIOpacity) ?? targetNode.addComponent(UIOpacity);
        opacity.opacity = flashing ? Math.min(restingOpacity, 145) : restingOpacity;
    }

    private updateCamera(deltaTime: number): void {
        const target = cameraTargetFor(this.simulation.player, this.map, { width: this.frame.width, height: this.frame.height });
        const blend = 1 - Math.exp(-8 * Math.max(0, deltaTime));
        this.camera.x += (target.x - this.camera.x) * blend;
        this.camera.y += (target.y - this.camera.y) * blend;
        this.worldLayer.setPosition(-this.camera.x, -this.camera.y);
    }

    private syncPath(): void {
        const signature = this.simulation.playerPath.map((cell) => `${cell.x}:${cell.y}`).join("|");
        if (signature === this.lastPathSignature) return;
        this.lastPathSignature = signature;
        this.pathGraphics.clear();
        if (this.simulation.playerPath.length < 2) return;
        this.pathGraphics.lineWidth = 7;
        this.pathGraphics.strokeColor = new Color(255, 169, 31, 210);
        const first = this.map.cellToWorld(this.simulation.playerPath[0]);
        this.pathGraphics.moveTo(first.x, first.y);
        for (const cell of this.simulation.playerPath.slice(1)) {
            const point = this.map.cellToWorld(cell);
            this.pathGraphics.lineTo(point.x, point.y);
        }
        this.pathGraphics.stroke();
    }

    private updateDistance(): void {
        const extraction = this.map.cellToWorld(this.map.extraction);
        const meters = Math.round(Math.hypot(this.simulation.player.x - extraction.x, this.simulation.player.y - extraction.y) / 4);
        this.distanceLabel.string = `方舟 ${meters}m`;
    }

    private onWorldTouchEnd(event: EventTouch): void {
        if (this.paused || this.fullMapPanel.active) return;
        const location = event.getUILocation();
        const local = this.node.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(location.x, location.y));
        this.simulation.setPlayerDestination({ x: local.x + this.camera.x, y: local.y + this.camera.y });
        this.syncPath();
    }

    private onJoystickStart(event: EventTouch): void {
        if (this.joystickTouchId !== null) return;
        this.joystickTouchId = event.getID();
        this.updateJoystick(event);
    }

    private onJoystickMove(event: EventTouch): void {
        if (event.getID() === this.joystickTouchId) this.updateJoystick(event);
    }

    private onJoystickEnd(event: EventTouch): void {
        if (event.getID() !== this.joystickTouchId) return;
        this.joystickTouchId = null;
        this.joystickVector = { x: 0, y: 0 };
        this.joystickThumb.setPosition(this.joystickCenter.x, this.joystickCenter.y);
        this.refreshMoveInput();
    }

    private updateJoystick(event: EventTouch): void {
        const location = event.getUILocation();
        const local = this.node.getComponent(UITransform)!.convertToNodeSpaceAR(new Vec3(location.x, location.y));
        const rawX = local.x - this.joystickCenter.x;
        const rawY = local.y - this.joystickCenter.y;
        const length = Math.hypot(rawX, rawY);
        const radius = 64;
        const scale = length > radius ? radius / length : 1;
        const x = rawX * scale;
        const y = rawY * scale;
        this.joystickThumb.setPosition(this.joystickCenter.x + x, this.joystickCenter.y + y);
        this.joystickVector = { x: x / radius, y: y / radius };
        this.refreshMoveInput();
    }

    private onKeyDown(event: EventKeyboard): void {
        const alreadyHeld = this.heldKeys.has(event.keyCode);
        this.heldKeys.add(event.keyCode);
        if (event.keyCode === KeyCode.SPACE && !alreadyHeld) this.simulation.tryDodge();
        this.refreshSprint();
        this.refreshMoveInput();
    }

    private onKeyUp(event: EventKeyboard): void {
        this.heldKeys.delete(event.keyCode);
        this.refreshSprint();
        this.refreshMoveInput();
    }

    private onSprintStart(): void {
        this.sprintTouch = true;
        this.refreshSprint();
    }

    private onSprintEnd(): void {
        this.sprintTouch = false;
        this.refreshSprint();
    }

    private refreshSprint(): void {
        this.simulation.setSprinting(this.sprintTouch || this.heldKeys.has(KeyCode.SHIFT_LEFT));
    }

    private refreshMoveInput(): void {
        const left = this.hasAnyKey(KeyCode.KEY_A, KeyCode.ARROW_LEFT) ? 1 : 0;
        const right = this.hasAnyKey(KeyCode.KEY_D, KeyCode.ARROW_RIGHT) ? 1 : 0;
        const down = this.hasAnyKey(KeyCode.KEY_S, KeyCode.ARROW_DOWN) ? 1 : 0;
        const up = this.hasAnyKey(KeyCode.KEY_W, KeyCode.ARROW_UP) ? 1 : 0;
        const keyboardX = right - left;
        const keyboardY = up - down;
        this.simulation.setMoveInput(keyboardX || keyboardY ? keyboardX : this.joystickVector.x, keyboardX || keyboardY ? keyboardY : this.joystickVector.y);
    }

    private hasAnyKey(...keys: KeyCode[]): boolean {
        return keys.some((key) => this.heldKeys.has(key));
    }

    private openFullMap(): void {
        if (this.paused) return;
        this.fullMapPanel.active = true;
        this.setAnimatorsEnabled(false);
        this.syncFullMapObjectLabels();
        this.drawDynamicMap(this.fullMapDynamic, 800, 440, false);
    }

    private closeFullMap(): void {
        this.fullMapPanel.active = false;
        this.setAnimatorsEnabled(true);
    }

    private onGamePaused(): void {
        this.paused = true;
        this.setAnimatorsEnabled(false);
        this.simulation.setMoveInput(0, 0);
        this.simulation.setSprinting(false);
    }

    private onGameResumed(): void {
        this.paused = false;
        this.setAnimatorsEnabled(!this.fullMapPanel?.active);
        this.refreshSprint();
        this.refreshMoveInput();
    }

    private setAnimatorsEnabled(enabled: boolean): void {
        if (this.playerAnimator) this.playerAnimator.enabled = enabled;
        this.enemyAnimators.forEach((animator) => { animator.enabled = enabled; });
    }

    private createNode(parent: Node, name: string, size: Size, position: Vec3): Node {
        const node = new Node(name);
        node.layer = parent.layer;
        node.addComponent(UITransform).setContentSize(size);
        node.setPosition(position);
        parent.addChild(node);
        return node;
    }

    private async openPause(): Promise<void> {
        if (await uiNavigation.openOverlay(UIID.PauseOverlay)) oops.message.dispatchEvent(GameEvent.GamePaused);
    }

    private async requestReturn(): Promise<void> {
        await uiNavigation.openOverlay(UIID.ConfirmDialog, {
            title: "返回方舟",
            message: "本次探索尚未结算，确定返回方舟主界面吗？",
            confirmText: "确认返回",
            cancelText: "继续探索",
            onConfirm: () => { void this.confirmReturn(); },
        });
    }

    private async confirmReturn(): Promise<void> {
        uiNavigation.closeOverlay(UIID.ConfirmDialog);
        uiNavigation.closeOverlay(UIID.PauseOverlay);
        oops.message.dispatchEvent(GameEvent.LeaveBattle);
        await uiNavigation.resetToRoot();
    }
}
