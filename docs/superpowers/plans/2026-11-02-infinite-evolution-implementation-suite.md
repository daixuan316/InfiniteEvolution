# 《无限进化：末日方舟》分阶段 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 按依赖顺序执行九份独立实施计划，交付五章完整的横屏 2D 末日生存游戏。

**Architecture:** 纯 TypeScript 规则层与 Cocos 表现层分离，所有跨系统引用使用稳定 ID；Oops Framework 负责资源、事件、GUI、音频和本地存储接入。先完成可测试的规则和首章纵向切片，再扩展内容。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Oops Framework、Vitest 2.1.9、yarn、抖音开发者工具。

## Global Constraints

- 横屏参考分辨率 1334×750。
- 自动瞄准射击，普通弹药无限。
- 装备、角色、资源和方舟成长跨章节保留。
- 纯规则文件不得导入 cc。
- 每个任务先验证失败，再实现并验证通过。
- 第一章纵向切片通过前，不开始第二至五章最终资产生产。

---

## 执行清单

- [ ] 执行 [基础设施、配置与存档](../../implementation/01-foundation-save-plan.md)。
- [ ] 执行 [角色战斗](../../implementation/02-player-combat-plan.md)。
- [ ] 执行 [物品、装备、成长与经济](../../implementation/03-items-equipment-progression-plan.md)。
- [ ] 执行 [世界、昼夜与探索](../../implementation/04-world-day-cycle-plan.md)。
- [ ] 执行 [移动方舟](../../implementation/05-mobile-ark-plan.md)。
- [ ] 执行 [怪物、尸潮与 BOSS](../../implementation/06-monsters-horde-bosses-plan.md)。
- [ ] 执行 [UI、音频、引导与移动端](../../implementation/07-ui-audio-mobile-plan.md)。
- [ ] 执行 [第一章纵向切片](../../implementation/08-chapter-one-vertical-slice-plan.md)。
- [ ] 执行 [后续章节、长期玩法与发布](../../implementation/09-content-expansion-release-plan.md)。

## 总验收

Run:

    yarn test
    yarn typecheck:test

Expected: zero failing tests and zero type errors.

Then execute the release checklist on Cocos Creator 3.8.8 and the Douyin Developer Tools. A release candidate is accepted only when all five chapters, three endings, save migration, foreground/background recovery, touch controls, safe areas, audio settings and both quality profiles pass.
