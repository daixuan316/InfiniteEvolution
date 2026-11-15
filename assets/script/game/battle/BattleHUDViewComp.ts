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
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    input,
    tween,
    _decorator,
} from "cc";

import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { GameEvent } from "../common/config/GameEvent";
import { UIID } from "../common/config/GameUIConfig";
import { GamePage } from "../common/ui/GamePage";
import { SafeFrame, UIBuilder } from "../common/ui/UIBuilder";
import { BATTLE_HUD_ICON_ASSETS } from "../common/ui/UIIconAssets";
import {
    isLootChestId,
    lootChestAssetPath,
    lootChestEffectPath,
    type LootChestVisualState,
} from "../common/ui/LootChestAssets.ts";
import { uiNavigation } from "../common/ui/UIRuntime";
import type { PageParams } from "../common/ui/UINavigationService.ts";
import { UI_THEME } from "../common/ui/UITheme";
import { findIntelTarget, intelTargetWorldPoint, type IntelTargetDefinition } from "../intel/model/IntelCatalog.ts";
import { IntelTargetTracker } from "../intel/model/IntelTargetTracker.ts";
import { researchRuntime } from "../research/ResearchService";
import { persistWorldDeltas, persistentWorldDeltas } from "../save/InfiniteWorldSave.ts";
import { persistentEquipmentRuntime } from "../save/SaveModule.ts";
import { DayClock, explorationTimeScale, formatDayTime, type DayPressure } from "../world/model/DayClock";
import { DayPhaseFlow } from "../world/model/DayPhaseFlow";
import { chunkCoordinateToWorldOrigin } from "../world/infinite/ChunkStreamingModel.ts";
import type { InfiniteChunkDefinition } from "../world/infinite/InfiniteChunkGenerator.ts";
import { CHUNK_COLUMNS, CHUNK_ROWS, CHUNK_WORLD_HEIGHT, CHUNK_WORLD_WIDTH } from "../world/infinite/InfiniteWorldTypes.ts";
import { parseChunkKey } from "../world/infinite/WorldSeed.ts";
import { ActorAction, ActorAnimator } from "./ActorAnimator";
import { PLAYER_PRESENTATION_SIZE, enemyActorPresentation } from "./BattleActorPresentation.ts";
import { cameraTargetFor } from "./BattleCamera";
import { reconcileBudgetedEntries, type BudgetedAcquisition } from "./BudgetedPoolReconciler.ts";
import { battleControlLayout, playerStatusLayout } from "./BattleHUDLayout";
import type { WorldPoint } from "./BattleMapModel";
import { BattleSimulation, type EnemyAgent, type EnemyKind } from "./BattleSimulation";
import { syncDayTimerView } from "./DayTimerViewState.ts";
import { createInfiniteExplorationMap } from "./InfiniteBattleMap.ts";
import { districtPresentation, type RgbaTuple } from "./InfiniteDistrictPresentation.ts";
import { createDiscoveredMapProjection, localMapPosition } from "./InfiniteMapProjection.ts";
import {
    LOOT_CHEST_OPENING_SECONDS,
    advanceLootChestOpening,
    lootChestEffectProfile,
    lootChestVisualState,
} from "./LootChestPresentation.ts";

const { ccclass } = _decorator;

const DAY_DURATION_SECONDS = 8 * 60;
const DAY_WARNING_SECONDS = 2 * 60;
const DAY_NIGHT_SECONDS = 0;
const DAY_HUNT_SECONDS = -60;
const WORLD_SEED = 1907;
const DAY_PRESSURE_PRESENTATION: Readonly<Record<DayPressure, { readonly text: string; readonly color: Color }>> = {
    safe: { text: "安全探索", color: UI_THEME.colors.cyan },
    warning: { text: "日落警戒", color: UI_THEME.colors.orange },
    night: { text: "夜幕降临", color: UI_THEME.colors.danger },
    hunt: { text: "尸群追猎", color: UI_THEME.colors.magenta },
};
const CHUNK_TEXTURES: Readonly<Record<InfiniteChunkDefinition["backgroundId"], string>> = {
    "residential-district-a": "gui/battle-hud/texture/residential-district-a",
    "residential-district-b": "gui/battle-hud/texture/residential-district-b",
    "neighborhood-commercial-a": "gui/battle-hud/texture/neighborhood-commercial-a",
    "hospital-district": "gui/battle-hud/texture/hospital-district",
};
const LOCAL_MAP_RADIUS = CHUNK_WORLD_WIDTH * 2.5;

interface DamageFeedback {
    readonly node: Node;
    readonly opacity: UIOpacity;
    readonly startX: number;
    readonly startY: number;
    readonly duration: number;
    elapsed: number;
}

interface EnemyNodeEntry {
    readonly id: string;
    readonly kind: EnemyKind;
    readonly node: Node;
    readonly animator: ActorAnimator;
    readonly healthBar: Node;
}

