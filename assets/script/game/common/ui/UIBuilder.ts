import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
    Rect,
    Size,
    Sprite,
    SpriteFrame,
    Texture2D,
    UITransform,
    Vec3,
    VerticalTextAlignment,
    view,
} from "cc";

import { oops } from "../../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { shouldComposeLargeSurface, surfaceFramePieces } from "./SurfaceFrameLayout";
import { textureAssetPath } from "./TextureAssetPath";
import { textureFrameLayout } from "./TextureFrameLayout";
import { UI_THEME } from "./UITheme";

export interface SafeFrame {
    width: number;
    height: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export type SpriteFit = "stretch" | "contain" | "cover";

export class UIBuilder {
    private static readonly COMMON_TEXTURE = "gui/ui-p0/texture/common";
    private static readonly SURFACE_ASSET = {
        large: "01-panel-large",
        medium: "02-panel-medium",
        card: "03-card-compact",
        tooltip: "04-tooltip",
        primary: "05-button-primary",
        secondary: "06-button-secondary",
        warning: "07-button-warning",
        danger: "08-button-danger",
        tab: "09-tab-inactive",
        tabSelected: "10-tab-selected",
        slot: "11-slot-empty",
        slotSelected: "12-slot-selected",
        bar: "13-bar-status",
    } as const;

    static prepareRoot(root: Node): SafeFrame {
        const visible = view.getVisibleSize();
        const transform = root.getComponent(UITransform) ?? root.addComponent(UITransform);
        transform.setContentSize(visible.width, visible.height);
        root.destroyAllChildren();
        return {
            width: visible.width,
            height: visible.height,
            left: -visible.width / 2 + UI_THEME.safeMargin,
            right: visible.width / 2 - UI_THEME.safeMargin,
            top: visible.height / 2 - UI_THEME.safeMargin,
            bottom: -visible.height / 2 + UI_THEME.safeMargin,
        };
    }

    static panel(parent: Node, name: string, size: Size, position: Vec3, color: Color = UI_THEME.colors.panel, stroke: Color = UI_THEME.colors.cyanDark): Node {
        const node = new Node(name);
        node.layer = parent.layer;
        const transform = node.addComponent(UITransform);
        transform.setContentSize(size);
        const graphics = node.addComponent(Graphics);
        const radius = Math.min(UI_THEME.radius.panel, size.width / 4, size.height / 4);
        const inset = UI_THEME.stroke.width / 2;
        graphics.fillColor = color;
        graphics.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, radius);
        graphics.fill();
        graphics.lineWidth = UI_THEME.stroke.width;
        graphics.strokeColor = stroke;
        graphics.roundRect(-size.width / 2 + inset, -size.height / 2 + inset, size.width - inset * 2, size.height - inset * 2, Math.max(0, radius - inset));
        graphics.stroke();
        node.setPosition(position);
        parent.addChild(node);
        return node;
    }

    /** 给可点节点挂按压反馈：按下轻微缩小，抬起或取消时还原。 */
    static pressable(node: Node): void {
        const origin = node.scale.clone();
        const pressed = (): void => node.setScale(origin.x * 0.96, origin.y * 0.96, origin.z);
        const restore = (): void => node.setScale(origin.x, origin.y, origin.z);
        node.on(Node.EventType.TOUCH_START, pressed, node);
        node.on(Node.EventType.TOUCH_END, restore, node);
        node.on(Node.EventType.TOUCH_CANCEL, restore, node);
    }

    static label(parent: Node, name: string, text: string, size: Size, position: Vec3, fontSize: number = UI_THEME.font.body, color: Color = UI_THEME.colors.white, align: HorizontalTextAlignment = HorizontalTextAlignment.CENTER): Label {
        const node = new Node(name);
        node.layer = parent.layer;
        const transform = node.addComponent(UITransform);
        transform.setContentSize(size);
        const label = node.addComponent(Label);
        label.string = text;
        label.fontSize = fontSize;
        label.lineHeight = Math.round(fontSize * 1.2);
        label.color = color;
        label.horizontalAlign = align;
        label.verticalAlign = VerticalTextAlignment.CENTER;
        label.overflow = Label.Overflow.SHRINK;
        node.setPosition(position);
        parent.addChild(node);
        return label;
    }

