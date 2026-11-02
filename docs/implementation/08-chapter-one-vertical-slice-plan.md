# 第一章纵向切片 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 把灰港废城七天、五类地点、六类敌人、两类精英、屠夫母体、两级方舟和一名幸存者整合为可从新存档完整通关的纵向切片。

**Architecture:** 所有首章内容使用前七份计划建立的配置与运行时接口。ChapterFlow 只编排天数、教学、地点、事件和夜战，不复制战斗、背包、方舟或怪物规则。

**Tech Stack:** Cocos Creator 3.8.8、Oops Framework、TypeScript、JSON 配置、Vitest、抖音开发者工具预览。

## Global Constraints

- 七天完整流程无开发者控制台命令也能通关。
- 每日只引入一个主要新系统或一个主要新敌人机制。
- 屠夫母体至少有两项白天行动可改变最终战。
- 纵向切片验收通过前不生产第二章最终资产。

---

## File Structure

- Create: assets/script/game/world/ChapterFlow.ts
- Create: assets/script/game/quest/QuestModule.ts
- Create: assets/script/game/survivor/SurvivorModule.ts
- Create: assets/bundle/config/game/ChapterGrayHarbor.json
- Create: assets/bundle/config/game/QuestGrayHarbor.json
- Create: assets/bundle/config/game/MonsterGrayHarbor.json
- Create: assets/bundle/config/game/LootGrayHarbor.json
- Create: assets/bundle/config/game/ArkTier1.json
- Create in Creator: gray harbor world, boss and story prefabs
- Test: tests/unit/world/ChapterFlow.test.ts
- Test: tests/integration/GrayHarborConfig.test.ts

### Task 1: 首章配置完整性

**Files:**
- Create: assets/bundle/config/game/ChapterGrayHarbor.json
- Create: assets/bundle/config/game/QuestGrayHarbor.json
- Create: assets/bundle/config/game/MonsterGrayHarbor.json
- Create: assets/bundle/config/game/LootGrayHarbor.json
- Create: assets/bundle/config/game/ArkTier1.json
- Test: tests/integration/GrayHarborConfig.test.ts

**Interfaces:**
- Produces: chapter_gray_harbor 的七天内容定义。

- [ ] **Step 1: 写配置失败测试**

    import { readFileSync } from "node:fs";

    function loadJson(path: string): any {
      return JSON.parse(readFileSync(path, "utf8"));
    }

    it("contains seven days and a guaranteed boss core", () => {
      const chapter = loadJson("assets/bundle/config/game/ChapterGrayHarbor.json");
      expect(chapter.days).toHaveLength(7);
      expect(chapter.days[6].night.bossId).toBe("boss_butcher_matriarch");
      expect(chapter.bossRewards.guaranteed).toContain("core_gray_harbor");
    });

    Run: yarn test tests/integration/GrayHarborConfig.test.ts
    Expected: FAIL because chapter configuration does not exist.

- [ ] **Step 2: 写七天配置**

    {
      "id": "chapter_gray_harbor",
      "days": [
        { "day": 1, "tutorial": ["move", "shoot", "loot", "return"], "night": { "horde": "horde_gh_01" } },
        { "day": 2, "tutorial": ["injury", "power"], "night": { "horde": "horde_gh_02" } },
        { "day": 3, "tutorial": ["craft", "equipment"], "night": { "horde": "horde_gh_03" } },
        { "day": 4, "tutorial": ["survivor", "nest"], "night": { "horde": "horde_gh_elite" } },
        { "day": 5, "tutorial": ["boss_intel"], "night": { "horde": "horde_gh_05" } },
        { "day": 6, "tutorial": ["ark_evolution"], "night": { "horde": "horde_gh_06" } },
        { "day": 7, "tutorial": ["boss"], "night": { "bossId": "boss_butcher_matriarch" } }
      ],
      "bossRewards": { "guaranteed": ["core_gray_harbor", "blueprint_ark_tracks"] }
    }

- [ ] **Step 3: 增加交叉引用校验**

    Verify every horde ID, monster ID, item ID, quest ID and Ark module ID exists in its registry. Verify every main quest has a reachable prerequisite chain.

- [ ] **Step 4: 运行测试并提交**

    Run: yarn test tests/integration/GrayHarborConfig.test.ts
    Expected: PASS.

    git add assets/bundle/config/game tests/integration/GrayHarborConfig.test.ts
    git commit -m "content: define gray harbor chapter"

### Task 2: 章节流、任务与幸存者

**Files:**
- Create: assets/script/game/world/ChapterFlow.ts
- Create: assets/script/game/quest/QuestModule.ts
- Create: assets/script/game/survivor/SurvivorModule.ts
- Test: tests/unit/world/ChapterFlow.test.ts

**Interfaces:**
- Produces: ChapterFlow.startDay()、completeDay()、canTravel()；QuestModule.advance()；SurvivorModule.assign()。

- [ ] **Step 1: 写失败测试**

    it("allows travel only after day seven boss completion", () => {
      const flow = new ChapterFlow(grayHarborConfig);
      for (let day = 1; day <= 6; day += 1) flow.completeDay({ bossDefeated: false });
      expect(flow.canTravel()).toBe(false);
      flow.completeDay({ bossDefeated: true });
      expect(flow.canTravel()).toBe(true);
    });

    Run: yarn test tests/unit/world/ChapterFlow.test.ts
    Expected: FAIL.

