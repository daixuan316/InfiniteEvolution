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