    static button(parent: Node, name: string, text: string, size: Size, position: Vec3, primary = false): Node {
        const width = Math.max(size.width, UI_THEME.touchMin);
        const height = Math.max(size.height, UI_THEME.touchMin);
        const node = this.panel(
            parent,
            name,
            new Size(width, height),
            position,
            primary ? new Color(74, 56, 22, 252) : UI_THEME.colors.panelSoft,
            primary ? UI_THEME.colors.amber : UI_THEME.colors.cyanDark,
        );
        this.label(node, `${name}Label`, text, new Size(width - 18, height - 12), Vec3.ZERO, primary ? 24 : 20, primary ? UI_THEME.colors.amber : UI_THEME.colors.white);
        return node;
    }

    static navButton(parent: Node, name: string, text: string, icon: string, size: Size, position: Vec3, primary = false): Node {
        const node = this.surface(parent, name, size, position, primary ? "primary" : "secondary");
        const wide = size.width >= size.height * 2;
        const iconSize = Math.min(58, size.height - 20);
        void this.icon(node, icon, iconSize, new Vec3(wide ? -size.width / 2 + 44 : 0, wide ? 0 : 10));
        this.label(
            node,
            `${name}Label`,
            text,
            new Size(wide ? size.width - 84 : size.width - 14, 30),
            new Vec3(wide ? 24 : 0, wide ? 0 : -size.height / 2 + 19),
            wide ? (primary ? 22 : 20) : 17,
            primary ? UI_THEME.colors.amber : UI_THEME.colors.white,
        );
        return node;
    }

    static progressBar(parent: Node, name: string, size: Size, position: Vec3, ratio: number, fillColor: Color): Node {
        const track = this.panel(parent, name, size, position, UI_THEME.colors.black, UI_THEME.colors.cyanDark);
        const fill = new Node(`${name}Fill`);
        fill.layer = track.layer;
        fill.addComponent(UITransform);
        const graphics = fill.addComponent(Graphics);
        graphics.fillColor = fillColor;
        track.addChild(fill);
        this.setProgressBarRatio(track, ratio);
        return track;
    }

    static setProgressBarRatio(track: Node, ratio: number): void {
        const clamped = Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
        const trackSize = track.getComponent(UITransform)?.contentSize;
        const fill = track.getChildByName(`${track.name}Fill`);
        const fillTransform = fill?.getComponent(UITransform);
        const graphics = fill?.getComponent(Graphics);
        if (!trackSize || !fill || !fillTransform || !graphics) return;

        const inset = 7;
        const height = Math.max(0, trackSize.height - inset * 2);
        const availableWidth = Math.max(0, trackSize.width - inset * 2);
        const width = availableWidth * clamped;
        fillTransform.setContentSize(width, height);
        fill.setPosition(-(availableWidth - width) / 2, 0);
        fill.active = width > 0;
        graphics.clear();
        if (width > 0) {
            graphics.roundRect(-width / 2, -height / 2, width, height, UI_THEME.radius.bar);
            graphics.fill();
        }
    }

    static async icon(parent: Node, assetPath: string, size: number, position: Vec3 = Vec3.ZERO): Promise<Sprite | null> {
        return this.sprite(parent, `gui/ui-icons/${assetPath}`, new Size(size, size), position, false, Color.WHITE, "contain");
    }

    static async backdrop(parent: Node, assetPath: string, size: Size, tint = Color.WHITE): Promise<Sprite | null> {
        return this.sprite(parent, assetPath, size, Vec3.ZERO, false, tint, "cover");
    }

    static surface(
        parent: Node,
        name: string,
        size: Size,
        position: Vec3,
        kind: keyof typeof UIBuilder.SURFACE_ASSET = "medium",
        tint = Color.WHITE,
    ): Node {
        const node = this.panel(parent, name, size, position, UI_THEME.colors.panel, UI_THEME.colors.cyanDark);
        const asset = this.SURFACE_ASSET[kind];
        const assetPath = `${this.COMMON_TEXTURE}/${asset}`;
        if (kind === "large" && shouldComposeLargeSurface(size.width, size.height)) {
            void this.compositeLargeSurfaceFrame(node, assetPath, size, tint);
        } else {
            void this.sprite(node, assetPath, size, Vec3.ZERO, true, tint);
        }
        return node;
    }

