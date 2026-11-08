/*
 * 初始化游戏公共资源（对齐 oops-plugin-framework 2.x）
 */
import { Font } from "cc";
import { oops } from "../../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { AsyncQueue, NextFunction } from "../../../../../extensions/oops-plugin-framework/assets/libs/collection/AsyncQueue";
import { ecs } from "../../../../../extensions/oops-plugin-framework/assets/libs/ecs/ECS";
import { UIID } from "../../common/config/GameUIConfig";
import "../../common/view/WindowViewComp";
import { Initialize } from "../Initialize";
import { LoadingViewComp } from "../view/LoadingViewComp";

/** 初始化游戏公共资源 */
@ecs.register('InitRes')
export class InitResComp extends ecs.Comp {
    reset() { }
}

export class InitResSystem extends ecs.ComblockSystem implements ecs.IEntityEnterSystem {
    filter(): ecs.IMatcher {
        return ecs.allOf(InitResComp);
    }

    entityEnter(e: Initialize): void {
        var queue: AsyncQueue = new AsyncQueue();

        this.loadBundle(queue);
        this.loadCustom(queue);
        this.loadLanguage(queue);
        this.onComplete(queue, e);

        queue.play();
    }

    /** 加载默认资源包（kit 使用 bundle） */
    private loadBundle(queue: AsyncQueue) {
        queue.push(async (next: NextFunction, params: any, args: any) => {
            const bundleName = oops.config.game.bundleDefault || "bundle";
            oops.res.defaultBundleName = bundleName;
            await oops.res.loadBundle(bundleName);
            next();
        });
    }

    /** 加载自定义内容（可选） */
    private loadCustom(queue: AsyncQueue) {
        queue.push(async (next: NextFunction, params: any, args: any) => {
            // 字体资源可选；失败不阻断启动
            try {
                await oops.res.load("language/font/" + oops.language.current, Font);
            } catch {
                // ignore
            }
            next();
        });
    }

    /** 加载语言包（可选） */
    private loadLanguage(queue: AsyncQueue) {
        queue.push((next: NextFunction, params: any, args: any) => {
            let lan = oops.storage.get("language");
            if (lan == null || lan === "") {
                lan = oops.config.game.languageDefault || "zh";
                oops.storage.set("language", lan);
            }

            oops.language.languages = oops.config.game.language;
            oops.language.default = oops.config.game.languageDefault;
            oops.language.setLanguage(lan, next);
        });
    }

    /** 加载完成进入游戏内容加载界面 */
    private onComplete(queue: AsyncQueue, e: Initialize) {
        queue.complete = async () => {
            const node = await oops.gui.open(UIID.Loading);
            if (node) {
                const comp = node.getComponent(LoadingViewComp);
                if (comp) {
                    e.add(comp as ecs.Comp);
                }
            }
            e.remove(InitResComp);
        };
    }
}
