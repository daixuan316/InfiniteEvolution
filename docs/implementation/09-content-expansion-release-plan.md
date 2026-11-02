# 后续章节、长期玩法与发布 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 在首章纵向切片通过后，用相同数据管线完成第二至五章、三个结局、远征与高危区，并完成性能、存档迁移和抖音发布验收。

**Architecture:** 后续章节优先增加配置和资产，只在出现无法表达的机制时扩展通用接口。远征重用章节、地点、尸潮和奖励定义，通过规则组合生成路线，不复制主线内容。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Oops Framework、Vitest、抖音开发者工具。

## Global Constraints

- 第一章纵向切片未通过不得开始本计划。
- 每章规则必须同时影响白天探索和夜晚防守。
- 新增内容必须通过稳定 ID、交叉引用和本地化校验。
- Beta 后停止新增大型系统，只接受修复、平衡和低风险体验调整。

---

## File Structure

- Create: chapter 2–5 JSON under assets/bundle/config/game
- Create: chapter 2–5 world, monster, boss and presentation assets
- Create: assets/script/game/ending/EndingResolver.ts
- Create: assets/script/game/expedition/ExpeditionGenerator.ts
- Create: assets/script/game/performance/QualityProfile.ts
- Create: tests/integration/ChapterCoverage.test.ts
- Create: tests/unit/ending/EndingResolver.test.ts
- Create: tests/unit/expedition/ExpeditionGenerator.test.ts
- Create: tests/e2e/release-checklist.md

### Task 1: 第二章腐雨工业区

**Files:**
- Create: assets/bundle/config/game/ChapterAcidIndustrial.json
- Create: assets/bundle/config/game/WeatherAcidRain.json
- Create: assets/script/game/world/effects/AcidRainRule.ts
- Create in Creator: industrial world and Acid Rain Colossus assets
- Test: tests/integration/ChapterAcidIndustrial.test.ts

**Interfaces:**
- Produces: acid rain exposure、purifier safe zones、corrosion damage。

- [ ] **Step 1: 写规则失败测试**

    it("purifier coverage prevents acid corrosion", () => {
      const rule = new AcidRainRule();
      expect(rule.tick({ exposed: true, purifierActive: true }, 10).corrosion).toBe(0);
      expect(rule.tick({ exposed: true, purifierActive: false }, 10).corrosion).toBeGreaterThan(0);
    });

    Run: yarn test tests/integration/ChapterAcidIndustrial.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现共享环境规则接口**

    export interface ChapterEnvironmentRule {
      applyDay(context: DayEnvironmentContext, dt: number): EnvironmentResult;
      applyNight(context: NightEnvironmentContext, dt: number): EnvironmentResult;
    }

    AcidRainRule applies pollution and armor corrosion during day exposure, then applies module corrosion outside purifier coverage at night.

- [ ] **Step 3: 完成七天内容和 BOSS**

    Configure acid weather forecasts, industrial locations, elemental equipment, purifier repair quests, two new enemy roles and Acid Rain Colossus phases.

- [ ] **Step 4: 验收与提交**

    Run all tests and complete chapter two with three builds.

    git add assets/script/game/world/effects assets/bundle/config/game assets/bundle/game tests/integration/ChapterAcidIndustrial.test.ts
    git commit -m "content: add acid industrial chapter"

### Task 2: 第三至五章

**Files:**
- Create: ChapterFloodedMetro.json
- Create: ChapterHiveLab.json
- Create: ChapterZeroZone.json
- Create shared environment rules and chapter assets
- Test: tests/integration/ChapterCoverage.test.ts

**Interfaces:**
- Produces: conductive water、underground detection、hallucination、parasite control、final adaptation。

- [ ] **Step 1: 写章节覆盖测试**

    it.each([
      ["chapter_flooded_metro", 8],
      ["chapter_hive_lab", 9],
      ["chapter_zero_zone", 10]
    ])("%s has the required day count and boss", (id, days) => {
      const chapter = loadChapter(id);
      expect(chapter.days).toHaveLength(days);
      expect(chapter.days[days - 1].night.bossId).toBeTruthy();
    });

- [ ] **Step 2: 先完成三个章节灰盒**

    Implement every environment rule with placeholder art, verify day/night interaction, route reachability and boss counter quests before final art production.

- [ ] **Step 3: 按章节顺序替换最终内容**

    Finish Flooded Metro, then Hive Lab, then Zero Zone. For each chapter run config validation, seven-or-more-day playthrough, boss failure recovery, performance capture and save restart before starting the next.

- [ ] **Step 4: 提交每章独立提交**

    git commit -m "content: add flooded metro chapter"
    git commit -m "content: add hive lab chapter"
    git commit -m "content: add zero zone chapter"

### Task 3: 三个结局

**Files:**
- Create: assets/script/game/ending/EndingResolver.ts
- Create: assets/bundle/config/game/Endings.json
- Test: tests/unit/ending/EndingResolver.test.ts

**Interfaces:**
- Produces: resolveEnding(state, finalChoice): EndingId。

