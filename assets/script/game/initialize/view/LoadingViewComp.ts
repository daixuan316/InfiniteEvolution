/*
 * 游戏资源加载界面（对齐 oops-plugin-framework 2.x：CCViewVM）
 */
import { _decorator } from "cc";
import { oops } from "../../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { ecs } from "../../../../../extensions/oops-plugin-framework/assets/libs/ecs/ECS";
import { CCViewVM } from "../../../../../extensions/oops-plugin-framework/assets/module/common/CCViewVM";
import { UIID } from "../../common/config/GameUIConfig";
import { uiNavigation } from "../../common/ui/UIRuntime";
import { Initialize } from "../Initialize";

const { ccclass } = _decorator;

/** 游戏资源加载 */
@ccclass('LoadingViewComp')
@ecs.register('LoadingView', false)
export class LoadingViewComp extends CCViewVM<Initialize> {
    /** VM 组件绑定数据 */
    data: any = {
        /** 加载资源当前进度 */
        finished: 0,
        /** 加载资源最大进度 */
        total: 0,
        /** 加载资源进度比例值 */
        progress: "0",
        /** 加载流程中提示文本 */
        prompt: ""
    };

    private progress: number = 0;

    reset(): void {
        this.data.prompt = oops.language.getLangByID("loading_load_player");

        uiNavigation.enterRoot(UIID.Hall).then((opened) => {
            if (opened) oops.gui.remove(UIID.Loading);
        });
    }

    start() {
        this.enter();
    }

    enter() {
        this.loadRes();
    }

    /** 加载资源 */
    private async loadRes() {
        this.data.progress = 0;
        await this.loadCustom();
        this.loadGameRes();
    }

    /** 加载游戏本地JSON数据（自定义内容） */
    private loadCustom() {
        this.data.prompt = oops.language.getLangByID("loading_load_json");
    }

    /** 加载初始游戏内容资源 */
    private loadGameRes() {
        this.data.prompt = oops.language.getLangByID("loading_load_game");
        oops.res.loadDir("game", this.onProgressCallback.bind(this), this.onCompleteCallback.bind(this));
    }

    /** 加载进度事件 */
    private onProgressCallback(finished: number, total: number, item: any) {
        this.data.finished = finished;
        this.data.total = total;

        var progress = finished / total;
        if (progress > this.progress) {
            this.progress = progress;
            this.data.progress = (progress * 100).toFixed(2);
        }
    }

    /** 加载完成事件 */
    private onCompleteCallback() {
        this.ent.remove(LoadingViewComp);
    }
}