type PooledEnemyNode = Pick<EnemyNodeEntry, "node" | "animator" | "healthBar">;

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

    private readonly worldDeltas = persistentWorldDeltas(WORLD_SEED);
    private readonly map = createInfiniteExplorationMap({ worldSeed: WORLD_SEED, deltas: this.worldDeltas });
    private readonly equipmentRuntime = persistentEquipmentRuntime();
    private readonly equipmentBattleId = `exploration-${Date.now()}`;
    private target: IntelTargetDefinition = this.resolveInfiniteTarget(findIntelTarget("hospital")!);
    private targetTracker = new IntelTargetTracker(this.target, this.map);
    private readonly simulation = new BattleSimulation(this.map, {
        playerModifiers: researchRuntime.modifiers(Date.now()),
        equipmentSnapshot: this.equipmentRuntime.combatSnapshot(),
        playerPosition: this.worldDeltas.playerPosition() ?? undefined,
    });
    private frame!: SafeFrame;
    private worldLayer!: Node;
    private readonly chunkNodes = new Map<string, Node>();
    private readonly chunkBackgroundIds = new Map<string, InfiniteChunkDefinition["backgroundId"]>();
    private readonly chunkNodePools = new Map<InfiniteChunkDefinition["backgroundId"], Node[]>();
    private worldTouchLayer!: Node;
    private playerNode!: Node;
    private playerAnimator: ActorAnimator | null = null;
    private playerHealthText!: Label;
    private playerShieldText!: Label;
    private playerPollutionText!: Label;
    private playerHealthBar!: Node;
    private playerShieldBar!: Node;
    private downedLabel!: Label;
    private weaponNameLabel!: Label;
    private weaponAmmoLabel!: Label;
    private weaponStateLabel!: Label;
    private weaponHeatBar!: Node;
    private equipmentSettled = false;
    private readonly dayClock = new DayClock(DAY_DURATION_SECONDS, DAY_WARNING_SECONDS, DAY_NIGHT_SECONDS, DAY_HUNT_SECONDS);
    private readonly dayPhaseFlow = new DayPhaseFlow();
    private dayTimeLabel: Label | null = null;
    private dayPressureLabel: Label | null = null;
    private dayProgressBar: Node | null = null;
    private enemyNodeEntries: Array<EnemyNodeEntry | null> = [];
    private structureNode: Node | null = null;
    private structureHealthBar: Node | null = null;
    private structureStatusLabel: Label | null = null;
    private readonly lootNodes = new Map<string, Node>();
    private readonly explorationNodes = new Map<string, Node>();
    private readonly lootNodePool: Node[] = [];
    private readonly lootOpeningRemaining = new Map<string, number>();
    private readonly lootVisualState = new Map<string, LootChestVisualState>();
    private readonly lootEffectNodes = new Map<string, Node>();
    private readonly explorationNodePool: Node[] = [];
    private readonly enemyNodePools = new Map<EnemyKind, PooledEnemyNode[]>();
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
    private fullMapCanvas!: Node;
    private distanceLabel!: Label;
    private objectiveLabel!: Label;
    private interactionPanel!: Node;
    private interactionNameLabel!: Label;
    private interactionDistanceLabel!: Label;
    private interactionActionLabel!: Label;
    private interactionLootIcon!: Node;
    private interactionIconTypeId: string | null = null;
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
    private returningToShelter = false;
    private barrierWasActive = true;
    private lastWorldRevision = -1;
    private lastMinimapCenterCell = "";
    private worldSaveElapsed = 0;
    private fullMapProjector: ((point: WorldPoint) => WorldPoint) | null = null;

    configure(params: PageParams): void {
        super.configure(params);
        this.target = this.resolveInfiniteTarget(findIntelTarget(this.params.targetId) ?? findIntelTarget("hospital")!);
        this.targetTracker = new IntelTargetTracker(this.target, this.map);
        this.applyIntelTargetPresentation();
    }

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
        if (this.paused || fullMapOpen) return;
        this.simulation.update(deltaTime);
        this.updateLootOpenings(deltaTime);
        this.worldSaveElapsed += Math.max(0, deltaTime);
        if (this.worldSaveElapsed >= 2) {
            this.worldSaveElapsed = 0;
            this.persistWorldState();
        }
        this.refreshStreamedWorldPresentation();
        this.refreshChunkViews();
        this.renderExplorationObjects(4);
        this.syncDayTimer();
        this.syncActors();
        this.syncVitality();
        this.syncWeaponStatus();
        this.syncProjectiles();
        this.syncExplorationObjects();
        this.syncInteractionPanel();
        this.consumeNoticeEvents();
        this.updateNotice(deltaTime);
        this.consumeHitEvents();
        this.updateCombatFeedback(deltaTime);
        this.updateCamera(deltaTime);
        this.syncPath();
        this.refreshMinimapStatic();
        this.drawDynamicMap(this.minimapDynamic, 142, 82, true);
        this.syncIntelTarget();
    }

    protected onDestroy(): void {
        input.off(Input.EventType.KEY_DOWN, this.onKeyDown, this);
        input.off(Input.EventType.KEY_UP, this.onKeyUp, this);
        oops.message.off(GameEvent.GamePaused, this.onGamePaused, this);
        oops.message.off(GameEvent.GameResumed, this.onGameResumed, this);
        this.worldTouchLayer?.off(Node.EventType.TOUCH_END, this.onWorldTouchEnd, this);
        this.persistWorldState();
        this.settleEquipmentMemory();
        for (const id of [...this.lootEffectNodes.keys()]) this.clearLootEffect(id);
        this.lootOpeningRemaining.clear();
        this.lootVisualState.clear();
        super.onDestroy();
    }

    private render(): void {
        this.frame = UIBuilder.prepareRoot(this.node);
        this.renderWorld();
        this.renderWorldTouchLayer();
        this.renderPlayerStatus(this.frame);
        this.renderWeaponStatus(this.frame);
        this.renderDayTimer(this.frame);
        this.renderMinimap(this.frame);
        this.renderTouchControls(this.frame);
        this.renderInteractionPanel(this.frame);
        this.renderNotice(this.frame);
        this.renderObjective(this.frame);
        this.renderFullMap(this.frame);
        this.syncActors();
        this.syncVitality();
        this.syncWeaponStatus();
        this.syncProjectiles();
        this.syncExplorationObjects();
        this.syncInteractionPanel();
        this.updateCamera(1);
        this.drawDynamicMap(this.minimapDynamic, 142, 82, true);
        this.lastWorldRevision = this.simulation.worldRevision;
    }

    private renderWorld(): void {
        this.worldLayer = this.createNode(this.node, "WorldLayer", new Size(this.map.worldWidth, this.map.worldHeight), Vec3.ZERO);
        this.refreshChunkViews();

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
        this.navigationGraphics.fillColor = new Color(104, 180, 168, 13);
        if (this.map.infinite) {
            for (const chunk of this.map.activeChunks ?? []) {
                for (const road of chunk.roadCells) {
                    const point = this.renderPoint(this.map.cellToWorld({
                        x: chunk.coordinate.x * CHUNK_COLUMNS + road.x,
                        y: chunk.coordinate.y * CHUNK_ROWS + road.y,
                    }));
                    this.navigationGraphics.rect(point.x - this.map.tileSize / 2, point.y - this.map.tileSize / 2, this.map.tileSize, this.map.tileSize);
                }
            }
            this.navigationGraphics.fill();
            return;
        }
        for (let y = 0; y < this.map.rows; y++) {
            for (let x = 0; x < this.map.columns; x++) {
                if (!this.map.isWalkable({ x, y })) continue;
                const point = this.renderPoint(this.map.cellToWorld({ x, y }));
                this.navigationGraphics.rect(point.x - this.map.tileSize / 2, point.y - this.map.tileSize / 2, this.map.tileSize, this.map.tileSize);
            }
        }
        this.navigationGraphics.fill();
    }

    private renderExplorationObjects(maxCreates = 6): void {
        let created = 0;
        for (const loot of this.simulation.loot) {
            const existing = this.lootNodes.get(loot.id);
            if (existing) {
                const position = this.renderPoint(loot);
                existing.setPosition(position.x, position.y);
                this.syncLootVisual(loot.id, loot.typeId, loot.opened, existing);
                continue;
            }
            if (created >= maxCreates) continue;
            const position = this.renderPoint(loot);
            let node = this.lootNodePool.pop();
            if (node) {
                node.name = `Loot:${loot.id}`;
                node.active = true;
                const label = node.children.find((child) => child.getComponent(Label))?.getComponent(Label);
                if (label) label.string = loot.name;
            } else {
                node = this.createNode(this.worldLayer, `Loot:${loot.id}`, new Size(120, 100), new Vec3(position.x, position.y));
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
            }
            node.setPosition(position.x, position.y);
            node.active = loot.discovered;
            this.lootNodes.set(loot.id, node);
            this.syncLootVisual(loot.id, loot.typeId, loot.opened, node);
            created++;
        }

        for (const point of this.simulation.explorationPoints) {
            const existing = this.explorationNodes.get(point.id);
            if (existing) {
                const position = this.renderPoint(point);
                existing.setPosition(position.x, position.y);
                continue;
            }
            if (created >= maxCreates) continue;
            const position = this.renderPoint(point);
            let node = this.explorationNodePool.pop();
            if (node) {
                node.name = `Explore:${point.id}`;
                node.active = true;
                const label = node.children.find((child) => child.getComponent(Label))?.getComponent(Label);
                if (label) label.string = point.name;
            } else {
                node = this.createNode(this.worldLayer, `Explore:${point.id}`, new Size(116, 116), new Vec3(position.x, position.y));
                const opacity = node.addComponent(UIOpacity);
                opacity.opacity = 255;
                const graphics = node.addComponent(Graphics);
                graphics.fillColor = new Color(30, 33, 30, 235);
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
            }
            node.setPosition(position.x, position.y);
            this.explorationNodes.set(point.id, node);
            created++;
        }
    }

    private renderWorldActors(): void {
        this.playerNode = this.createActor("Player", BattleHUDViewComp.PLAYER_ASSET, PLAYER_PRESENTATION_SIZE);
        this.playerAnimator = this.playerNode.getComponent(ActorAnimator);
        this.enemyNodeEntries = [];
        this.renderBattleStructure();
    }

    private ensureEnemyNodes(maxCreates = 2): void {
        let created = 0;
        this.enemyNodeEntries.length = this.simulation.enemies.length;
        for (let index = 0; index < this.simulation.enemies.length; index++) {
            const enemy = this.simulation.enemies[index];
            const current = this.enemyNodeEntries[index];
            if (current?.id === enemy.id) continue;
            if (current) this.releaseEnemyNode(current);
            const acquired = this.acquireEnemyNode(enemy, created < Math.max(0, Math.floor(maxCreates)));
            if (!acquired) {
                this.enemyNodeEntries[index] = null;
                continue;
            }
            this.enemyNodeEntries[index] = acquired.value;
            if (acquired.created) created++;
        }
    }

    private acquireEnemyNode(enemy: EnemyAgent, allowCreate: boolean): BudgetedAcquisition<EnemyNodeEntry> | null {
        const pool = this.enemyNodePools.get(enemy.kind);
        const reused = pool?.pop();
        if (reused) {
            reused.node.name = `${enemyActorPresentation(enemy.kind).name}:${enemy.id}`;
            reused.node.active = true;
            (reused.node.getComponent(UIOpacity) ?? reused.node.addComponent(UIOpacity)).opacity = 255;
            return { value: { id: enemy.id, kind: enemy.kind, ...reused }, created: false };
        }
        if (!allowCreate) return null;
        const presentation = enemyActorPresentation(enemy.kind);
        const actor = this.createActor(`${presentation.name}:${enemy.id}`, presentation.asset, presentation.size);
        return {
            created: true,
            value: {
                id: enemy.id,
                kind: enemy.kind,
                node: actor,
                animator: actor.getComponent(ActorAnimator)!,
                healthBar: UIBuilder.progressBar(
                    actor,
                    `${presentation.name}Health:${enemy.id}`,
                    new Size(presentation.healthBarWidth, 14),
                    new Vec3(0, presentation.size * 0.47),
                    enemy.vitality.healthRatio,
                    enemy.kind === "brute" ? UI_THEME.colors.magenta : UI_THEME.colors.danger,
                ),
            },
        };
    }

    private releaseEnemyNode(entry: EnemyNodeEntry): void {
        entry.node.active = false;
        const pool = this.enemyNodePools.get(entry.kind) ?? [];
        pool.push({ node: entry.node, animator: entry.animator, healthBar: entry.healthBar });
        this.enemyNodePools.set(entry.kind, pool);
    }

    private reconcileEnemyNodes(): void {
        const previous = new Map<string, EnemyNodeEntry>();
        for (const entry of this.enemyNodeEntries) if (entry) previous.set(entry.id, entry);
        const enemies = this.simulation.enemies;
        this.enemyNodeEntries = reconcileBudgetedEntries(
            previous,
            enemies.map((enemy) => enemy.id),
            (entry) => this.releaseEnemyNode(entry),
            (index, allowCreate) => this.acquireEnemyNode(enemies[index], allowCreate),
            0,
        );
    }

    private renderBattleStructure(): void {
        const structure = this.simulation.structures[0];
        if (!structure) return;
        const position = this.renderPoint(structure);
        this.structureNode = this.createNode(this.worldLayer, "Barricade", new Size(154, 116), new Vec3(position.x, position.y));
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

    private refreshChunkViews(maxCreates = 6): void {
        const desired = new Set((this.map.preloadedChunks ?? []).map((chunk) => chunk.key));
        for (const [key, node] of this.chunkNodes) {
            if (desired.has(key)) continue;
            node.active = false;
            const backgroundId = this.chunkBackgroundIds.get(key);
            if (backgroundId) {
                const pool = this.chunkNodePools.get(backgroundId) ?? [];
                pool.push(node);
                this.chunkNodePools.set(backgroundId, pool);
            } else {
                node.destroy();
            }
            this.chunkNodes.delete(key);
            this.chunkBackgroundIds.delete(key);
        }
        let created = 0;
        for (const chunk of this.map.preloadedChunks ?? []) {
            const permanentOrigin = chunkCoordinateToWorldOrigin(chunk.coordinate);
            const center = this.renderPoint({
                x: permanentOrigin.x + CHUNK_WORLD_WIDTH / 2,
                y: permanentOrigin.y + CHUNK_WORLD_HEIGHT / 2,
            });
            let node = this.chunkNodes.get(chunk.key);
            if (!node) {
                if (created >= maxCreates) continue;
                const pool = this.chunkNodePools.get(chunk.backgroundId);
                node = pool?.pop();
                if (node) {
                    node.name = `Chunk:${chunk.key}`;
                    node.active = true;
                    node.setPosition(center.x, center.y);
                } else {
                    node = this.createNode(
                        this.worldLayer,
                        `Chunk:${chunk.key}`,
                        new Size(CHUNK_WORLD_WIDTH + 2, CHUNK_WORLD_HEIGHT + 2),
                        new Vec3(center.x, center.y),
                    );
                    void UIBuilder.sprite(
                        node,
                        CHUNK_TEXTURES[chunk.backgroundId],
                        new Size(CHUNK_WORLD_WIDTH + 2, CHUNK_WORLD_HEIGHT + 2),
                        Vec3.ZERO,
                        false,
                        Color.WHITE,
                    );
                }
                this.refreshDistrictPresentation(node, chunk);
                this.refreshRoadClosures(node, chunk);
                this.chunkNodes.set(chunk.key, node);
                this.chunkBackgroundIds.set(chunk.key, chunk.backgroundId);
                created++;
            } else {
                node.setPosition(center.x, center.y);
            }
            node.setSiblingIndex(0);
        }
    }

    private refreshRoadClosures(node: Node, chunk: InfiniteChunkDefinition): void {
        for (const name of ["RoadClosureNorth", "RoadClosureSouth", "RoadClosureEast", "RoadClosureWest"]) node.getChildByName(name)?.destroy();
        if (!chunk.roads.north) this.createRoadClosure(node, "RoadClosureNorth", 0, CHUNK_WORLD_HEIGHT / 2 - 18, 0, CHUNK_WORLD_WIDTH);
        if (!chunk.roads.south) this.createRoadClosure(node, "RoadClosureSouth", 0, -CHUNK_WORLD_HEIGHT / 2 + 18, 0, CHUNK_WORLD_WIDTH);
        if (!chunk.roads.east) this.createRoadClosure(node, "RoadClosureEast", CHUNK_WORLD_WIDTH / 2 - 18, 0, 90, CHUNK_WORLD_HEIGHT);
        if (!chunk.roads.west) this.createRoadClosure(node, "RoadClosureWest", -CHUNK_WORLD_WIDTH / 2 + 18, 0, 90, CHUNK_WORLD_HEIGHT);
    }

    private createRoadClosure(parent: Node, name: string, x: number, y: number, rotation: number, length: number): void {
        const node = this.createNode(parent, name, new Size(length, 58), new Vec3(x, y));
        node.setRotationFromEuler(0, 0, rotation);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = new Color(28, 34, 37, 248);
        graphics.rect(-length / 2, -29, length, 58);
        graphics.fill();
        graphics.lineWidth = 9;
        graphics.strokeColor = UI_THEME.colors.orange;
        for (let stripeX = -length / 2 + 22; stripeX <= length / 2 - 22; stripeX += 46) {
            graphics.moveTo(stripeX - 18, -22);
            graphics.lineTo(stripeX + 18, 22);
        }
        graphics.stroke();
    }

    private refreshDistrictPresentation(parent: Node, chunk: InfiniteChunkDefinition): void {
        const presentation = districtPresentation(chunk.district, chunk.landmarks.some((landmark) => landmark.kind === "hospital"));
        let overlay = parent.getChildByName("DistrictOverlay");
        if (!overlay) overlay = this.createNode(parent, "DistrictOverlay", new Size(CHUNK_WORLD_WIDTH, CHUNK_WORLD_HEIGHT), Vec3.ZERO);
        const graphics = overlay.getComponent(Graphics) ?? overlay.addComponent(Graphics);
        graphics.clear();
        graphics.fillColor = this.rgbaColor(presentation.tint);
        graphics.rect(-CHUNK_WORLD_WIDTH / 2, -CHUNK_WORLD_HEIGHT / 2, CHUNK_WORLD_WIDTH, CHUNK_WORLD_HEIGHT);
        graphics.fill();
        graphics.lineWidth = 8;
        graphics.strokeColor = this.rgbaColor(presentation.accent);
        graphics.rect(-CHUNK_WORLD_WIDTH / 2 + 5, -CHUNK_WORLD_HEIGHT / 2 + 5, CHUNK_WORLD_WIDTH - 10, CHUNK_WORLD_HEIGHT - 10);
        graphics.stroke();

        let plate = overlay.getChildByName("DistrictLabelPlate");
        if (!plate) {
            plate = this.createNode(
                overlay,
                "DistrictLabelPlate",
                new Size(224, 52),
                new Vec3(-CHUNK_WORLD_WIDTH / 2 + 126, CHUNK_WORLD_HEIGHT / 2 - 42),
            );
            plate.addComponent(UIOpacity).opacity = 232;
        }
        const plateGraphics = plate.getComponent(Graphics) ?? plate.addComponent(Graphics);
        plateGraphics.clear();
        plateGraphics.fillColor = new Color(18, 20, 18, 230);
        plateGraphics.roundRect(-112, -26, 224, 52, 8);
        plateGraphics.fill();
        plateGraphics.lineWidth = 4;
        plateGraphics.strokeColor = this.rgbaColor(presentation.accent);
        plateGraphics.roundRect(-112, -26, 224, 52, 8);
        plateGraphics.stroke();

        let label = plate.getChildByName("DistrictLabel")?.getComponent(Label) ?? null;
        if (!label) label = UIBuilder.label(plate, "DistrictLabel", presentation.label, new Size(190, 32), Vec3.ZERO, 19, this.rgbaColor(presentation.accent));
        label.string = presentation.label;
        label.color = this.rgbaColor(presentation.accent);
        overlay.setSiblingIndex(parent.children.length - 1);
    }

    private rgbaColor(tuple: RgbaTuple): Color {
        return new Color(tuple[0], tuple[1], tuple[2], tuple[3]);
    }

    private refreshStreamedWorldPresentation(): void {
        if (this.lastWorldRevision === this.simulation.worldRevision) return;
        this.lastWorldRevision = this.simulation.worldRevision;
        this.persistWorldState();
        this.fullMapProjector = null;
        this.redrawNavigationOverlay();

        const lootIds = new Set(this.simulation.loot.map((item) => item.id));
        const explorationIds = new Set(this.simulation.explorationPoints.map((item) => item.id));
        for (const [id, node] of this.lootNodes) {
            if (lootIds.has(id)) continue;
            node.active = false;
            this.lootNodePool.push(node);
            this.lootNodes.delete(id);
        }
        for (const [id, node] of this.explorationNodes) {
            if (explorationIds.has(id)) continue;
            node.active = false;
            this.explorationNodePool.push(node);
            this.explorationNodes.delete(id);
        }
        this.reconcileEnemyNodes();

        this.lastPathSignature = "";
        this.refreshMinimapStatic(true);
        if (this.fullMapStatic) this.drawStaticMap(this.fullMapStatic, 800, 440);
        if (this.fullMapCanvas) this.refreshFullMapLabels();
    }

    private renderPoint(point: WorldPoint): WorldPoint {
        const origin = this.map.renderOrigin ?? { x: 0, y: 0 };
        return { x: point.x - origin.x, y: point.y - origin.y };
    }

    private persistWorldState(): void {
        this.worldDeltas.setPlayerPosition(this.simulation.player);
        persistWorldDeltas(this.worldDeltas);
    }

    private resolveInfiniteTarget(target: IntelTargetDefinition): IntelTargetDefinition {
        if (target.id !== "hospital") return target;
        for (let radius = 0; radius <= 16; radius++) {
            for (let y = -radius; y <= radius; y++) {
                for (let x = -radius; x <= radius; x++) {
                    if (Math.max(Math.abs(x), Math.abs(y)) !== radius) continue;
                    const chunk = this.map.getChunkAt({ x, y });
                    if (!chunk.landmarks.some((landmark) => landmark.kind === "hospital")) continue;
                    return {
                        ...target,
                        cell: {
                            x: x * CHUNK_COLUMNS + Math.floor(CHUNK_COLUMNS / 2),
                            y: y * CHUNK_ROWS + 3,
                        },
                    };
                }
            }
        }
        return target;
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
        void UIBuilder.icon(status, BATTLE_HUD_ICON_ASSETS.health, 46, new Vec3(-163, 54));
        this.playerHealthBar = UIBuilder.progressBar(status, "Health", new Size(layout.healthBar.width, layout.healthBar.height), new Vec3(layout.healthBar.centerX, layout.healthBar.centerY), 1, UI_THEME.colors.danger);
        this.playerHealthText = UIBuilder.label(status, "HealthText", "", new Size(layout.healthText.width, layout.healthText.height), new Vec3(layout.healthText.centerX, layout.healthText.centerY), 19, UI_THEME.colors.white, HorizontalTextAlignment.RIGHT);
        this.playerShieldBar = UIBuilder.progressBar(status, "Shield", new Size(layout.shieldBar.width, layout.shieldBar.height), new Vec3(layout.shieldBar.centerX, layout.shieldBar.centerY), 1, UI_THEME.colors.cyan);
        void UIBuilder.icon(status, BATTLE_HUD_ICON_ASSETS.shield, 28, new Vec3(-145, layout.shieldText.centerY));
        this.playerShieldText = UIBuilder.label(status, "ShieldText", "", new Size(layout.shieldText.width, layout.shieldText.height), new Vec3(layout.shieldText.centerX, layout.shieldText.centerY), 15, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
        void UIBuilder.icon(status, BATTLE_HUD_ICON_ASSETS.pollution, 26, new Vec3(-145, layout.pollutionText.centerY));
        this.playerPollutionText = UIBuilder.label(status, "PollutionText", "", new Size(layout.pollutionText.width, layout.pollutionText.height), new Vec3(layout.pollutionText.centerX, layout.pollutionText.centerY), 15, UI_THEME.colors.magenta, HorizontalTextAlignment.LEFT);
        this.downedLabel = UIBuilder.label(status, "DownedText", "已倒地", new Size(layout.downedText.width, layout.downedText.height), new Vec3(layout.downedText.centerX, layout.downedText.centerY), 19, UI_THEME.colors.danger);
        this.downedLabel.node.active = false;
    }

    private renderWeaponStatus(frame: SafeFrame): void {
        const panel = UIBuilder.surface(this.node, "WeaponStatus", new Size(390, 104), new Vec3(frame.left + 195, frame.top - 222), "card");
        this.weaponNameLabel = UIBuilder.label(panel, "WeaponName", "", new Size(210, 30), new Vec3(-72, 30), 18, UI_THEME.colors.white, HorizontalTextAlignment.LEFT);
        this.weaponAmmoLabel = UIBuilder.label(panel, "WeaponAmmo", "", new Size(150, 30), new Vec3(-102, -2), 17, UI_THEME.colors.cyan, HorizontalTextAlignment.LEFT);
        this.weaponStateLabel = UIBuilder.label(panel, "WeaponState", "", new Size(145, 28), new Vec3(-104, -32), 15, UI_THEME.colors.orange, HorizontalTextAlignment.LEFT);
        this.weaponHeatBar = UIBuilder.progressBar(panel, "WeaponHeat", new Size(150, 14), new Vec3(20, -32), 0, UI_THEME.colors.orange);
        const swap = UIBuilder.navButton(panel, "BtnWeaponSwap", "换枪", "system-nav/06-storage", new Size(112, 78), new Vec3(132, 4), true);
        this.bindTouch(swap, () => {
            this.simulation.switchWeapon();
            this.syncWeaponStatus();
        });
        this.syncWeaponStatus();
    }

    private syncWeaponStatus(): void {
        if (!this.weaponNameLabel) return;
        const status = this.simulation.weaponStatus;
        this.weaponNameLabel.string = status.name;
        this.weaponAmmoLabel.string = `弹匣 ${status.magazine} / ${status.magazineSize}`;
        this.weaponStateLabel.string = status.overheated ? "过热冷却" : status.reloadRemaining > 0 ? `换弹 ${status.reloadRemaining.toFixed(1)}s` : "武器就绪";
        UIBuilder.setProgressBarRatio(this.weaponHeatBar, status.heatCapacity > 0 ? status.heat / status.heatCapacity : 0);
    }

    private settleEquipmentMemory(): void {
        if (this.equipmentSettled) return;
        this.equipmentSettled = true;
        const deltas = this.simulation.drainEquipmentMemoryDeltas();
        if (deltas.length === 0) return;
        const result = this.equipmentRuntime.recordBattleMemory(this.equipmentBattleId, deltas);
        if (result.ok === false) console.error("Equipment memory settlement failed", result.error);
    }

    private renderDayTimer(frame: SafeFrame): void {
        const timer = UIBuilder.hudPlate(this.node, "DayTimer", "exploration-hud/05-day-timer-frame", new Size(340, 112), new Vec3(0, frame.top - 54));
        void UIBuilder.icon(timer, BATTLE_HUD_ICON_ASSETS.dayTimer, 42, new Vec3(-112, 18));
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
        this.syncDayTimer();

        if (Math.ceil(this.dayClock.remaining) !== previousSecond) {
            oops.message.dispatchEvent(GameEvent.DayTimeChanged, this.dayClock.remaining);
        }
        if (this.dayClock.pressure !== previousPressure) {
            oops.message.dispatchEvent(GameEvent.DayPressureChanged, this.dayClock.pressure);
        }
        if (this.dayPhaseFlow.update(this.dayClock.pressure) === "return-to-shelter") {
            void this.enterNightDefense();
        }
    }

    private syncDayTimer(): void {
        const presentation = DAY_PRESSURE_PRESENTATION[this.dayClock.pressure];
        syncDayTimerView(
            {
                timeLabel: this.dayTimeLabel,
                pressureLabel: this.dayPressureLabel,
                progressBar: this.dayProgressBar,
            },
            {
                timeText: formatDayTime(this.dayClock.remaining),
                pressureText: presentation.text,
                remainingRatio: this.dayClock.remainingRatio,
                color: presentation.color,
            },
            UIBuilder.setProgressBarRatio,
        );
    }

    private async enterNightDefense(): Promise<void> {
        if (this.returningToShelter) return;
        this.returningToShelter = true;
        oops.message.dispatchEvent(GameEvent.DayReturned);
        const entered = await uiNavigation.replace(UIID.NightDefense, { night: 1 });
        if (entered) oops.message.dispatchEvent(GameEvent.NightDefenseStarted, 1);
        else this.returningToShelter = false;
    }

    private renderMinimap(frame: SafeFrame): void {
        const mapPanel = UIBuilder.hudPlate(this.node, "Minimap", "exploration-hud/09-minimap-bezel", new Size(196, 196), new Vec3(frame.right - 104, frame.top - 104));
        void UIBuilder.icon(mapPanel, BATTLE_HUD_ICON_ASSETS.minimap, 32, new Vec3(-72, 68));
        const mapCanvas = this.createNode(mapPanel, "MinimapCanvas", new Size(142, 82), new Vec3(-8, 8));
        this.minimapStatic = mapCanvas.addComponent(Graphics);
        this.drawStaticMap(this.minimapStatic, 142, 82);
        const dynamicNode = this.createNode(mapCanvas, "MinimapDynamic", new Size(142, 82), Vec3.ZERO);
        this.minimapDynamic = dynamicNode.addComponent(Graphics);
        const mapButton = this.createNode(mapPanel, "BtnOpenFullMap", new Size(142, 82), new Vec3(-8, 8));
        this.bindTouch(mapButton, () => this.openFullMap());
        this.distanceLabel = UIBuilder.label(mapPanel, "Distance", "方舟 0m", new Size(142, 28), new Vec3(-8, -56), 16, UI_THEME.colors.orange);

        const pause = UIBuilder.surface(mapPanel, "BtnPause", new Size(76, 66), new Vec3(58, 65), "secondary");
        void UIBuilder.icon(pause, BATTLE_HUD_ICON_ASSETS.pause, 44, Vec3.ZERO);
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
        void UIBuilder.icon(action, BATTLE_HUD_ICON_ASSETS.sprint, 84, Vec3.ZERO);
        action.on(Node.EventType.TOUCH_START, this.onSprintStart, this);
        action.on(Node.EventType.TOUCH_END, this.onSprintEnd, this);
        action.on(Node.EventType.TOUCH_CANCEL, this.onSprintEnd, this);
        const dodgeRect = controls.dodgeAction;
        const dodge = UIBuilder.hudPlate(this.node, "DodgeAction", "touch-tutorial/04-action-button-medium", new Size(dodgeRect.width, dodgeRect.height), new Vec3(dodgeRect.centerX, dodgeRect.centerY));
        void UIBuilder.icon(dodge, BATTLE_HUD_ICON_ASSETS.dodge, 62, Vec3.ZERO);
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
        this.persistWorldState();
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
        void UIBuilder.icon(objective, BATTLE_HUD_ICON_ASSETS.objective, 42, new Vec3(-248, 0));
        this.objectiveLabel = UIBuilder.label(objective, "Objective", this.intelObjectiveText(), new Size(486, 38), new Vec3(24, 0), 17, UI_THEME.colors.white);
        const returnRect = battleControlLayout(frame).returnArk;
        const returnArk = UIBuilder.surface(this.node, "BtnReturnArk", new Size(returnRect.width, returnRect.height), new Vec3(returnRect.centerX, returnRect.centerY), "primary");
        void UIBuilder.icon(returnArk, BATTLE_HUD_ICON_ASSETS.returnArk, 48, Vec3.ZERO);
        this.bindTouch(returnArk, () => { void this.requestReturn(); });
    }

    private renderFullMap(frame: SafeFrame): void {
        this.fullMapPanel = UIBuilder.panel(this.node, "FullMapOverlay", new Size(frame.width + 8, frame.height + 8), Vec3.ZERO, new Color(10, 11, 10, 230), UI_THEME.colors.cyanDark);
        this.fullMapPanel.addComponent(BlockInputEvents);
        const panel = UIBuilder.surface(this.fullMapPanel, "FullMapPanel", new Size(930, 610), Vec3.ZERO, "large");
        UIBuilder.label(panel, "FullMapTitle", "灰港废城 · 已探索区域", new Size(620, 48), new Vec3(0, 264), 28, UI_THEME.colors.white);
        UIBuilder.label(panel, "FullMapHint", "青色：已探索道路/地标   暗区：战争迷雾   橙色：当前路线   红色：感染体", new Size(760, 28), new Vec3(0, 225), 15, UI_THEME.colors.muted);
        const mapCanvas = this.createNode(panel, "FullMapCanvas", new Size(800, 440), new Vec3(0, -20));
        this.fullMapCanvas = mapCanvas;
        this.fullMapStatic = mapCanvas.addComponent(Graphics);
        this.drawStaticMap(this.fullMapStatic, 800, 440);
        const dynamicNode = this.createNode(mapCanvas, "FullMapDynamic", new Size(800, 440), Vec3.ZERO);
        this.fullMapDynamic = dynamicNode.addComponent(Graphics);
        this.refreshFullMapLabels();
        this.syncFullMapObjectLabels();
        const close = UIBuilder.button(panel, "BtnCloseFullMap", "关闭地图", new Size(152, 54), new Vec3(365, 260));
        this.bindTouch(close, () => this.closeFullMap());
        this.fullMapPanel.active = false;
    }

    private drawStaticMap(graphics: Graphics, width: number, height: number): void {
        graphics.clear();
        graphics.fillColor = new Color(12, 14, 13, 245);
        graphics.rect(-width / 2, -height / 2, width, height);
        graphics.fill();
        const projectedOrigin = this.mapPosition({ x: 0, y: 0 }, width, height);
        const projectedCell = this.mapPosition({ x: this.map.tileSize, y: this.map.tileSize }, width, height);
        const cellWidth = this.map.infinite ? Math.abs(projectedCell.x - projectedOrigin.x) : width / this.map.columns;
        const cellHeight = this.map.infinite ? Math.abs(projectedCell.y - projectedOrigin.y) : height / this.map.rows;
        graphics.fillColor = new Color(74, 116, 108, 220);
        if (this.map.infinite) {
            const chunks = width > 200
                ? this.worldDeltas.discoveredChunkKeys().map((key) => {
                    const coordinate = parseChunkKey(key);
                    const summary = this.worldDeltas.discoveredChunkMap(key);
                    return {
                        coordinate,
                        roadCells: summary?.roadCells ?? [],
                        landmarkIds: summary?.landmarkIds ?? [],
                    };
                })
                : (this.map.preloadedChunks ?? []).map((chunk) => ({
                    coordinate: chunk.coordinate,
                    roadCells: chunk.roadCells,
                    landmarkIds: chunk.landmarks.map((landmark) => landmark.id),
                }));
            if (width > 200) {
                graphics.fillColor = new Color(24, 27, 25, 180);
                for (const chunk of chunks) {
                    const center = this.mapPosition({
                        x: (chunk.coordinate.x + 0.5) * CHUNK_WORLD_WIDTH,
                        y: (chunk.coordinate.y + 0.5) * CHUNK_WORLD_HEIGHT,
                    }, width, height);
                    graphics.rect(center.x - cellWidth * CHUNK_COLUMNS / 2, center.y - cellHeight * CHUNK_ROWS / 2, cellWidth * CHUNK_COLUMNS, cellHeight * CHUNK_ROWS);
                }
                graphics.fill();
                graphics.fillColor = new Color(74, 116, 108, 220);
            }
            for (const chunk of chunks) {
                for (const road of chunk.roadCells) {
                    const point = this.mapPosition(this.map.cellToWorld({
                        x: chunk.coordinate.x * CHUNK_COLUMNS + road.x,
                        y: chunk.coordinate.y * CHUNK_ROWS + road.y,
                    }), width, height);
                    graphics.rect(point.x - cellWidth / 2, point.y - cellHeight / 2, Math.max(1, cellWidth), Math.max(1, cellHeight));
                }
            }
            if (width > 200) {
                graphics.fill();
                for (const chunk of chunks) {
                    for (const landmarkId of chunk.landmarkIds) {
                        if (!this.worldDeltas.isLandmarkDiscovered(landmarkId)) continue;
                        const position = this.mapPosition(this.map.cellToWorld({
                            x: chunk.coordinate.x * CHUNK_COLUMNS + Math.floor(CHUNK_COLUMNS / 2),
                            y: chunk.coordinate.y * CHUNK_ROWS + 3,
                        }), width, height);
                        graphics.fillColor = UI_THEME.colors.cyan;
                        graphics.circle(position.x, position.y, 7);
                        graphics.fill();
                    }
                }
            }
        } else {
            for (let y = 0; y < this.map.rows; y++) {
                for (let x = 0; x < this.map.columns; x++) {
                    if (!this.map.isWalkable({ x, y })) continue;
                    graphics.rect(-width / 2 + x * cellWidth + 0.5, -height / 2 + y * cellHeight + 0.5, Math.max(1, cellWidth - 1), Math.max(1, cellHeight - 1));
                }
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

    private refreshMinimapStatic(force = false): void {
        if (!this.minimapStatic) return;
        const cell = this.map.worldToCell(this.simulation.player);
        const key = `${cell.x}:${cell.y}`;
        if (!force && key === this.lastMinimapCenterCell) return;
        this.lastMinimapCenterCell = key;
        this.drawStaticMap(this.minimapStatic, 142, 82);
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
        this.drawIntelTargetMarker(graphics, width, height);
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
            graphics.fillColor = loot.opened ? new Color(233, 230, 220, 150) : UI_THEME.colors.orange;
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
            graphics.fillColor = point.completed ? new Color(233, 230, 220, 150) : UI_THEME.colors.cyan;
            graphics.moveTo(position.x, position.y + radius);
            graphics.lineTo(position.x + radius, position.y);
            graphics.lineTo(position.x, position.y - radius);
            graphics.lineTo(position.x - radius, position.y);
            graphics.close();
            graphics.fill();
        }
        const barrier = this.simulation.structures[0];
        if (barrier) {
            const barrierPosition = this.mapPosition(barrier, width, height);
            graphics.lineWidth = width > 200 ? 5 : 2;
            graphics.strokeColor = barrier.vitality.active ? UI_THEME.colors.danger : UI_THEME.colors.cyan;
            graphics.moveTo(barrierPosition.x - (width > 200 ? 9 : 4), barrierPosition.y);
            graphics.lineTo(barrierPosition.x + (width > 200 ? 9 : 4), barrierPosition.y);
            graphics.stroke();
        }
        const player = this.mapPosition(this.simulation.player, width, height);
        graphics.fillColor = UI_THEME.colors.white;
        graphics.circle(player.x, player.y, width > 200 ? 7 : 3.2);
        graphics.fill();

        if (showViewport) {
            const camera = this.mapPosition(this.camera, width, height);
            const viewportWidth = width * this.frame.width / (this.map.infinite ? LOCAL_MAP_RADIUS * 2 : this.map.worldWidth);
            const viewportHeight = height * this.frame.height / (this.map.infinite ? LOCAL_MAP_RADIUS * 2 : this.map.worldHeight);
            graphics.lineWidth = 1;
            graphics.strokeColor = new Color(233, 230, 220, 150);
            graphics.rect(camera.x - viewportWidth / 2, camera.y - viewportHeight / 2, viewportWidth, viewportHeight);
            graphics.stroke();
        }
    }

    private drawIntelTargetMarker(graphics: Graphics, width: number, height: number): void {
        const position = this.mapPosition(intelTargetWorldPoint(this.target, this.map), width, height);
        const radius = width > 200 ? 12 : 5;
        graphics.lineWidth = width > 200 ? 4 : 2;
        graphics.strokeColor = UI_THEME.colors.orange;
        graphics.circle(position.x, position.y, radius);
        graphics.stroke();
        graphics.fillColor = UI_THEME.colors.orange;
        graphics.circle(position.x, position.y, width > 200 ? 3 : 1.5);
        graphics.fill();
    }

    private mapPosition(point: WorldPoint, width: number, height: number): WorldPoint {
        if (this.map.infinite && width > 200) {
            this.fullMapProjector ??= createDiscoveredMapProjection(
                this.worldDeltas.discoveredChunkKeys(), CHUNK_WORLD_WIDTH, CHUNK_WORLD_HEIGHT, width, height,
            );
            return this.fullMapProjector(point);
        }
        if (this.map.infinite) return localMapPosition(point, this.simulation.player, LOCAL_MAP_RADIUS, width, height);
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

    private refreshFullMapLabels(): void {
        for (const label of this.fullMapObjectLabels.values()) label.node.destroy();
        this.fullMapObjectLabels.clear();
        if (!this.fullMapCanvas) return;
        for (const loot of this.simulation.loot) {
            const position = this.mapPosition(loot, 800, 440);
            const label = UIBuilder.label(this.fullMapCanvas, `LootMap:${loot.id}`, loot.name, new Size(150, 22), new Vec3(position.x, position.y + 14), 12, UI_THEME.colors.orange);
            this.fullMapObjectLabels.set(loot.id, label);
        }
        for (const point of this.simulation.explorationPoints) {
            const position = this.mapPosition(point, 800, 440);
            const label = UIBuilder.label(this.fullMapCanvas, `ExploreMap:${point.id}`, point.name, new Size(150, 22), new Vec3(position.x, position.y + 14), 12, UI_THEME.colors.cyan);
            this.fullMapObjectLabels.set(point.id, label);
        }
    }

    private syncFullMapObjectLabels(): void {
        for (const loot of this.simulation.loot) {
            const label = this.fullMapObjectLabels.get(loot.id);
            if (!label) continue;
            label.node.active = loot.discovered;
            const position = this.mapPosition(loot, 800, 440);
            label.node.setPosition(position.x, position.y + 14);
            label.string = loot.opened ? `✓ ${loot.name}` : loot.name;
            label.color = loot.opened ? UI_THEME.colors.muted : UI_THEME.colors.orange;
        }
        for (const point of this.simulation.explorationPoints) {
            const label = this.fullMapObjectLabels.get(point.id);
            if (!label) continue;
            const position = this.mapPosition(point, 800, 440);
            label.node.setPosition(position.x, position.y + 14);
            label.string = point.completed ? `✓ ${point.name}` : point.name;
            label.color = point.completed ? UI_THEME.colors.muted : UI_THEME.colors.cyan;
        }
    }

    private syncActors(): void {
        const simulation = this.simulation;
        this.ensureEnemyNodes();
        const playerPosition = this.renderPoint(simulation.player);
        this.playerNode.setPosition(playerPosition.x, playerPosition.y);
        const structure = simulation.structures[0];
        if (structure && this.structureNode) {
            const structurePosition = this.renderPoint(structure);
            this.structureNode.setPosition(structurePosition.x, structurePosition.y);
        }
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
            const entry = this.enemyNodeEntries[index];
            if (!entry || enemy.vitality.state === "dead") return;
            const position = this.renderPoint(enemy);
            entry.node.setPosition(position.x, position.y);
            entry.animator.setFacing(simulation.player.x >= enemy.x);
            entry.animator.setBase(enemy.attacking ? "attack" : "walk");
        });
    }

    private syncVitality(): void {
        const player = this.simulation.player.vitality;
        this.playerHealthText.string = `${Math.ceil(player.currentHealth)} / ${player.maxHealth}`;
        this.playerShieldText.string = `护盾  ${Math.ceil(player.currentShield)} / ${player.maxShield}`;
        this.playerPollutionText.string = `污染  ${Math.ceil(this.simulation.playerPollution)} / 100`;
        UIBuilder.setProgressBarRatio(this.playerHealthBar, player.healthRatio);
        UIBuilder.setProgressBarRatio(this.playerShieldBar, player.shieldRatio);
        this.downedLabel.node.active = player.state === "downed";

        this.simulation.enemies.forEach((enemy, index) => {
            const entry = this.enemyNodeEntries[index];
            if (!entry) return;
            entry.node.active = enemy.vitality.state !== "dead";
            UIBuilder.setProgressBarRatio(entry.healthBar, enemy.vitality.healthRatio);
        });

        const structure = this.simulation.structures[0];
        if (!structure || !this.structureNode || !this.structureHealthBar || !this.structureStatusLabel) return;
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
        graphics.strokeColor = UI_THEME.colors.orange;
        graphics.lineWidth = 5;
        graphics.moveTo(-18, 0);
        graphics.lineTo(5, 0);
        graphics.stroke();
        graphics.fillColor = UI_THEME.colors.amber;
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
            const position = this.renderPoint(projectile);
            node.setPosition(position.x, position.y);
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
            const eventPosition = this.renderPoint(event);
            const startX = eventPosition.x + horizontalOffset;
            const startY = eventPosition.y + 36;
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
        return UI_THEME.colors.danger;
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
            if (enemyIndex >= 0) targetNode = this.enemyNodeEntries[enemyIndex]?.node;
            const structure = this.simulation.structures.find((candidate) => candidate.id === targetId);
            if (structure && this.structureNode) {
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
        const localCamera = this.renderPoint(this.camera);
        this.worldLayer.setPosition(-localCamera.x, -localCamera.y);
    }

    private syncPath(): void {
        const signature = this.simulation.playerPath.map((cell) => `${cell.x}:${cell.y}`).join("|");
        if (signature === this.lastPathSignature) return;
        this.lastPathSignature = signature;
        this.pathGraphics.clear();
        if (this.simulation.playerPath.length < 2) return;
        this.pathGraphics.lineWidth = 7;
        this.pathGraphics.strokeColor = new Color(214, 138, 66, 210);
        const first = this.renderPoint(this.map.cellToWorld(this.simulation.playerPath[0]));
        this.pathGraphics.moveTo(first.x, first.y);
        for (const cell of this.simulation.playerPath.slice(1)) {
            const point = this.renderPoint(this.map.cellToWorld(cell));
            this.pathGraphics.lineTo(point.x, point.y);
        }
        this.pathGraphics.stroke();
    }

    private syncIntelTarget(): void {
        const progress = this.targetTracker.update(this.simulation.player);
        this.distanceLabel.string = progress.reached ? "目标 · 已抵达" : `目标 ${progress.distanceMeters}m`;
        if (!progress.becameReached) return;

        this.objectiveLabel.string = `已抵达 · ${this.target.locationName}  |  完成现场搜索后撤离`;
        oops.message.dispatchEvent(GameEvent.IntelTargetReached, this.target.id);
        this.showTargetArrivalNotice();
    }

    private showTargetArrivalNotice(): void {
        this.lastNoticeId = `intel-target:${this.target.id}`;
        this.noticeLabel.string = `已抵达 ${this.target.locationName} · ${this.target.objectiveTitle}`;
        this.noticeOpacity.opacity = 255;
        this.noticeRemaining = 2.4;
        this.noticePanel.active = true;
    }

    private applyIntelTargetPresentation(): void {
        if (this.objectiveLabel) this.objectiveLabel.string = this.intelObjectiveText();
        if (this.distanceLabel) this.syncIntelTarget();
        if (this.minimapDynamic) this.drawDynamicMap(this.minimapDynamic, 142, 82, true);
        if (this.fullMapDynamic) this.drawDynamicMap(this.fullMapDynamic, 800, 440, false);
    }

    private intelObjectiveText(): string {
        return `当前目标 · ${this.target.objectiveTitle} · ${this.target.locationName}  |  点击地面寻路`;
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
        this.enemyNodeEntries.forEach((entry) => { if (entry) entry.animator.enabled = enabled; });
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
