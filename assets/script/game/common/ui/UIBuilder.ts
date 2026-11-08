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

    static panel(parent: Node, name: string, size: Size, position: Vec3, color: Color = UI_THEME.colors.panel, stroke: Color = UI_THEME.colors.cyan): Node {
        const node = new Node(name);
        node.layer = parent.layer;
        const transform = node.addComponent(UITransform);
        transform.setContentSize(size);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = color;
        this.cutCornerPath(graphics, size, 12);
        graphics.fill();
        graphics.lineWidth = 3;
        graphics.strokeColor = stroke;
        this.cutCornerPath(graphics, new Size(size.width - 3, size.height - 3), 10);
        graphics.stroke();
        node.setPosition(position);
        parent.addChild(node);
        return node;
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
            primary ? new Color(89, 58, 8, 252) : UI_THEME.colors.panelSoft,
            primary ? UI_THEME.colors.orange : UI_THEME.colors.cyan,
        );
        this.label(node, `${name}Label`, text, new Size(width - 18, height - 12), Vec3.ZERO, primary ? 24 : 20, primary ? UI_THEME.colors.orange : UI_THEME.colors.white);
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
            primary ? UI_THEME.colors.black : UI_THEME.colors.white,
        );
        return node;
    }

    static progressBar(parent: Node, name: string, size: Size, position: Vec3, ratio: number, fillColor: Color): Node {
        const clamped = Math.max(0, Math.min(1, ratio));
        const track = this.panel(parent, name, size, position, UI_THEME.colors.black, UI_THEME.colors.cyanDark);
        const inset = 7;
        const fillWidth = (size.width - inset * 2) * clamped;
        if (fillWidth > 0) {
            const fill = new Node(`${name}Fill`);
            fill.layer = track.layer;
            const transform = fill.addComponent(UITransform);
            transform.setContentSize(fillWidth, size.height - inset * 2);
            const graphics = fill.addComponent(Graphics);
            graphics.fillColor = fillColor;
            graphics.roundRect(-fillWidth / 2, -(size.height - inset * 2) / 2, fillWidth, size.height - inset * 2, 4);
            graphics.fill();
            fill.setPosition(-(size.width - inset * 2 - fillWidth) / 2, 0);
            track.addChild(fill);
        }
        return track;
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
        void this.sprite(node, `${this.COMMON_TEXTURE}/${asset}`, size, Vec3.ZERO, true, tint);
        return node;
    }

    static hudPlate(parent: Node, name: string, asset: string, size: Size, position: Vec3): Node {
        const node = this.panel(parent, name, size, position, new Color(3, 15, 27, 220), UI_THEME.colors.cyanDark);
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

    private static cutCornerPath(graphics: Graphics, size: Size, cut: number): void {
        const left = -size.width / 2;
        const right = size.width / 2;
        const bottom = -size.height / 2;
        const top = size.height / 2;
        const c = Math.min(cut, size.width / 4, size.height / 4);
        graphics.moveTo(left + c, bottom);
        graphics.lineTo(right - c, bottom);
        graphics.lineTo(right, bottom + c);
        graphics.lineTo(right, top - c);
        graphics.lineTo(right - c, top);
        graphics.lineTo(left + c, top);
        graphics.lineTo(left, top - c);
        graphics.lineTo(left, bottom + c);
        graphics.close();
    }
}
