# 弹丸轨迹与命中反馈设计

- **日期：** 2026-11-08
- **项目：** 无限进化·末世生存
- **引擎：** Cocos Creator 3.8.8、TypeScript、Oops Framework
- **状态：** 已确认，可进入实现计划

## 1. 问题与目标

当前 `BattleSimulation` 在人物攻击冷却结束时直接扣除目标生命，怪物近战也直接修改人物或建筑生命。`BattleHUDViewComp` 只同步最终生命值，因此玩家看不到伤害来源和命中时机，表现为生命与护盾无提示下降。

本次目标：

- 人物攻击生成可见弹丸，弹丸抵达目标后才扣血。
- 所有实际伤害都生成统一命中事件。
- 人物、怪物和战斗建筑受击时显示伤害数字与短暂闪烁。
- 命中表现与 `DamageResolver`、`VitalityRuntime` 的真实结算结果一致。
- 暂停和全地图界面打开时，弹丸及反馈动画冻结。

本次不加入墙体碰撞、弹丸穿透、弹道散布、射失、暴击表现、枪口火焰图片或新的第三方依赖。

## 2. 方案选择

采用真实弹丸而不是纯视觉曳光：人物开火只生成弹丸，目标生命在弹丸命中前保持不变。弹丸追踪已锁定目标的位置，以保持自动战斗的稳定命中率。

没有选择完整弹道模拟，因为当前地图尚未提供弹丸阻挡层和动态碰撞查询；本次扩张到障碍碰撞会同时改变自动瞄准与关卡设计，超出“让伤害来源清晰可见”的目标。

## 3. 模拟模型

### 3.1 弹丸

新增 `BattleProjectile`：

```ts
export interface BattleProjectile extends WorldPoint {
    readonly id: string;
    readonly sourceId: string;
    readonly targetId: string;
    readonly speed: number;
    readonly baseDamage: number;
    readonly tags: readonly string[];
    remainingLifetime: number;
}
```

首版参数：

- 速度：`1400 世界单位/秒`。
- 最大存活：`1.2 秒`。
- 初始位置：人物当前位置，并沿人物到目标方向前移人物半径，避免从角色中心出现。
- 目标：生成时锁定的怪物 ID，不在飞行中切换目标。

`BattleSimulation.projectiles` 是当前存活弹丸的公共只读数组。模拟内部使用递增序号生成稳定 ID，例如 `projectile-1`。

### 3.2 弹丸更新

每帧按照以下规则更新：

1. 通过 `targetId` 查找仍为 `active` 的怪物。
2. 目标不存在或已死亡时，移除弹丸且不结算伤害。
3. 扣除 `remainingLifetime`；归零时移除弹丸且不结算伤害。
4. 计算本帧最大移动距离 `speed × dt`。
5. 如果到目标中心的距离不大于“本帧移动距离 + 目标半径”，则命中。
6. 命中时调用现有 `DamageResolver` 和 `VitalityRuntime`，生成命中事件，然后移除弹丸。
7. 未命中时朝目标当前坐标移动，因此能追踪移动目标。

弹丸不会写入地图寻路或碰撞系统，也不会成为怪物目标。

### 3.3 攻击时序

人物攻击冷却结束时执行 `spawnPlayerProjectile(target)`，不再直接调用 `applyResolvedDamage()`。

单帧更新顺序：

1. 人物移动。
2. 自动锁定与开火，可能生成弹丸。
3. 所有弹丸移动与命中结算。
4. 怪物移动与近战结算。
5. 如果人物在近战阶段倒地，清理人物移动和攻击状态。

新生成弹丸可在生成帧移动，但只在满足命中条件时扣血。

## 4. 命中事件

新增 `CombatHitEvent`：

```ts
export type CombatHitKind = "projectile" | "melee";

export interface CombatHitEvent extends WorldPoint {
    readonly id: string;
    readonly kind: CombatHitKind;
    readonly sourceId: string;
    readonly targetId: string;
    readonly amount: number;
    readonly shieldDamage: number;
    readonly healthDamage: number;
    readonly becameZero: boolean;
}
```

规则：

- `amount = shieldDamage + healthDamage`，只展示实际扣除值。
- 位置取目标命中时的世界坐标。
- 弹丸与怪物近战都走同一个事件创建方法。
- 被拒绝或实际伤害为 0 的结算不生成事件。
- `BattleSimulation.hitEvents` 在每次 `update()` 开始时清空，仅保存当前帧事件。
- 事件 ID 使用独立递增序号，HUD 用 ID 防止重复消费。

不使用 Oops 全局消息广播高频命中，避免跨页面事件残留。

## 5. HUD 表现

### 5.1 弹丸节点

`BattleHUDViewComp` 维护 `Map<string, Node>`：

