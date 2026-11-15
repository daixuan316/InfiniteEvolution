/*
 * 游戏进入初始化模块
 */
import { CCEntity } from "../../../../extensions/oops-plugin-framework/assets/module/common/CCEntity";
import { ecs } from "../../../../extensions/oops-plugin-framework/assets/libs/ecs/ECS";
import { InitResComp, InitResSystem } from "./bll/InitRes";

/**
 * 游戏进入初始化模块
 * 1、热更新
 * 2、加载默认资源
 */
@ecs.register('Initialize')
export class Initialize extends CCEntity {
    protected init() {
        // 初始化游戏公共资源
        this.add(InitResComp);
    }
}

export class EcsInitializeSystem extends ecs.System {
    constructor() {
        super();

        this.add(new InitResSystem());
    }
}
