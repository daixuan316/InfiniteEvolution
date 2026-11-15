# oops-game-kit 框架骨架 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用 oops-game-kit + 框架插件替换空工程，配置横屏/抖音预留，并落地 2D 横版末世生存业务目录与 Hall 首界面占位。

**Architecture:** 以 kit 为业务工程底包；Oops 核心以 `extensions/oops-plugin-framework` 插件形式引入。业务模块放在 `assets/script/game/` 下，通过 `GameUIConfig` / `GameEvent` 解耦。Demo 改为 Hall。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、oops-game-kit、oops-plugin-framework、oops-plugin-excel-to-json

## Global Constraints

- Creator 版本：3.8.8  
- 视角：2D 横版；项目横屏  
- 平台：抖音小游戏（仅构建预留）  
- 本阶段不做玩法、登录 SDK、热更新插件  
- 官方 Gitee kit 若 404：使用 `https://gitee.com/michnus/oops-game-kit.git`；插件优先 GitHub `dgflash/*`

---

### Task 1: 用 kit 替换空工程并安装插件

**Files:**
- Replace: 工程根目录（保留 `docs/`）
- Create/Update: `extensions/oops-plugin-framework`、`extensions/oops-plugin-excel-to-json`
- Modify: `package.json`（name/description/creator.version）
- Modify: `update-oops-plugin-*.bat` 远程地址（若指向不可用 Gitee）

**Interfaces:**
- Produces: 可打开的 Creator 工程 + 已安装框架插件

- [x] **Step 1:** 将现有 `docs/` 备份到临时目录；清空除 `.git` / `docs` 外的空工程内容（或旁路克隆后迁入）
- [x] **Step 2:** `git clone --depth 1 https://gitee.com/michnus/oops-game-kit.git` 到临时目录，拷贝内容到 `NewProject`（不覆盖 `docs/`、不引入 kit 的 `.git`）
- [x] **Step 3:** 修改 bat：framework → GitHub dgflash；excel → GitHub kada7 镜像
- [x] **Step 4:** 执行 framework 与 excel-to-json 安装脚本；`npm install` 于插件目录
- [x] **Step 5:** 更新 `package.json`：`name=InfiniteEvolutionDoomsdaySurvival`，`creator.version=3.8.8`
- [x] **Step 6:** 验证 `extensions/oops-plugin-framework` 存在且含 `package.json`
- [ ] **Step 7:** Commit（待用户明确要求后再提交）

### Task 2: 横屏、config、抖音构建预留

**Files:**
- Modify: `settings/v2/packages/project.json`（或 kit 内等价项目设置）
- Modify: `assets/resources/config/config.json`（路径以 kit 实际为准）
- Create: `docs/douyin-build-notes.md`（抖音构建预留说明）

- [ ] **Step 1:** 设置横屏与设计分辨率 1334×750（按 kit 已有字段改）
- [ ] **Step 2:** 更新 config 中项目名/版本/frameRate=60
- [ ] **Step 3:** 写抖音构建预留说明（包名占位、横屏、后续接登录点）
- [ ] **Step 4:** Commit：`chore: landscape and douyin build placeholders`

### Task 3: 业务目录骨架与占位模块

**Files:**
- Create: `assets/script/game/{account,hall,battle,role,evolve,world,bag,save}/` 下各 `index.ts` 或 `README` 占位 + 最小 Comp 壳
- Create: 资源占位目录 `assets/resources/gui/hall`、`gui/battle`、`game/battle`、`game/role`、`config/game`（路径对齐 kit）
- Modify: `GameEvent.ts`、`GameUIConfig.ts`

**Interfaces:**
- Produces: `UIID.Hall`、`GameEvent` 占位枚举；各模块空导出

- [ ] **Step 1:** 创建脚本/资源目录树
- [ ] **Step 2:** 增加 GameEvent / UIID 占位
- [ ] **Step 3:** Commit：`feat: add doomsday game module skeleton`

### Task 4: Hall 首界面替换 Demo

**Files:**
- Modify: `LoadingViewComp.ts`（或等价）：`oops.gui.open(UIID.Hall)`
- Create/Modify: Hall 界面脚本与预制（可复用 Demo 预制改名/简化）
- Isolate: Demo → `_demo` 或删除引用

- [ ] **Step 1:** 复制/改造 Demo 为 Hall 占位（标题 +「开始游戏」按钮）
- [ ] **Step 2:** Loading 结束后打开 Hall；「开始游戏」派发事件或打开 battle 空壳
- [ ] **Step 3:** 编辑器无法在本环境全自动跑时：用静态检查（UIID 引用、文件存在）验收
- [ ] **Step 4:** Commit：`feat: replace demo with hall placeholder entry`

### Task 5: 验收清单与收尾

- [ ] **Step 1:** 对照 spec 验收标准列 checklist 到 `docs/superpowers/specs/` 旁或 plan 末尾勾选
- [ ] **Step 2:** 最终 `git status` 确认无密钥；提交遗漏文档
