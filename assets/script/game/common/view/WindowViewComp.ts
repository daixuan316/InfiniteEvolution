import { Event, Node, _decorator } from "cc";

import { oops } from "../../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { LanguageLabel } from "../../../../../extensions/oops-plugin-framework/assets/libs/gui/language/LanguageLabel";
import { GameComponent } from "../../../../../extensions/oops-plugin-framework/assets/module/common/GameComponent";
import { UIID } from "../config/GameUIConfig";

const { ccclass, property } = _decorator;

type WindowParams = {
    title?: string;
    content?: string;
    okWord?: string;
    cancelWord?: string;
    needCancel?: boolean;
    onOk?: () => void;
    onCancel?: () => void;
};

/** Controller referenced by common/prefab/window.prefab. */
@ccclass("WindowViewComp")
export class WindowViewComp extends GameComponent {
    @property(LanguageLabel)
    private lab_title: LanguageLabel = null!;

    @property(LanguageLabel)
    private lab_content: LanguageLabel = null!;

    @property(LanguageLabel)
    private lab_ok: LanguageLabel = null!;

    @property(LanguageLabel)
    private lab_cancel: LanguageLabel = null!;

    private config: WindowParams = {};

    onAdded(params?: WindowParams): boolean {
        this.config = params ?? {};
        this.lab_title.dataID = this.config.title ?? "";
        this.lab_content.dataID = this.config.content ?? "";
        this.lab_ok.dataID = this.config.okWord ?? "common_ok";
        this.lab_cancel.dataID = this.config.cancelWord ?? "common_cancel";

        const cancelButton = this.lab_cancel.node.parent;
        if (cancelButton) cancelButton.active = this.config.needCancel ?? false;
        return true;
    }

    /** Bound by both prefab buttons; the clicked node determines the action. */
    onTouchEnd(event: Event): void {
        const target = event.currentTarget as Node | null;
        if (target?.name === "btn_cancel") {
            this.config.onCancel?.();
        } else {
            this.config.onOk?.();
        }
        oops.gui.remove(UIID.Window);
    }

    protected onDestroy(): void {
        this.config = {};
        super.onDestroy();
    }
}
