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
import { ActorAction, ActorAnimator } from "./ActorAnimator";
import { cameraTargetFor } from "./BattleCamera";
import { battleControlLayout } from "./BattleHUDLayout";
import { createHospitalDistrictMap, WorldPoint } from "./BattleMapModel";
import { BattleSimulation } from "./BattleSimulation";

const { ccclass } = _decorator;

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
    private enemyNodes: Node[] = [];
    private enemyAnimators: ActorAnimator[] = [];
    private enemyHealthBars: Node[] = [];
    private structureNode!: Node;
    private structureHealthBar!: Node;
    private structureStatusLabel!: Label;
    private lastDodgeCount = 0;
    private pathGraphics!: Graphics;
    private minimapDynamic!: Graphics;
    private fullMapDynamic!: Graphics;
    private fullMapPanel!: Node;
    private distanceLabel!: Label;
    private joystickThumb!: Node;
    private joystickCenter = { x: 0, y: 0 };
    private joystickVector = { x: 0, y: 0 };
    private joystickTouchId: number | null = null;
    private camera = { x: 0, y: 0 };
    private heldKeys = new Set<KeyCode>();
    private sprintTouch = false;
    private paused = false;
    private lastPathSignature = "";

    protected onLoad(): void {
        this.render();
        input.on(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.on(Input.EventType.KEY_UP, this.onKeyUp, this);
        oops.message.on(GameEvent.GamePaused, this.onGamePaused, this);
        oops.message.on(GameEvent.GameResumed, this.onGameResumed, this);
    }

    update(deltaTime: number): void {
        if (this.paused || this.fullMapPanel?.active) return;
        this.simulation.update(deltaTime);
        this.syncActors();
        this.syncVitality();
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
        this.renderObjective(this.frame);
        this.renderFullMap(this.frame);
        this.syncActors();
        this.syncVitality();
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
        const navigationGraphics = navigationOverlay.addComponent(Graphics);
        navigationGraphics.fillColor = new Color(22, 228, 239, 13);
        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.columns; x++) {
                if (!this.map.isWalkable({ x, y })) continue;
                const point = this.map.cellToWorld({ x, y });
                navigationGraphics.rect(point.x - this.map.tileSize / 2, point.y - this.map.tileSize / 2, this.map.tileSize, this.map.tileSize);
            }
        }
        navigationGraphics.fill();

        const pathNode = this.createNode(this.worldLayer, "NavigationPath", new Size(this.map.worldWidth, this.map.worldHeight), Vec3.ZERO);
        this.pathGraphics = pathNode.addComponent(Graphics);
        this.renderWorldActors();
    }

    private renderWorldActors(): void {
        this.playerNode = this.createActor("Player", BattleHUDViewComp.PLAYER_ASSET, 158);
        this.playerAnimator = this.playerNode.getComponent(ActorAnimator);
        const assets = [
            ["Walker", "gui/battle-hud/actors/walker", 112],
            ["Runner", "gui/battle-hud/actors/runner", 118],
            ["Mutant", "gui/battle-hud/actors/walker", 126],
            ["Brute", "gui/battle-hud/actors/brute", 172],
        ] as const;
        this.enemyAnimators = [];
        this.enemyHealthBars = [];
        this.enemyNodes = assets.map(([name, asset, size], index) => {
            const actor = this.createActor(name, asset, size);
            const animator = actor.getComponent(ActorAnimator);
            if (animator) this.enemyAnimators.push(animator);
            this.enemyHealthBars[index] = UIBuilder.progressBar(
                actor,
                `${name}Health`,
                new Size(index === 3 ? 156 : 104, 18),
                new Vec3(0, size * 0.47),
                this.simulation.enemies[index].vitality.healthRatio,
                index === 3 ? UI_THEME.colors.magenta : UI_THEME.colors.danger,
            );
            return actor;
        });
        this.renderBattleStructure();
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
        void UIBuilder.icon(status, "hud-combat/01-health", 46, new Vec3(-163, 54));
        this.playerHealthText = UIBuilder.label(status, "HealthText", "", new Size(170, 32), new Vec3(70, 57), 23, UI_THEME.colors.white, HorizontalTextAlignment.RIGHT);
        this.playerHealthBar = UIBuilder.progressBar(status, "Health", new Size(278, 24), new Vec3(26, 24), 1, UI_THEME.colors.danger);
        this.playerShieldText = UIBuilder.label(status, "ShieldText", "", new Size(220, 24), new Vec3(-18, -12), 15, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
        this.playerShieldBar = UIBuilder.progressBar(status, "Shield", new Size(240, 16), new Vec3(13, -34), 1, UI_THEME.colors.cyan);
        UIBuilder.label(status, "PollutionText", "污染  32 / 100", new Size(220, 24), new Vec3(-18, -60), 15, UI_THEME.colors.magenta, HorizontalTextAlignment.LEFT);
        this.downedLabel = UIBuilder.label(status, "DownedText", "已倒地", new Size(120, 30), new Vec3(120, -60), 19, UI_THEME.colors.danger);
        this.downedLabel.node.active = false;
    }

    private renderDayTimer(frame: SafeFrame): void {
        const timer = UIBuilder.hudPlate(this.node, "DayTimer", "exploration-hud/05-day-timer-frame", new Size(340, 112), new Vec3(0, frame.top - 54));
        void UIBuilder.icon(timer, "hud-combat/05-day-timer", 42, new Vec3(-112, 18));
        UIBuilder.label(timer, "DayTime", "04:26", new Size(130, 42), new Vec3(5, 18), 28, UI_THEME.colors.white);
        UIBuilder.label(timer, "Sunset", "日落警戒", new Size(94, 28), new Vec3(112, 18), 16, UI_THEME.colors.orange);
        UIBuilder.progressBar(timer, "DayProgress", new Size(254, 19), new Vec3(0, -24), 0.63, UI_THEME.colors.orange);
    }

    private renderMinimap(frame: SafeFrame): void {
        const mapPanel = UIBuilder.hudPlate(this.node, "Minimap", "exploration-hud/09-minimap-bezel", new Size(196, 196), new Vec3(frame.right - 104, frame.top - 104));
        const mapCanvas = this.createNode(mapPanel, "MinimapCanvas", new Size(142, 82), new Vec3(-8, 8));
        this.drawStaticMap(mapCanvas.addComponent(Graphics), 142, 82);
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
        this.drawStaticMap(mapCanvas.addComponent(Graphics), 800, 440);
        const dynamicNode = this.createNode(mapCanvas, "FullMapDynamic", new Size(800, 440), Vec3.ZERO);
        this.fullMapDynamic = dynamicNode.addComponent(Graphics);
        for (const point of this.map.pointsOfInterest) {
            const position = this.mapPosition(this.map.cellToWorld(point.cell), 800, 440);
            UIBuilder.label(mapCanvas, `Poi:${point.id}`, point.name, new Size(116, 24), new Vec3(position.x, position.y + 15), 13, UI_THEME.colors.white);
        }
        const close = UIBuilder.button(panel, "BtnCloseFullMap", "关闭地图", new Size(152, 54), new Vec3(365, 260));
        this.bindTouch(close, () => this.closeFullMap());
        this.fullMapPanel.active = false;
    }

    private drawStaticMap(graphics: Graphics, width: number, height: number): void {
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

    private syncActors(): void {
        const simulation = this.simulation;
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
        const disabled = structure.vitality.state === "disabled";
        this.structureStatusLabel.string = disabled
            ? "路障 · 已失效"
            : `路障 ${Math.ceil(structure.vitality.currentHealth)} / ${structure.vitality.maxHealth}`;
        this.structureNode.getComponent(UIOpacity)!.opacity = disabled ? 110 : 255;
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
        this.playerAnimator?.setEnabled(enabled);
        this.enemyAnimators.forEach((animator) => animator.setEnabled(enabled));
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
