# oops-game-kit 框架 + 横版末世骨架设计

> 日期：2026-10-31  
> 状态：已批准  
> 项目：InfiniteEvolutionDoomsdaySurvival（无限进化·末世生存）

## 背景与目标

在 Cocos Creator **3.8.8** 空工程上，用 Oops 官方游戏模板建立可运行主工程，并搭好 **2D 横版 / 抖音小游戏** 向的业务目录骨架。本阶段**不实现**战斗、进化、登录等玩法。

## 已确认决策

| 项 | 选择 |
|----|------|
| 接入方式 | 官方游戏模板为主工程（非教程仓硬改） |
| 范围 | 框架 + 项目骨架 |
| 视角 | 2D 横版 |
| 目标平台 | 抖音小游戏（本阶段仅构建预留） |
| 方案 | A：`oops-game-kit` + `oops-plugin-framework` + 横版末世骨架 |

## 模板来源说明

官方文档推荐：

1. 克隆 `oops-game-kit` 作为游戏项目模板  
2. 执行 `update-oops-plugin-framework` 安装框架插件  
3. （本项目）同时安装 `oops-plugin-excel-to-json`；热更新插件本阶段不安  

实施时注意：`https://gitee.com/dgflash/oops-game-kit` 可能不可用（404）。可采用仍同步自官方的公开 fork（如 `michnus/oops-game-kit`），框架插件优先使用 GitHub：`dgflash/oops-plugin-framework`（及 excel 插件同理），并在更新脚本中改为可访问的远程地址。

`oops-framework` 教程工程**不作为**正式主工程底包。

## 工程替换与插件

1. 用 kit 内容替换当前空 `NewProject`（保留外层路径与后续自有 git 历史意图）  
2. 安装 `oops-plugin-framework`、`oops-plugin-excel-to-json` 到 `extensions/`  
3. 修改 `package.json`：`name` / `description`，`creator.version` 对齐 **3.8.8**  
4. Creator 打开工程：无致命报错，Loading → 首界面流程可跑  

本段不做：玩法逻辑、抖音真机发包、推翻 kit 目录约定。

## 横屏 / 抖音预留 / 目录骨架

### 适配与平台

- 项目设置：**横屏**；设计分辨率建议 `1334×750` 或 `1280×720`  
- 抖音小游戏：构建面板可选项与文档备注；**不**做登录 / 广告 / 提审  
- `config.json`：项目名与版本占位；`frameRate: 60`；服务器地址占位  

### 脚本目录（在 kit 的 `assets/script/game/` 上扩展）

```
game/
  common/          # config、table、GameEvent、GameUIConfig
  initialize/      # 启动与 Loading
  account/         # 抖音登录预留（空壳）
  hall/            # 主界面占位
  battle/          # 横版战斗壳
  role/            # 角色
  evolve/          # 无限进化
  world/           # 关卡/地图段落
  bag/             # 背包/物资
  save/            # 存档
```

### 资源目录

- `gui/hall`、`gui/battle` 等界面资源占位  
- `game/battle`、`game/role` 玩法资源占位  
- `config/game` 留给 excel→json  

### Demo 处理

Loading 完成后打开 **Hall（主界面占位）**；原 Demo 删除或迁入 `_demo` 且默认不进流程。

## 启动流程

```
Main
  → initialize 加载公共/必要资源
  → LoadingView
  → oops.gui.open(UIID.Hall)
  → 「开始游戏」可选：进入战斗空场景/空界面（无玩法）
```

## 模块边界

| 模块 | 职责 | 本阶段 |
|------|------|--------|
| initialize | 启动加载、首 UI | 改终点为 Hall |
| hall | 主界面、进战斗入口 | 占位 UI + 按钮 |
| battle | 横版战斗场景壳 | 空壳 |
| role / evolve | 角色与进化数据壳 | 空目录 + 占位脚本 |
| account | 抖音登录预留 | 空实现 |
| save / bag / world | 存档 / 背包 / 关卡 | 空目录 + 占位 |

解耦方式：`GameEvent` + `GameUIConfig`，避免模块硬引用。

## 验收标准

1. Creator 3.8.8 能打开工程，框架插件可用  
2. 运行：Loading → 主界面占位  
3. 横屏设置正确；目录与 UIID/事件占位齐全  
4. excel-to-json 已装；抖音构建有预留说明  
5. **无**完整战斗 / 进化 / 登录实现  

## 风险

- Gitee 官方仓不可用 → 使用公开 fork + GitHub 插件地址  
- 模板与 3.8.8 小版本差 → 以编辑器无红字、流程可跑为准  
- 插件未启用 → 检查 `extensions` 与扩展管理器  
