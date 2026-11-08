import { BlockInputEvents, Color, Size, Vec3, _decorator } from "cc";

import { UIID } from "../common/config/GameUIConfig";
import { GamePage } from "../common/ui/GamePage";
import { UIBuilder } from "../common/ui/UIBuilder";
import { uiNavigation } from "../common/ui/UIRuntime";
import { UI_THEME } from "../common/ui/UITheme";

const { ccclass } = _decorator;

export interface ConfirmDialogParams {
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm(): void;
}

@ccclass("ConfirmDialogViewComp")
export class ConfirmDialogViewComp extends GamePage {
    protected start(): void {
        this.node.addComponent(BlockInputEvents);
        this.render();
    }

    private render(): void {
        const frame = UIBuilder.prepareRoot(this.node);
        const data = this.params as unknown as ConfirmDialogParams;
        UIBuilder.panel(this.node, "DialogShade", new Size(frame.width + 8, frame.height + 8), Vec3.ZERO, new Color(1, 5, 9, 190), UI_THEME.colors.black);
        const dialog = UIBuilder.surface(this.node, "DialogPanel", new Size(610, 330), Vec3.ZERO, "warning");
        UIBuilder.label(dialog, "DialogTitle", data.title, new Size(520, 58), new Vec3(0, 100), 30, UI_THEME.colors.orange);
        UIBuilder.label(dialog, "DialogMessage", data.message, new Size(510, 90), new Vec3(0, 30), 21, UI_THEME.colors.white);

        const cancel = UIBuilder.navButton(dialog, "BtnCancel", data.cancelText, "system-nav/15-cancel", new Size(230, 78), new Vec3(-135, -92));
        const confirm = UIBuilder.navButton(dialog, "BtnConfirm", data.confirmText, "system-nav/14-confirm", new Size(230, 78), new Vec3(135, -92), true);
        this.bindTouch(cancel, () => uiNavigation.closeOverlay(UIID.ConfirmDialog));
        this.bindTouch(confirm, () => {
            uiNavigation.closeOverlay(UIID.ConfirmDialog);
            data.onConfirm?.();
        });
    }
}