- 模拟出现新弹丸时创建节点。
- 节点放在 `worldLayer`，每帧同步世界坐标。
- 模拟中不再存在的弹丸立即销毁节点。
- 页面销毁时由 `worldLayer` 一并清理。

弹丸使用 Cocos `Graphics` 绘制，不新增图片：

- 黄白色弹芯。
- 橙色短尾迹。
- 半透明外圈模拟轻微发光。
- 节点朝当前运动方向旋转，使尾迹方向正确。

### 5.2 伤害数字

HUD 消费当前帧 `hitEvents` 后创建世界空间伤害数字：

- 持续 `0.65 秒`。
- 从命中位置向上移动约 `64 世界单位`。
- 后半段逐渐淡出。
- 同一帧多次命中按事件序号左右错开，避免完全重叠。

颜色：

| 情况 | 颜色 |
|---|---|
| 人物伤害怪物 | 橙黄色 |
| 怪物只伤害人物护盾 | 青色 |
| 怪物伤害人物生命或击破护盾后溢出生命 | 红色 |
| 怪物伤害战斗建筑 | 橙红色 |

数字显示 `-实际伤害`。一次命中同时扣盾和扣血时只显示一个总数，以红色为主。

伤害数字拥有自己的表现状态对象，包含节点、初始位置、已存活时间和持续时间。怪物在同帧死亡并隐藏后，伤害数字仍播放到结束。

### 5.3 受击闪烁

HUD 为人物、每只怪物和路障维护命中闪烁剩余时间：

- 每次对应目标收到 `CombatHitEvent` 时设为 `0.12 秒`。
- 闪烁期间通过 `UIOpacity` 短暂降低整体透明度。
- 时间归零时恢复基础透明度。
- 人物和活动怪物基础透明度为 255。
- 活动路障基础透明度为 255，失效路障基础透明度为 110；闪烁不能覆盖失效状态。

怪物同帧死亡时允许先登记闪烁，但节点会按死亡规则隐藏；最后一次伤害数字继续显示。

## 6. 暂停语义

现有 `BattleHUDViewComp.update()` 在暂停或全地图打开时直接返回，因此：

- `BattleSimulation.update()` 不执行，弹丸停止移动。
- 命中事件不会产生。
- HUD 的伤害数字计时和闪烁计时也不更新。
- 恢复后从暂停前的状态继续。

不使用引擎 Tween，以避免 Tween 在页面暂停时继续运行；所有动画由 `deltaTime` 显式推进。

## 7. 文件边界

计划修改：

- `assets/script/game/battle/BattleSimulation.ts`
  - 新增 `BattleProjectile`、`CombatHitEvent`、弹丸生成、移动、命中与事件输出。
  - 人物攻击从即时伤害改为生成弹丸。
  - 怪物近战结算生成命中事件。
- `assets/script/game/battle/BattleHUDViewComp.ts`
  - 新增弹丸节点同步、伤害数字、受击闪烁和表现状态回收。
- `tests/unit/battle/BattleSimulation.test.mjs`
  - 验证命中前不扣血、命中只结算一次、目标死亡使弹丸失效、事件内容正确。
- `tests/integration/ui/BattleFlowBindings.test.mjs`
  - 验证 HUD 绑定弹丸、命中事件、数字反馈和闪烁。

不新增图片、Prefab、外部依赖或全局事件枚举。

## 8. 测试设计

### 8.1 弹丸测试

- 开火一帧后存在弹丸，目标生命未改变。
- 推进不足飞行时间，目标生命仍未改变。
- 推进到命中后，目标生命下降且弹丸移除。
- 同一弹丸只造成一次伤害。
- 目标在弹丸抵达前死亡，弹丸移除且不生成第二次伤害。
- 弹丸超过 `1.2 秒` 未命中时移除。

### 8.2 命中事件测试

- 弹丸命中生成 `kind=projectile` 事件。
- 怪物近战生成 `kind=melee` 事件。
- 事件的 `shieldDamage`、`healthDamage`、`amount` 与生命结算一致。
- 人物护盾未耗尽时，事件只包含护盾伤害。
- 归零命中正确设置 `becameZero=true`。
- 下一帧开始时旧事件清空。

### 8.3 HUD 与回归

- 静态集成测试确认 HUD 读取 `projectiles` 和 `hitEvents`。
- 确认存在弹丸节点表、伤害反馈列表、闪烁计时和显式 `deltaTime` 更新。
- `npm run test:battle` 全部通过。
- `npm run test:ui` 全部通过。
- `git diff --check` 无格式错误。

## 9. 完成标准

- 每次人物开火都有模拟层弹丸。
- 怪物生命只在弹丸抵达时变化。
- 每次实际伤害都有且只有一个命中事件。
- 人物、怪物和路障受伤均有伤害数字和受击闪烁。
- 暂停和全地图状态冻结模拟及反馈动画。
- 所有新增与既有自动化测试通过。
- 未引入新的资源文件或第三方依赖。
