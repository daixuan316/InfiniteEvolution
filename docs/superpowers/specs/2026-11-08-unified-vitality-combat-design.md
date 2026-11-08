# 统一生命与战斗伤害系统设计

**日期：** 2026-11-08  
**项目：** 无限进化·末世生存  
**引擎：** Cocos Creator 3.8.8、TypeScript、Oops Framework

## 1. 目标与范围

为人物、怪物、战斗建筑和方舟模块提供同一套生命、护盾、受伤、归零和恢复规则，并把首个可玩的伤害循环接入现有医院城区战斗页。

本次包含：

- 人物、怪物、战斗建筑和方舟模块共用的生命核心。
- 统一伤害请求、伤害计算和伤害结果。
- 人物护盾优先承伤，剩余伤害扣除生命。
- 人物自动攻击、怪物近战攻击和独立攻击间隔。
- 怪物死亡、人物倒地、建筑失效与维修。
- 医院地图中的默认防御路障，用于直接验收建筑受击与失效。
- 战斗 HUD 的人物、怪物和路障生命表现。
- 纯规则单元测试、战斗模拟集成测试和现有 UI 回归测试。

本次不包含：完整建造放置、建造资源消耗、建造 UI、掉落结算、复活流程、复杂元素异常或方舟供电/生产系统本身。这些系统以后通过本设计的接口接入。

## 2. 现有工程契约

| 契约 | 已验证证据与采用方式 |
|---|---|
| 构建与测试 | `package.json` 固定 Cocos Creator 3.8.8；`npm run test:battle` 运行 `tests/unit/battle/*.test.mjs`；`npm run test:ui` 包含战斗与 UI 回归。 |
| 生命周期 | `BattleHUDViewComp.onLoad/update/onDestroy` 创建、更新并释放战斗页输入与全局事件监听。纯规则状态由 `BattleSimulation` 持有。 |
| 时间与输入 | `BattleHUDViewComp.update(deltaTime)` 驱动 `BattleSimulation.update(deltaTime)`；模拟将单帧时间限制在 0–0.1 秒。键盘、摇杆和触摸输入只写入模拟。 |
| 状态与表现 | `BattleSimulation` 是引擎无关的 TypeScript 状态层；`BattleHUDViewComp` 将状态同步到 Cocos 节点、动画、血条和小地图。 |
| 事件与导航 | Oops `oops.message` 与 `GameEvent` 负责页面级暂停/恢复/离开；高频生命变化不发送全局事件，而由模拟状态和一次性结算结果驱动。 |
| 方舟耐久 | `docs/implementation/05-mobile-ark-plan.md` 已规定模块归零后 `operational=false`、不永久销毁、可维修。本设计把该语义适配到统一生命核心。 |

## 3. 方案选择

采用“纯规则核心 + 场景适配器”。不使用人物、怪物和建筑的继承树，也不在战斗模拟和方舟系统中分别实现两套扣血逻辑。

选择理由：

- 生命与伤害规则可在 Node 测试中独立验证，不依赖 Cocos 节点。
- 不同实体只通过归零策略表现差异，数值边界和维修规则保持一致。
- 战斗 HUD、音效、存档和以后加入的 Boss 阶段可以消费稳定的结算结果。
- 避免为尚未实现的完整建造与方舟生产系统提前引入复杂框架。

## 4. 核心模型

### 4.1 生命状态

`VitalityRuntime` 持有：

- `currentHealth`、`maxHealth`。
- `currentShield`、`maxShield`；不使用护盾的实体均为 0。
- `state`：`active | downed | dead | disabled`。
- `zeroState`：该实体生命首次归零时进入的状态。

构造时所有数值必须有限且范围合法。当前值被约束到 `[0, max]`。最大生命必须大于 0，最大护盾不得小于 0。

实体语义：

| 实体 | 初始状态 | 生命归零状态 | 归零后的处理 |
|---|---|---|---|
| 人物 | `active` | `downed` | 停止移动、翻滚、疾跑和自动攻击，保留节点。 |
| 怪物 | `active` | `dead` | 停止 AI、攻击和寻路，不再成为目标；表现层隐藏节点和血条。 |
| 战斗建筑 | `active` | `disabled` | 停止战斗功能与仇恨吸引，保留节点供维修。 |
| 方舟模块 | `active` | `disabled` | 映射为 `operational=false`，不永久删除，可维修。 |

### 4.2 伤害请求

`DamageRequest` 包含：

- `sourceId`、`targetId`。
- `baseDamage`。
- `defense`。
- `skillMultiplier`，默认 1。
- `additiveBonuses`，同类加成先相加。
- `criticalMultiplier`、`weakpointMultiplier`，默认 1。
- `tags`，用于保留物理、近战、远程、建筑等扩展信息，但首版不加入元素异常。

