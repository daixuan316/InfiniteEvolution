# InfiniteEvolutionDoomsdaySurvival

无限进化·末世生存 — Cocos Creator 3.8.8 + Oops Framework（`oops-game-kit`）

## 快速开始

1. 安装 [Cocos Creator 3.8.8](https://www.cocos.com/creator-download)
2. 若缺少框架插件，在项目根目录执行：
   - `update-oops-plugin-framework.bat`
   - `update-oops-plugin-excel-to-json.bat`（可选，表工具）
3. 用 Creator 打开本工程，运行 `main` 场景
4. 预期流程：Loading → 主界面占位（Hall）→「开始游戏」派发 `EnterBattle`

## 说明

- 模板来源：`oops-game-kit` 公开镜像（官方 Gitee 仓若不可用）
- 框架插件：`extensions/oops-plugin-framework`（GitHub `dgflash`）
- 横屏：`1334×750`，见 `settings/v2/packages/`
- 抖音构建预留：见 [docs/douyin-build-notes.md](docs/douyin-build-notes.md)
- 设计文档：`docs/superpowers/specs/2026-10-31-oops-game-kit-scaffold-design.md`

## 单局无缝无限探索

- 白天探索默认使用世界种子 `1907`，相同种子与区块坐标会重建相同的道路、建筑槽、城区类型和地标。
- 玩家跨越边缘时持续预加载周围 `5×5` 区块，仅让中心 `3×3` 区块参与敌人、掉落和事件模拟；远处区块会自动回收。
- 住宅区占绝大多数，社区商业区次之，医院作为稀有地标生成；共享边种子决定直路、T 字与十字连接，首批四向安全底图会在关闭出口叠加实体路障，保证画面与碰撞一致。
- 住宅、社区、工业、空地和医院使用不同的区块色调、边框与区域标签；道路和大型障碍采用与当前底图对应的 `14×8` 通行模板，画面可见道路会进入寻路网格，医院隔离带等实体会阻挡移动。
- 探索人物和感染体按96像素道路格重新缩放；感染体数量按离方舟区块距离从每区块1只增加到最多4只，生命值从1倍平滑增加并封顶3倍，攻击、速度与防御不随距离改变。
- 存档不保存完整地图，只保存世界种子以及已开启容器、已完成事件、已清除敌人等稀疏变化记录。
- 世界逻辑使用永久坐标，显示层使用整区块浮动原点；小地图和战术地图均以玩家为中心显示局部范围。

生成与分布压力测试：

```powershell
node --test tests/unit/world/InfiniteChunkGenerator.test.mjs
```

## 业务目录

```
assets/script/game/
  initialize/  启动与 Loading
  hall/        主界面
  battle/      横版战斗（占位）
  role/        角色（占位）
  evolve/      进化（占位）
  world/       关卡（占位）
  bag/         背包（占位）
  save/        存档（占位）
  account/     抖音登录（占位）
  common/      配置与单例
```