- [ ] **Step 1: 写失败测试**

    it("selects coexistence when research and survivor requirements are met", () => {
      expect(resolveEnding({
        research: ["bio_control"],
        survivorArcs: ["scientist_complete"],
        finalChoice: "coexist"
      })).toBe("ending_coexist");
    });

    Run: yarn test tests/unit/ending/EndingResolver.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现显式条件**

    export function resolveEnding(state: EndingState): EndingId {
      if (state.finalChoice === "purify") return "ending_purify";
      if (state.finalChoice === "dominate" && state.research.includes("hive_control")) return "ending_dominate";
      if (state.finalChoice === "coexist"
        && state.research.includes("bio_control")
        && state.survivorArcs.includes("scientist_complete")) return "ending_coexist";
      return "ending_purify";
    }

- [ ] **Step 3: 测试全部组合并提交**

    Run: yarn test tests/unit/ending/EndingResolver.test.ts
    Expected: all ending cases pass.

    git add assets/script/game/ending assets/bundle/config/game/Endings.json tests/unit/ending
    git commit -m "feat: resolve explicit campaign endings"

### Task 4: 远征与高危区

**Files:**
- Create: assets/script/game/expedition/ExpeditionGenerator.ts
- Create: assets/bundle/config/game/ExpeditionRules.json
- Test: tests/unit/expedition/ExpeditionGenerator.test.ts

**Interfaces:**
- Produces: generateExpedition(seed, unlockedContent): ExpeditionRoute。

- [ ] **Step 1: 写失败测试**

    it("generates the same valid route for the same seed", () => {
      const a = generateExpedition(42, unlockedContent);
      const b = generateExpedition(42, unlockedContent);
      expect(a).toEqual(b);
      expect(a.nodes[0].difficulty).toBeLessThanOrEqual(a.nodes[a.nodes.length - 1].difficulty);
    });

    Run: yarn test tests/unit/expedition/ExpeditionGenerator.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现种子路线**

    Generate a route from unlocked chapter locations, prevent mutually exclusive environment rules, place rest nodes before bosses and use a rising sawtooth difficulty curve.

- [ ] **Step 3: 实现高危区固定词缀**

    High-risk zones load an authored modifier set and reward table. Rewards provide cosmetics, side-grade modules and build variants rather than mandatory vertical power.

- [ ] **Step 4: 测试并提交**

    Run 1000 seeds and assert reachability, boss placement, rest placement and modifier compatibility.

    git add assets/script/game/expedition assets/bundle/config/game/ExpeditionRules.json tests/unit/expedition
    git commit -m "feat: add deterministic expedition routes"

### Task 5: 质量档位与性能

**Files:**
- Create: assets/script/game/performance/QualityProfile.ts
- Create: assets/bundle/config/game/QualityProfiles.json
- Create: tests/performance/horde-profile.md

**Interfaces:**
- Produces: applyQualityProfile("standard" | "power_saver")。

- [ ] **Step 1: 定义不改变数值的质量配置**

    export interface QualityProfile {
      targetFps: 30 | 60;
      maxDamageNumbers: number;
      maxCorpses: number;
      particleScale: number;
      parallaxLayers: number;
      aiFarTickSeconds: number;
    }

- [ ] **Step 2: 压力场景**

    Create a repeatable maximum horde scene with the largest supported active count, all warning types, Ark weapons, weather and boss effects. Capture median frame time, 95th percentile frame time, memory and audio voices.

- [ ] **Step 3: 设备验收**

    Standard profile targets stable 60 FPS on reference devices. Power saver targets stable 30 FPS on low-end devices. Verify both profiles produce identical damage, spawn and reward results for the same seed.

- [ ] **Step 4: 提交**

    git add assets/script/game/performance assets/bundle/config/game/QualityProfiles.json tests/performance
    git commit -m "perf: add mobile quality profiles"

### Task 6: 发布与存档迁移

**Files:**
- Create: tests/e2e/release-checklist.md
- Modify: docs/douyin-build-notes.md
- Add migration tests under tests/unit/save

**Interfaces:**
- Validates release candidate and upgrade path.

- [ ] **Step 1: 迁移旧存档**

    Add fixtures for every released schemaVersion. Run migrateSave, load the result, save again and compare stable player progression fields.

- [ ] **Step 2: 全流程发布候选验收**

    Complete one clean campaign, one migrated campaign, one recovery from corrupted current snapshot, one background interruption during every phase and one low-storage write failure.

- [ ] **Step 3: 抖音构建验收**

    Build in Cocos Creator 3.8.8, open the result in Douyin Developer Tools, verify orientation, safe area, loading, touch, audio, background recovery, storage, package split and performance profiles.

- [ ] **Step 4: 冻结检查**

    Run:

        yarn test
        yarn typecheck:test

    Expected: zero failures. Review the release checklist and confirm no main-story blocker, save corruption, inaccessible UI or uncounterable adaptation remains.

- [ ] **Step 5: 提交**

    git add tests/e2e/release-checklist.md tests/unit/save docs/douyin-build-notes.md
    git commit -m "release: verify campaign and douyin build"

## Plan Completion Gate

Release only after all five chapters and three endings are reachable, every released save fixture migrates, standard and power-saving profiles meet their targets, and the Douyin build passes foreground/background, storage, touch, audio and safe-area checks.
