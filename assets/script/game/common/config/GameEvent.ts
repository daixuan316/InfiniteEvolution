/*
 * 游戏全局事件（模块间解耦）
 */

/** 游戏事件 */
export enum GameEvent {
    /** 游戏服务器连接成功 */
    GameServerConnected = "GameServerConnected",
    /** 登陆成功 */
    LoginSuccess = "LoginSuccess",
    /** 从主界面进入战斗 */
    EnterBattle = "EnterBattle",
    /** 离开战斗返回主界面 */
    LeaveBattle = "LeaveBattle",
    /** 页面导航完成 */
    UIPageChanged = "UIPageChanged",
    /** 暂停覆盖层打开 */
    GamePaused = "GamePaused",
    /** 暂停覆盖层关闭 */
    GameResumed = "GameResumed",
    /** 白昼探索剩余时间变化 */
    DayTimeChanged = "DayTimeChanged",
    /** 白昼压力阶段变化 */
    DayPressureChanged = "DayPressureChanged",
}