`DamageResolver` 使用公式：

```text
raw = baseDamage
    × skillMultiplier
    × (1 + sum(additiveBonuses))
    × criticalMultiplier
    × weakpointMultiplier

reduction = defense / (defense + 100)
finalDamage = round(raw × (1 - reduction))
```

成功命中造成至少 1 点伤害。任何非有限值、负基础伤害、负防御、非正倍率或非法加成都会返回拒绝结果，不改变目标状态。

### 4.3 生命结算

`VitalityRuntime.applyDamage(amount)` 按以下顺序执行：

1. 拒绝非法伤害或已非 `active` 的目标。
2. 护盾吸收伤害，超出部分扣除生命。
3. 将生命限制在 0 以上。
4. 仅在首次到达 0 时切换到 `zeroState`。
5. 返回不可变的 `DamageResult`。

`DamageResult` 至少包含：

- `accepted` 和可选的拒绝原因。
- `requestedDamage`、`shieldDamage`、`healthDamage`。
- `remainingHealth`、`remainingShield`、`healthRatio`、`shieldRatio`。
- `becameZero`：仅首次归零为 `true`。
- `state`。

对已倒地、死亡或失效实体重复伤害返回拒绝，且不得再次触发归零结果。

### 4.4 恢复与维修

- `heal(amount)` 只服务人物和以后可能加入的可治疗怪物，不恢复护盾，不允许让 `dead` 或 `disabled` 实体重新激活。
- `restoreShield(amount)` 只恢复护盾，不超过最大值。
- `repair(amount)` 服务战斗建筑和方舟模块；只要修复后的生命大于 0，就将 `disabled` 恢复为 `active`。
- 所有恢复输入都必须是有限正数；非法输入不改变状态。

## 5. 战斗模拟集成

### 5.1 实体数据

`BattleActor` 增加只读战斗配置和可变 `VitalityRuntime`。怪物额外持有攻击伤害、攻击间隔和攻击冷却。战斗建筑由独立的 `BattleStructure` 表示，不塞入角色继承体系。

首版平衡值：

| 实体 | 生命 | 护盾 | 防御 | 攻击 |
|---|---:|---:|---:|---|
| 人物 | 420 | 180 | 20 | 35 基础伤害，每 0.35 秒一次 |
| Walker | 90 | 0 | 5 | 18 基础伤害，每 1.0 秒一次 |
| Runner | 70 | 0 | 0 | 12 基础伤害，每 0.55 秒一次 |
| Mutant | 130 | 0 | 12 | 24 基础伤害，每 1.1 秒一次 |
| Brute | 360 | 0 | 25 | 42 基础伤害，每 1.4 秒一次 |
| 默认路障 | 600 | 0 | 30 | 无攻击能力 |

这些值是当前演示关的确定性默认值，不建立外部配置表；以后数据驱动改造只需替换构造配置。

### 5.2 人物攻击

- 只有 `active` 人物可以移动、翻滚、疾跑和自动攻击。
- 自动锁定只考虑状态为 `active` 且处于射程内的怪物。
- 人物攻击冷却归零且存在有效目标时，生成 `DamageRequest` 并立即结算。
- 怪物归零后，在同一模拟更新内退出有效目标集合；公共怪物列表保留固定数组以维持表现索引，但所有查询提供 `activeEnemies` 视图，表现层隐藏死亡项。
- 当前攻击动画仍由 `playerAutoAttacking` 驱动，不新增弹道系统。

### 5.3 怪物攻击与目标

- 怪物只在 `active` 时寻路和攻击。
- 每只怪物拥有独立冷却；处于攻击范围但冷却未结束时不重复伤害。
- 怪物优先选择近距离内仍为 `active` 的战斗建筑；没有合适建筑时追击人物。
- 默认路障放在医院地图中已验证可通行、靠近主要接敌路线的位置。首版不把路障写入网格障碍，不改变现有寻路可达性；它是可被攻击的近距离目标，而不是动态导航阻挡物。
- 建筑失效后立即退出目标选择；怪物重新选择人物或其他有效建筑。
- 人物倒地后怪物停止对人物造成后续伤害；本次不实现失败结算或复活倒计时。

### 5.4 建筑维修入口

`BattleSimulation.repairStructure(id, amount)` 查找结构并调用统一核心的 `repair`。它用于测试、调试和以后建造 UI 的接入。本次 HUD 不增加资源消耗或维修按钮。

## 6. 方舟模块适配

`ArkModuleVitalityAdapter` 负责在统一核心与方舟状态之间转换：

