import {
    Color,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Node,
    Size,
    Sprite,
    SpriteFrame,
    UITransform,
    Vec3,
    VerticalTextAlignment,
    view,
} from "cc";

import { oops } from "../../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { UI_THEME } from "./UITheme";

export interface SafeFrame {
    width: number;
    height: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export class UIBuilder {
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
        const transform = node.addComponent(UITransform);
        transform.setContentSize(size);
        const graphics = node.addComponent(Graphics);
        graphics.fillColor = color;
        graphics.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, 10);
        graphics.fill();
        graphics.lineWidth = 3;
        graphics.strokeColor = stroke;
        graphics.roundRect(-size.width / 2 + 1.5, -size.height / 2 + 1.5, size.width - 3, size.height - 3, 10);
        graphics.stroke();
        node.setPosition(position);
        parent.addChild(node);
        return node;
    }

    static label(parent: Node, name: string, text: string, size: Size, position: Vec3, fontSize = UI_THEME.font.body, color: Color = UI_THEME.colors.white, align = HorizontalTextAlignment.CENTER): Label {
        const node = new Node(name);
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

    static progressBar(parent: Node, name: string, size: Size, position: Vec3, ratio: number, fillColor: Color): Node {
        const clamped = Math.max(0, Math.min(1, ratio));
        const track = this.panel(parent, name, size, position, UI_THEME.colors.black, UI_THEME.colors.cyanDark);
        const inset = 7;
        const fillWidth = (size.width - inset * 2) * clamped;
        if (fillWidth > 0) {
            const fill = new Node(`${name}Fill`);
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
        const node = new Node(`Icon:${assetPath}`);
        node.addComponent(UITransform).setContentSize(size, size);
        const sprite = node.addComponent(Sprite);
        node.setPosition(position);
        parent.addChild(node);

        const frame = await oops.res.load("bundle", `gui/ui-icons/${assetPath}/spriteFrame`, SpriteFrame);
        if (!frame || !node.isValid) {
            if (node.isValid) node.destroy();
            return null;
        }
        sprite.spriteFrame = frame;
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        return sprite;
    }
}
