import {
    Component,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
    _decorator,
} from "cc";

import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { textureAssetPath } from "../common/ui/TextureAssetPath";

const { ccclass } = _decorator;

export type ActorAction = "idle" | "walk" | "attack" | "attackWalk" | "dodge";

export interface ActorAnimatorConfig {
    /** Original single-frame art; shown until a sheet loads or when a sheet is missing. */
    readonly fallback: string;
    /** Sprite sheet asset path per action, e.g. "gui/battle-hud/actors/player-walk". */
    readonly sheets: Readonly<Partial<Record<ActorAction, string>>>;
    /** +1 when the art faces right, -1 when it faces left. */
    readonly facingBase: 1 | -1;
}

interface ActorClip {
    readonly frames: readonly SpriteFrame[];
    readonly framesPerSecond: number;
}

const SHEET_GRID = 4;
const DEFAULT_FRAMES_PER_SECOND: Readonly<Record<ActorAction, number>> = {
    idle: 10,
    walk: 14,
    attack: 14,
    attackWalk: 14,
    dodge: 30,
};

/**
 * Plays 4x4 pixel-art sprite sheets sliced into frames at runtime, mirroring
 * how UIBuilder builds SpriteFrames from imported textures. Missing sheets
 * keep the actor's static fallback art, so sheets can land incrementally.
 */
@ccclass("ActorAnimator")
export class ActorAnimator extends Component {
    private config!: ActorAnimatorConfig;
    private sprite: Sprite | null = null;
    private fallbackFrame: SpriteFrame | null = null;
    private readonly clips = new Map<ActorAction, ActorClip>();
    private base: ActorAction = "idle";
    private baseSpeed = 1;
    private oneShot: ActorAction | null = null;
    private faceRight = true;
    private elapsed = 0;

    setup(config: ActorAnimatorConfig): void {
        this.config = config;
    }

    /** Binds the sprite created by UIBuilder and starts loading every configured sheet. */
    attach(sprite: Sprite | null): void {
        if (!this.config || !sprite?.node.isValid) return;
        this.sprite = sprite;
        this.fallbackFrame = sprite.spriteFrame;
        this.applyFacing();
        for (const action of Object.keys(this.config.sheets) as ActorAction[]) {
            const assetPath = this.config.sheets[action];
            if (assetPath) void this.loadClip(action, assetPath);
        }
    }

    /** Switches the looping locomotion/combat action; speed scales playback (sprinting). */
    setBase(action: ActorAction, speed = 1): void {
        if (this.base === action && this.baseSpeed === speed) return;
        this.base = action;
        this.baseSpeed = speed;
        if (!this.oneShot) this.elapsed = 0;
    }

    setFacing(faceRight: boolean): void {
        if (this.faceRight === faceRight) return;
        this.faceRight = faceRight;
        this.applyFacing();
    }

    /** Plays a one-shot action (dodge roll) once, then returns to the base action. */
    playOnce(action: ActorAction): void {
        if (!this.clips.has(action)) return;
        this.oneShot = action;
        this.elapsed = 0;
    }

    /** True once the given action's sheet has finished loading. */
    hasClip(action: ActorAction): boolean {
        return this.clips.has(action);
    }

    update(deltaTime: number): void {
        const clip = this.clips.get(this.oneShot ?? this.base);
        if (clip && clip.frames.length > 0) {
            this.elapsed += deltaTime * (this.oneShot ? 1 : this.baseSpeed);
            if (this.oneShot && this.elapsed * clip.framesPerSecond >= clip.frames.length) {
                this.oneShot = null;
                this.elapsed = 0;
            }
        }
        this.applyFrame();
    }

    private async loadClip(action: ActorAction, assetPath: string): Promise<void> {
        const texture = await oops.res.load("bundle", textureAssetPath(assetPath), Texture2D);
        if (!texture || !this.isValid || !this.sprite?.node.isValid) return;
        const frameWidth = Math.floor(texture.width / SHEET_GRID);
        const frameHeight = Math.floor(texture.height / SHEET_GRID);
        const frames: SpriteFrame[] = [];
        for (let index = 0; index < SHEET_GRID * SHEET_GRID; index++) {
            const frame = new SpriteFrame();
            frame.reset(
                {
                    texture,
                    rect: new Rect((index % SHEET_GRID) * frameWidth, Math.floor(index / SHEET_GRID) * frameHeight, frameWidth, frameHeight),
                    originalSize: new Size(frameWidth, frameHeight),
                },
                true,
            );
            frames.push(frame);
        }
        this.clips.set(action, { frames, framesPerSecond: DEFAULT_FRAMES_PER_SECOND[action] });
    }

    private applyFrame(): void {
        if (!this.sprite?.node.isValid) return;
        const clip = this.clips.get(this.oneShot ?? this.base);
        if (!clip || clip.frames.length === 0) {
            if (this.sprite.spriteFrame !== this.fallbackFrame) this.sprite.spriteFrame = this.fallbackFrame;
            return;
        }
        const index = Math.floor(this.elapsed * clip.framesPerSecond) % clip.frames.length;
        const frame = clip.frames[index];
        if (this.sprite.spriteFrame !== frame) this.sprite.spriteFrame = frame;
    }

    /** Flips only the sprite child so overlays like health bars never mirror. */
    private applyFacing(): void {
        if (!this.sprite?.node.isValid) return;
        const sign = this.faceRight ? this.config.facingBase : -this.config.facingBase;
        this.sprite.node.setScale(sign, 1, 1);
    }
}
