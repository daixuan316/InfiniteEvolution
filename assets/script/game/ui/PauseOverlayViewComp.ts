import { BlockInputEvents, Color, Size, Vec3, _decorator } from "cc";

import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { GameEvent } from "../common/config/GameEvent";
import { UIID } from "../common/config/GameUIConfig";
import { GamePage } from "../common/ui/GamePage";
import { UIBuilder } from "../common/ui/UIBuilder";
import { uiNavigation } from "../common/ui/UIRuntime";
import { UI_THEME } from "../common/ui/UITheme";

const { ccclass } = _decorator;

@ccclass("PauseOverlayViewComp")
export class PauseOverlayViewComp extends GamePage {
    protected onLoad(): void {
        this.node.addComponent(BlockInputEvents);
        this.render();
    }

    private render(): void {
        const frame = UIBuilder.prepareRoot(this.node);
        UIBuilder.panel(this.node, "PauseShade", new Size(frame.width + 8, frame.height + 8), Vec3.ZERO, new Color(10, 11, 10, 205), UI_THEME.colors.cyanDark);
        const panel = UIBuilder.surface(this.node, "PausePanel", new Size(520, 420), Vec3.ZERO, "large");
        UIBuilder.label(panel, "PauseTitle", "游戏已暂停", new Size(420, 66), new Vec3(0, 130), UI_THEME.font.title, UI_THEME.colors.white);
        UIBuilder.label(panel, "PauseHint", "计时和战斗输入已冻结", new Size(420, 44), new Vec3(0, 78), 20, UI_THEME.colors.muted);

        const resume = UIBuilder.navButton(panel, "BtnContinue", "继续探索", "system-nav/11-resume", new Size(320, 82), new Vec3(0, 5), true);
        const returnArk = UIBuilder.navButton(panel, "BtnPauseReturnArk", "返回方舟", "system-nav/13-exit", new Size(320, 82), new Vec3(0, -92));
        this.bindTouch(resume, () => this.resume());
        this.bindTouch(returnArk, () => { void this.requestReturn(); });
    }

    private resume(): void {
        if (uiNavigation.closeOverlay(UIID.PauseOverlay)) {
            oops.message.dispatchEvent(GameEvent.GameResumed);
        }
    }

    private async requestReturn(): Promise<void> {
        await uiNavigation.openOverlay(UIID.ConfirmDialog, {
            title: "结束探索",
            message: "未结算物资可能损失，仍要返回方舟吗？",
            confirmText: "返回方舟",
            cancelText: "取消",
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
