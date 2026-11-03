# 庇护所等级 UI 与动态素材设计

> 日期：2026-11-03  
> 状态：依据已确认的方舟 UI、俯视像素视角与五阶段成长执行  
> 主视觉参考：`docs/design/assets/ui-main-gameplay-topdown-v1.png`

## 目标

补齐五个庇护所成长阶段的 UI 效果图和可由客户端动态拼装的方舟素材。效果图负责确认每一级的轮廓、信息层级和解锁节奏；透明素材负责后续升级、换装、受损、供电、过载、自动维修和生化进化时独立替换，避免把整辆方舟与全部状态烘焙成一张不可复用的图片。

## 五个等级

| 等级 | 稳定 ID | 策划阶段 | 视觉与功能重点 |
|---:|---|---|---|
| 1 | `modified-transport` | 改装运输车 | 单层短车体、暴露式能源管线、少量外挂槽、基础机枪与工坊 |
| 2 | `armored-tracked-fortress` | 装甲履带堡垒 | 双层装甲、连续履带、完整供电、更多顶部与侧面槽位 |
| 3 | `mobile-industrial-platform` | 移动工业平台 | 宽体平台、吊臂、重型炮座、雷达和自动维修无人机坞 |
| 4 | `biomechanical-ark` | 生化机械方舟 | 机械骨架与受控活体组织融合、洋红生化线路、污染管理 |
| 5 | `doomsday-mobile-citadel` | 末日移动城塞 | 多区段移动城塞、最大屋顶战斗区、终局核心和区域压制轮廓 |

升级后旧模块继续兼容。五级底盘只定义承载轮廓、固定核心区、履带和模块插槽，不把可替换炮塔、功能设施和状态提示永久画入底图。

## 交付结构

### 1. 等级 UI 效果图

每级一张 1334×750 横屏效果图，共 5 张。统一使用方舟布局/总览框架：

- 中央为正交高位俯视方舟，直接显示该等级可用槽位和模块密度。
- 顶部保留资源、阶段与昼夜信息区；左侧为等级进度和模块分类；右侧为能源、装甲、噪音、污染与解锁预览；底部为稳定导航入口。
- UI 采用深蓝黑底、2–3 px 科技青描边、白色图标、琥珀选择、红色危险和洋红生化语义。
- 图片不承担正式文字、动态数字、多语言或触控逻辑；正式信息由 Cocos Creator 组件叠加。

### 2. 方舟等级底图

一个 2×3 透明母版切出 5 张 768×512 RGBA 底图，第六格为空白校准格。每张底图只含车体、履带、固定甲板、核心基座、插槽底座、梯口和轻量接地阴影，禁止烘焙 UI 框、人物、敌人、场景、射界或可替换模块。

### 3. 结构与功能模块

一个 4×4 透明母版，切出 16 张 256×256 RGBA：

1. `core-reactor`
2. `generator`
3. `battery-bank`
4. `workshop`
5. `storage`
6. `infirmary`
7. `purifier`
8. `radar`
9. `research-lab`
10. `crew-quarters`
11. `command-console`
12. `drone-repair-dock`
13. `crane`
14. `armor-panel`
15. `power-junction`
16. `hatch-ladder`

### 4. 防御与进化模块

一个 4×4 透明母版，切出 16 张 256×256 RGBA：

1. `machine-gun-turret`
2. `shotgun-turret`
3. `flame-turret`
4. `emp-turret`
5. `missile-rack`
6. `heavy-cannon`
7. `drone-platform`
8. `electric-fence-node`
9. `spike-barricade`
10. `shield-emitter`
11. `lure-beacon`
12. `regenerative-armor`
13. `hunter-gland`
14. `sensory-organ`
15. `electric-sac`
16. `symbiosis-pod`

### 5. 交互与状态覆盖层

一个 4×4 透明母版，切出 16 张 256×256 RGBA：

1. `selected`
2. `placement-valid`
3. `placement-invalid`
4. `locked`
5. `upgrade-ready`
6. `powered`
7. `unpowered`
8. `overloaded`
9. `damaged`
10. `critical`
11. `offline`
12. `auto-repair`
13. `parasite`
14. `bio-unstable`
15. `adjacency-bonus`
16. `range-sector`

覆盖层只画图形语义，不带文字。耐久百分比、倒计时、等级、数量、供电数值和维修队列由程序绘制。夜间维修只表现为无人机、光束和维修覆盖层，不展示角色手动维修。

## 技术规范

- 引擎：Cocos Creator 3.8.8 + Oops Framework。
- 画面：正交高位俯视 2D 精细像素；可见方舟顶部结构；不使用等距菱形、侧视、天空、地平线或 3A 写实材质。
- 像素处理：母版是生成源，切片、尺寸、命名和预览由 PowerShell + System.Drawing 确定性完成；缩放使用最近邻。
- 方舟底图：768×512 RGBA，透明，统一中心与底部履带基线。
- 模块与覆盖层：256×256 RGBA，透明，统一中心锚点；默认安装基准为底部中心。
- UI 效果图：1334×750 RGB/RGBA，16:9 安全区构图。
- 运行时：静态面板使用九宫格；正式文字、数字、进度条、焦点、选中和触控热区由代码原生实现。

## 动态拼装规则

- 底盘、模块、覆盖层分开渲染，模块稳定 ID 在升级后不变。
- 插槽位置、允许类型、朝向和遮挡顺序由数据配置，不从图片像素推断。
- 状态覆盖层可叠加，但同一语义组只显示最高优先级：`critical > damaged`、`overloaded > powered > unpowered`、`placement-invalid > placement-valid`。
- 自动维修覆盖层位于损坏层上方；生化失控和寄生层高于普通供电层。
- 夜间玩家只在方舟顶部或内部作战；方舟外不放置玩家夜战站位。

## 验收标准

- 5 张等级 UI 效果图在缩略尺寸下仍能一眼区分成长阶段。
- 5 张底盘、32 张模块和 16 张覆盖层均拥有透明背景、稳定名称和机器清单，共 53 张可拼装成品。
- 五级轮廓逐级增大或增厚，但不通过透视角度变化伪造升级感。
- 所有成品无文字、无数字、无水印、无相邻格串图；UI 效果图中的文字仅作概念占位，不作为正式切图。
- 自动检查验证文件数量、尺寸、Alpha、唯一性和母版映射；生成来源与派生处理写入清单。