- [ ] **Step 2: 实现章节流**

    export class ChapterFlow {
      day = 1;
      private completed = false;
      constructor(readonly config: ChapterConfig) {}
      completeDay(result: { bossDefeated: boolean }): void {
        if (this.day === this.config.days.length) {
          this.completed = result.bossDefeated;
          return;
        }
        this.day += 1;
      }
      canTravel(): boolean { return this.completed; }
    }

- [ ] **Step 3: 实现任务命令与岗位**

    QuestModule advances explicit objective counters from GameEvent. SurvivorModule validates that one survivor occupies at most one post and applies the post modifier through immutable output values.

- [ ] **Step 4: 测试并提交**

    Run: yarn test tests/unit/world/ChapterFlow.test.ts
    Expected: PASS.

    git add assets/script/game/world/ChapterFlow.ts assets/script/game/quest assets/script/game/survivor tests/unit/world/ChapterFlow.test.ts
    git commit -m "feat: orchestrate chapter quests and survivors"

### Task 3: 灰港地图与五类地点

**Files:**
- Create in Creator: assets/bundle/game/world/gray-harbor.prefab
- Create in Creator: hospital, supermarket, police, factory and residential prefabs
- Create: assets/bundle/config/game/LocationGrayHarbor.json

**Interfaces:**
- Consumes: WorldController、location IDs、loot tables、quest triggers。

- [ ] **Step 1: 制作全章灰盒**

    Build main road, hospital, supermarket, police station, factory, residential block, rooftop route, underground shortcut and Ark return zone using metric-marked placeholder geometry.

- [ ] **Step 2: 连接地点配置**

    Every location entry declares id, sceneNode, resourceBias, enemyPool, lootTable, eventPool, shortestReturnSeconds and persistentChanges.

- [ ] **Step 3: 路线测试**

    From every primary location, record normal return time and warning return time. Required routes must remain reachable without random keys. No decision-free run segment may exceed 20 seconds.

- [ ] **Step 4: 提交**

    git add assets/bundle/game/world assets/bundle/config/game/LocationGrayHarbor.json
    git commit -m "content: build gray harbor exploration map"

### Task 4: 首章敌人、夜晚和屠夫母体

**Files:**
- Create in Creator: six monster prefabs and boss_butcher_matriarch.prefab
- Modify: assets/bundle/config/game/MonsterGrayHarbor.json
- Create: assets/script/game/monster/boss/ButcherMatriarchController.ts

**Interfaces:**
- Consumes: MonsterController、BossPhaseMachine、HordeDirector、ArkModule。

- [ ] **Step 1: 配置六类敌人与两类精英**

    Include walker, runner, brute, spitter, screamer and climber. Configure armored and frenzy affixes for chapter one. Assign one visual warning and one audio warning to every special attack.

- [ ] **Step 2: 实现屠夫母体机制**

    Phase 1 summons and charges front armor.
    Phase 2 changes lanes and targets weapon platforms.
    Phase 3 pressures the Ark core.
    If the player completed the wreck barrier quest, a charge collision calls addStagger with the configured bonus and exposes the back weakpoint.

- [ ] **Step 3: 七晚战斗验收**

    Play every night with baseline, low-upgrade and high-upgrade test profiles. Expected: new mechanics appear alone before mixed waves; night four is the first elite test; day seven boss can be defeated by at least three tested builds.

- [ ] **Step 4: 提交**

    git add assets/bundle/game/monster assets/script/game/monster/boss assets/bundle/config/game/MonsterGrayHarbor.json
    git commit -m "content: add gray harbor enemies and boss"

### Task 5: 端到端七天验收

**Files:**
- Create: tests/e2e/gray-harbor-checklist.md
- Modify: docs/douyin-build-notes.md

**Interfaces:**
- Validates the complete vertical slice.

- [ ] **Step 1: 自动回归**

    Run: yarn test && yarn typecheck:test
    Expected: zero failures and zero type errors.

- [ ] **Step 2: 新存档全流程**

    Start with cleared campaign storage. Complete all seven days without debug grants. Record day duration, route, resource income, repair cost, deaths, active build and boss result.

- [ ] **Step 3: 失败恢复**

    Test one day death, one night role down, one Ark core failure, one forced app background and one corrupted current snapshot. Expected: every path restores the documented safe state without duplicating resources.

- [ ] **Step 4: 抖音预览**

    Build the chapter for Douyin preview. Test touch controls, safe area, audio interruption, background/foreground, standard mode and power-saving mode on target devices.

- [ ] **Step 5: 提交验收记录**

    git add tests/e2e/gray-harbor-checklist.md docs/douyin-build-notes.md
    git commit -m "test: verify gray harbor vertical slice"

## Plan Completion Gate

The slice passes only when a clean save can finish seven days, defeat the boss, receive guaranteed rewards, migrate to the next chapter state, restart the app and continue with all equipment and Ark growth intact.