    private static async compositeLargeSurfaceFrame(parent: Node, assetPath: string, size: Size, tint: Color): Promise<void> {
        const frameRoot = new Node("SurfaceFrame");
        frameRoot.layer = parent.layer;
        frameRoot.addComponent(UITransform).setContentSize(size);
        parent.addChild(frameRoot);

        const texture = await oops.res.load("bundle", textureAssetPath(assetPath), Texture2D);
        if (!texture || !parent.isValid || !frameRoot.isValid) {
            if (frameRoot.isValid) frameRoot.destroy();
            return;
        }

        for (const piece of surfaceFramePieces(size.width, size.height)) {
            const pieceNode = new Node(`SurfaceFrame:${piece.name}`);
            pieceNode.layer = frameRoot.layer;
            pieceNode.addComponent(UITransform).setContentSize(piece.width, piece.height);
            pieceNode.setPosition(piece.x, piece.y);

            const sprite = pieceNode.addComponent(Sprite);
            const frame = new SpriteFrame();
            frame.reset({
                texture,
                rect: new Rect(piece.source.x, piece.source.y, piece.source.width, piece.source.height),
                originalSize: new Size(piece.source.width, piece.source.height),
            }, true);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.type = Sprite.Type.SIMPLE;
            sprite.spriteFrame = frame;
            sprite.color = tint;
            frameRoot.addChild(pieceNode);
        }
    }

    static hudPlate(parent: Node, name: string, asset: string, size: Size, position: Vec3): Node {
        const node = this.panel(parent, name, size, position, new Color(13, 15, 14, 220), UI_THEME.colors.cyanDark);
        void this.sprite(node, `gui/ui-p0/texture/${asset}`, size, Vec3.ZERO, false);
        return node;
    }

    static slot(parent: Node, name: string, size: Size, position: Vec3, selected = false): Node {
        return this.surface(parent, name, size, position, selected ? "slotSelected" : "slot");
    }

    static async sprite(parent: Node, assetPath: string, size: Size, position: Vec3 = Vec3.ZERO, sliced = false, tint = Color.WHITE, fit: SpriteFit = "stretch"): Promise<Sprite | null> {
        const node = new Node(`Icon:${assetPath}`);
        node.layer = parent.layer;
        const transform = node.addComponent(UITransform);
        transform.setContentSize(size);
        const sprite = node.addComponent(Sprite);
        node.setPosition(position);
        parent.addChild(node);

        const texture = await oops.res.load("bundle", textureAssetPath(assetPath), Texture2D);
        if (!texture || !node.isValid) {
            if (node.isValid) node.destroy();
            return null;
        }
        const frame = new SpriteFrame();
        const layout = textureFrameLayout(assetPath);
        const sourceWidth = layout?.width ?? texture.width;
        const sourceHeight = layout?.height ?? texture.height;
        const scale = fit === "cover" ? Math.max(size.width / sourceWidth, size.height / sourceHeight)
            : fit === "contain" ? Math.min(size.width / sourceWidth, size.height / sourceHeight)
                : 0;
        if (scale > 0) {
            transform.setContentSize(Math.round(sourceWidth * scale), Math.round(sourceHeight * scale));
        }
        if (layout) {
            frame.reset({
                texture,
                rect: new Rect(layout.x, layout.y, layout.width, layout.height),
                originalSize: new Size(layout.width, layout.height),
                borderTop: layout.borderTop ?? 0,
                borderBottom: layout.borderBottom ?? 0,
                borderLeft: layout.borderLeft ?? 0,
                borderRight: layout.borderRight ?? 0,
            }, true);
        } else {
            frame.reset({
                texture,
                rect: new Rect(0, 0, texture.width, texture.height),
                originalSize: new Size(texture.width, texture.height),
            }, true);
        }
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        sprite.type = sliced ? Sprite.Type.SLICED : Sprite.Type.SIMPLE;
        sprite.spriteFrame = frame;
        sprite.color = tint;
        return sprite;
    }
}
