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
    /** 日落后已从探索区撤回庇护所 */
    DayReturned = "DayReturned",
    /** 夜间庇护所防守开始 */
    NightDefenseStarted = "NightDefenseStarted",
    /** 夜间尸潮进入预警 */
    HordeWarning = "HordeWarning",
    /** 尸潮波次阶段变化 */
    HordeWaveChanged = "HordeWaveChanged",
    /** 夜间尸潮清剿完成 */
    NightCompleted = "NightCompleted",
    /** 库存数量变化 */
    InventoryChanged = "InventoryChanged",
    /** 工坊制造队列变化 */
    WorkshopQueueChanged = "WorkshopQueueChanged",
    /** 制造任务完成并已入库 */
    CraftCompleted = "CraftCompleted",
    /** 探索情报目标发生变化 */
    IntelTargetChanged = "IntelTargetChanged",
    /** 玩家首次抵达本次探索目标区域 */
    IntelTargetReached = "IntelTargetReached",
    /** 方舟建设状态变化 */
    ArkStateChanged = "ArkStateChanged",
    /** 方舟供电变化 */
    ArkPowerChanged = "ArkPowerChanged",
    /** 方舟噪音变化 */
    ArkNoiseChanged = "ArkNoiseChanged",
    /** 方舟模块受损 */
    ArkModuleDamaged = "ArkModuleDamaged",
    /** 方舟夜战已结算 */
    ArkBattleSettled = "ArkBattleSettled",
}