- 用模块 `durability/maxDurability` 创建不带护盾、`zeroState=disabled` 的 `VitalityRuntime`。
- 伤害后输出新的 `durability`、`operational` 和 `destroyed=false`。
- 维修后生命大于 0 时输出 `operational=true`。
- 适配器不管理维修费用、每日上限、供电或生产，只保证生命语义一致。

该适配器是纯函数边界，不让方舟存档直接序列化运行时类实例；存档仍保存普通数据对象。

## 7. HUD 与表现

- 人物生命、护盾文本和进度条改为读取模拟真实状态。
- 每个怪物血条读取对应生命比例，不再使用硬编码演示比例。
- 死亡怪物的节点、动画、血条和小地图标记停止显示。
- 路障创建独立节点和耐久条；失效后保留半透明外观及“已失效”标签。
- 人物倒地后显示明确提示，人物动画停止进入攻击或移动状态。
- 现有摄像机、路径绘制、输入清理和暂停逻辑保持不变。

高频生命变化不通过全局 Oops 事件广播，避免每次攻击制造跨模块消息。`DamageResult` 和模拟状态是首版唯一事实来源；未来音效或飘字可消费模拟维护的一次性战斗事件队列，但本次不预建该队列。

## 8. 文件结构

计划新增：

- `assets/script/game/combat/Vitality.ts`
- `assets/script/game/combat/DamageResolver.ts`
- `assets/script/game/shelter/model/ArkModuleVitalityAdapter.ts`
- 对应的 Cocos `.meta` 文件
- `tests/unit/combat/Vitality.test.mjs`
- `tests/unit/combat/DamageResolver.test.mjs`
- `tests/unit/shelter/ArkModuleVitalityAdapter.test.mjs`

计划修改：

- `assets/script/game/battle/BattleSimulation.ts`
- `assets/script/game/battle/BattleHUDViewComp.ts`
- `tests/unit/battle/BattleSimulation.test.mjs`
- `package.json`，让战斗测试命令包含新的纯规则测试目录；若现有命令可直接覆盖则不修改。

`BattleModule.ts` 本次不承载纯规则实现，避免引入第二个战斗状态所有者。

## 9. 错误处理与不变量

- 所有生命、伤害、治疗和维修数值都必须有限。
- 生命和护盾永远不小于 0，也不超过各自最大值。
- 防御不能为负，倍率必须为正。
- 同一实体只会发生一次首次归零转换，除非建筑经维修重新激活后再次归零。
- 怪物死亡后不得继续寻路、攻击或成为人物目标。
- 人物倒地后不得继续移动、翻滚或攻击。
- 失效建筑不得继续吸引仇恨；维修恢复后可再次成为目标。
- 方舟模块永远输出 `destroyed=false`，归零只代表停机。

## 10. 测试与验收

### 10.1 单元测试

- 护盾完整吸收与伤害溢出到生命。
- 生命归零和 `becameZero` 仅触发一次。
- 非法伤害、治疗和维修不改变状态。
- 治疗、护盾恢复和维修都遵守上限。
- 失效建筑维修后重新激活并可再次受伤。
- 伤害公式的同类增伤、防御递减和最小伤害。
- 方舟模块归零停机、保持 `destroyed=false`、维修恢复工作。

### 10.2 战斗模拟测试

- 人物持续自动攻击并最终杀死射程内怪物。
- 死亡怪物不再被锁定、寻路、攻击或出现在有效怪物视图。
- 怪物按各自间隔攻击，不发生逐帧扣血。
- 怪物可选择并击毁默认路障，随后转向人物。
- 路障维修后重新成为有效目标。
- 人物倒地后移动、翻滚和攻击全部失效。
- 现有移动、碰撞、寻路、疾跑、翻滚和攻击动画状态测试继续通过。

### 10.3 UI 与手动验收

- 运行 `npm run test:battle`。
- 运行 `npm run test:ui`。
- 在 Cocos Creator 3.8.8 打开主场景进入医院战斗页。
- 观察人物自动攻击、怪物血条下降和死亡隐藏。
- 让怪物攻击路障，确认耐久下降、归零失效且节点保留。
- 调用调试维修入口，确认路障恢复并可再次受击。
- 让人物承伤，确认先扣护盾再扣生命，归零后显示倒地且不能继续操作。

## 11. 完成标准

以下条件全部满足才视为完成：

- 四类实体使用同一个生命运行时和伤害结算路径。
- 人物与怪物形成可运行、带攻击间隔的双向伤害循环。
- 战斗建筑可受击、失效、维修并重新进入目标选择。
- 方舟模块通过适配器复用同一核心且保持非永久摧毁规则。
- HUD 展示真实生命状态，没有硬编码怪物血条。
- 新增测试与现有战斗/UI 测试全部通过。
- 未覆盖或覆盖用户已有的无关工作区改动。
