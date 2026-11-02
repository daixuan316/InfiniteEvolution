# 基础设施、配置与存档 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** 建立可测试的纯 TypeScript 领域基础、配置校验、版本化存档和 Oops Framework 存储适配。

**Architecture:** 规则代码放在各模块的 model 或 domain 目录，不导入 Cocos。存档仓库依赖 KeyValueStore 接口，运行时由 OopsStorageAdapter 绑定 oops.storage，单元测试使用内存实现。配置加载后先校验再提供给各系统。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Oops Framework、Vitest 2.1.9、yarn。

## Global Constraints

- 目标平台为抖音小游戏，横屏参考分辨率 1334×750。
- 保留现有 Cocos Creator 3.8.8 与 Oops Framework，不迁移引擎。
- 纯规则文件不得 import cc。
- 所有持久引用使用稳定 ID，不保存 Node、Component 或内存引用。
- 存档写入成功后才能替换上一份有效快照。

---

## File Structure

- Modify: package.json
- Create: vitest.config.ts
- Create: tsconfig.test.json
- Create: tests/helpers/MemoryStore.ts
- Create: assets/script/game/common/model/GameTypes.ts
- Create: assets/script/game/common/config/GameConfigRegistry.ts
- Create: assets/script/game/common/config/GameConfigValidator.ts
- Create: assets/script/game/save/model/SaveData.ts
- Create: assets/script/game/save/model/SaveMigrator.ts
- Create: assets/script/game/save/SaveRepository.ts
- Create: assets/script/game/save/OopsStorageAdapter.ts
- Modify: assets/script/game/save/SaveModule.ts
- Test: tests/unit/common/GameConfigValidator.test.ts
- Test: tests/unit/save/SaveRepository.test.ts
- Test: tests/unit/save/SaveMigrator.test.ts

### Task 1: Vitest 测试环境

**Files:**
- Modify: package.json:1
- Create: vitest.config.ts
- Create: tsconfig.test.json
- Create: tests/smoke.test.ts

**Interfaces:**
- Produces: yarn test、yarn test:watch、yarn typecheck:test。

- [ ] **Step 1: 安装固定测试依赖**

    yarn add -D vitest@2.1.9 @types/node@22.10.2

- [ ] **Step 2: 添加脚本**

    "scripts": {
      "test": "vitest run",
      "test:watch": "vitest",
      "typecheck:test": "tsc -p tsconfig.test.json --noEmit"
    }

- [ ] **Step 3: 创建 Vitest 配置**

    import { defineConfig } from "vitest/config";

    export default defineConfig({
      test: {
        environment: "node",
        include: ["tests/**/*.test.ts"],
        clearMocks: true
      }
    });

- [ ] **Step 4: 创建独立测试 TypeScript 配置**

    {
      "compilerOptions": {
        "target": "ES2020",
        "module": "ESNext",
        "moduleResolution": "Bundler",
        "strict": true,
        "esModuleInterop": true,
        "skipLibCheck": true,
        "types": ["vitest/globals", "node"]
      },
      "include": ["tests/**/*.ts", "assets/script/game/**/*.ts"],
      "exclude": ["assets/script/game/**/*ViewComp.ts", "assets/script/game/**/*Controller.ts"]
    }

- [ ] **Step 5: 写入并运行冒烟测试**

    import { describe, expect, it } from "vitest";

    describe("test harness", () => {
      it("runs TypeScript tests", () => {
        expect(1 + 1).toBe(2);
      });
    });

    Run: yarn test tests/smoke.test.ts
    Expected: 1 test passed.

- [ ] **Step 6: 提交**

    git add package.json yarn.lock vitest.config.ts tsconfig.test.json tests/smoke.test.ts
    git commit -m "test: add domain test harness"

### Task 2: 公共领域类型

**Files:**
- Create: assets/script/game/common/model/GameTypes.ts
- Test: tests/unit/common/GameTypes.test.ts

**Interfaces:**
- Produces: StableId、InstanceId、GamePhase、Result<T, E>、clamp。

- [ ] **Step 1: 写失败测试**

    import { describe, expect, it } from "vitest";
    import { clamp } from "../../../assets/script/game/common/model/GameTypes";

    describe("clamp", () => {
      it("limits values to the inclusive range", () => {
        expect(clamp(-1, 0, 10)).toBe(0);
        expect(clamp(6, 0, 10)).toBe(6);
        expect(clamp(12, 0, 10)).toBe(10);
      });
    });

    Run: yarn test tests/unit/common/GameTypes.test.ts
    Expected: FAIL because GameTypes does not exist.

- [ ] **Step 2: 写最小实现**

    export type StableId = string;
    export type InstanceId = string;

    export enum GamePhase {
      Hall = "hall",
      DayPrepare = "day_prepare",
      DayExplore = "day_explore",
      Dusk = "dusk",
      NightDefense = "night_defense",
      DayResult = "day_result",
      ChapterTravel = "chapter_travel"
    }

    export type Result<T, E extends string> =
      | { ok: true; value: T }
      | { ok: false; error: E };

    export function clamp(value: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, value));
    }

- [ ] **Step 3: 运行测试与类型检查**

    Run: yarn test tests/unit/common/GameTypes.test.ts && yarn typecheck:test
    Expected: PASS.

- [ ] **Step 4: 提交**

    git add assets/script/game/common/model/GameTypes.ts tests/unit/common/GameTypes.test.ts
    git commit -m "feat: add common domain types"

### Task 3: 配置注册与校验

**Files:**
- Create: assets/script/game/common/config/GameConfigRegistry.ts
- Create: assets/script/game/common/config/GameConfigValidator.ts
- Test: tests/unit/common/GameConfigValidator.test.ts

**Interfaces:**
- Consumes: StableId。
- Produces: GameConfigBundle、validateGameConfig(bundle): string[]、GameConfigRegistry.load(bundle)。

- [ ] **Step 1: 写失败测试**

    import { describe, expect, it } from "vitest";
    import { validateGameConfig } from "../../../assets/script/game/common/config/GameConfigValidator";

    describe("validateGameConfig", () => {
      it("rejects duplicate item IDs and missing recipe outputs", () => {
        const errors = validateGameConfig({
          items: [{ id: "item_scrap" }, { id: "item_scrap" }],
          recipes: [{ id: "recipe_gun", outputId: "item_missing", inputs: [] }]
        });
        expect(errors).toContain("duplicate item id: item_scrap");
        expect(errors).toContain("recipe recipe_gun output missing: item_missing");
      });
    });

    Run: yarn test tests/unit/common/GameConfigValidator.test.ts
    Expected: FAIL because validator does not exist.

- [ ] **Step 2: 定义配置接口与注册表**

    export interface ItemConfig { id: string; }
    export interface RecipeInputConfig { itemId: string; amount: number; }
    export interface RecipeConfig {
      id: string;
      outputId: string;
      inputs: RecipeInputConfig[];
    }
    export interface GameConfigBundle {
      items: ItemConfig[];
      recipes: RecipeConfig[];
    }

    export class GameConfigRegistry {
      private current: GameConfigBundle | null = null;

      load(bundle: GameConfigBundle): void {
        this.current = bundle;
      }

      get(): GameConfigBundle {
        if (!this.current) throw new Error("game config not loaded");
        return this.current;
      }
    }

- [ ] **Step 3: 实现确定性校验**

    export function validateGameConfig(bundle: GameConfigBundle): string[] {
      const errors: string[] = [];
      const itemIds = new Set<string>();
      for (const item of bundle.items) {
        if (itemIds.has(item.id)) errors.push("duplicate item id: " + item.id);
        itemIds.add(item.id);
      }
      for (const recipe of bundle.recipes) {
        if (!itemIds.has(recipe.outputId)) {
          errors.push("recipe " + recipe.id + " output missing: " + recipe.outputId);
        }
      }
      return errors;
    }

- [ ] **Step 4: 运行测试**

    Run: yarn test tests/unit/common/GameConfigValidator.test.ts
    Expected: PASS with 1 test.

- [ ] **Step 5: 提交**

    git add assets/script/game/common/config tests/unit/common/GameConfigValidator.test.ts
    git commit -m "feat: validate game configuration"

### Task 4: 存档结构与迁移

**Files:**
- Create: assets/script/game/save/model/SaveData.ts
- Create: assets/script/game/save/model/SaveMigrator.ts
- Test: tests/unit/save/SaveMigrator.test.ts

**Interfaces:**
- Produces: SAVE_SCHEMA_VERSION、SaveDataV1、createNewSave()、migrateSave(raw)。

- [ ] **Step 1: 写失败测试**

    import { describe, expect, it } from "vitest";
    import { migrateSave } from "../../../assets/script/game/save/model/SaveMigrator";
    import { SAVE_SCHEMA_VERSION } from "../../../assets/script/game/save/model/SaveData";

    describe("migrateSave", () => {
      it("adds phase and preserves currencies from version zero", () => {
        const result = migrateSave({ schemaVersion: 0, gold: 25 });
        expect(result.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
        expect(result.phase).toBe("hall");
        expect(result.currencies.gold).toBe(25);
      });
    });

    Run: yarn test tests/unit/save/SaveMigrator.test.ts
    Expected: FAIL because migration files do not exist.

- [ ] **Step 2: 定义首版存档**

    import { GamePhase } from "../../common/model/GameTypes";

    export const SAVE_SCHEMA_VERSION = 1;

    export interface SaveDataV1 {
      schemaVersion: 1;
      revision: number;
      chapterId: string;
      day: number;
      phase: GamePhase;
      currencies: Record<string, number>;
      inventory: unknown[];
      equipment: Record<string, string | null>;
      ark: { modules: unknown[]; layouts: unknown[] };
      world: Record<string, unknown>;
      survivors: unknown[];
      flags: Record<string, boolean>;
    }

    export function createNewSave(): SaveDataV1 {
      return {
        schemaVersion: 1,
        revision: 0,
        chapterId: "chapter_gray_harbor",
        day: 1,
        phase: GamePhase.Hall,
        currencies: { gold: 0 },
        inventory: [],
        equipment: {},
        ark: { modules: [], layouts: [] },
        world: {},
        survivors: [],
        flags: {}
      };
    }

- [ ] **Step 3: 实现 v0 到 v1 迁移**

    export function migrateSave(raw: any): SaveDataV1 {
      if (raw?.schemaVersion === 1) return raw as SaveDataV1;
      const next = createNewSave();
      if (raw?.schemaVersion === 0) {
        next.currencies.gold = Number(raw.gold ?? 0);
      }
      return next;
    }

- [ ] **Step 4: 运行测试**

    Run: yarn test tests/unit/save/SaveMigrator.test.ts
    Expected: PASS.

- [ ] **Step 5: 提交**

    git add assets/script/game/save/model tests/unit/save/SaveMigrator.test.ts
    git commit -m "feat: add versioned save schema"

### Task 5: 原子快照仓库与 Oops 适配

**Files:**
- Create: tests/helpers/MemoryStore.ts
- Create: assets/script/game/save/SaveRepository.ts
- Create: assets/script/game/save/OopsStorageAdapter.ts
- Modify: assets/script/game/save/SaveModule.ts:1-3
- Test: tests/unit/save/SaveRepository.test.ts

**Interfaces:**
- Consumes: SaveDataV1、migrateSave。
- Produces: KeyValueStore、SaveRepository.load()、SaveRepository.commit(save)、SaveModule.initialize()。

- [ ] **Step 1: 写失败测试**

    import { describe, expect, it } from "vitest";
    import { MemoryStore } from "../../helpers/MemoryStore";
    import { SaveRepository } from "../../../assets/script/game/save/SaveRepository";
    import { createNewSave } from "../../../assets/script/game/save/model/SaveData";

    describe("SaveRepository", () => {
      it("keeps the previous snapshot and loads the newest valid revision", () => {
        const store = new MemoryStore();
        const repo = new SaveRepository(store, "campaign");
        const first = createNewSave();
        repo.commit(first);
        repo.commit({ ...first, revision: 2, day: 3 });
        expect(repo.load().day).toBe(3);
        expect(store.get("campaign:previous")).not.toBeNull();
      });
    });

    Run: yarn test tests/unit/save/SaveRepository.test.ts
    Expected: FAIL because repository and memory store do not exist.

- [ ] **Step 2: 实现存储接口与内存替身**

    export interface KeyValueStore {
      get(key: string): string | null;
      set(key: string, value: string): void;
      remove(key: string): void;
    }

    export class MemoryStore implements KeyValueStore {
      private values = new Map<string, string>();
      get(key: string): string | null { return this.values.get(key) ?? null; }
      set(key: string, value: string): void { this.values.set(key, value); }
      remove(key: string): void { this.values.delete(key); }
    }

- [ ] **Step 3: 实现先写临时键再替换的仓库**

    export class SaveRepository {
      constructor(private store: KeyValueStore, private prefix: string) {}

      load(): SaveDataV1 {
        const current = this.store.get(this.prefix + ":current");
        const previous = this.store.get(this.prefix + ":previous");
        for (const text of [current, previous]) {
          if (!text) continue;
          try { return migrateSave(JSON.parse(text)); } catch {}
        }
        return createNewSave();
      }

      commit(save: SaveDataV1): void {
        const currentKey = this.prefix + ":current";
        const previousKey = this.prefix + ":previous";
        const tempKey = this.prefix + ":temp";
        const text = JSON.stringify({ ...save, revision: save.revision + 1 });
        JSON.parse(text);
        this.store.set(tempKey, text);
        const current = this.store.get(currentKey);
        if (current) this.store.set(previousKey, current);
        this.store.set(currentKey, this.store.get(tempKey)!);
        this.store.remove(tempKey);
      }
    }

- [ ] **Step 4: 绑定 oops.storage**

    import { oops } from "../../../../extensions/oops-plugin-framework/assets/core/Oops";
    import { KeyValueStore } from "./SaveRepository";

    export class OopsStorageAdapter implements KeyValueStore {
      get(key: string): string | null { return oops.storage.get(key) ?? null; }
      set(key: string, value: string): void { oops.storage.set(key, value); }
      remove(key: string): void { oops.storage.remove(key); }
    }

- [ ] **Step 5: 替换 SaveModule 占位实现**

    export class SaveModule {
      private repository = new SaveRepository(new OopsStorageAdapter(), "campaign");
      current = createNewSave();

      initialize(): void { this.current = this.repository.load(); }
      commit(): void { this.repository.commit(this.current); }
    }

- [ ] **Step 6: 运行全部基础测试**

    Run: yarn test && yarn typecheck:test
    Expected: all tests pass and TypeScript reports zero errors.

- [ ] **Step 7: Creator 验收**

    Open main scene in Cocos Creator 3.8.8.
    Run once, close preview, run again.
    Expected: startup reaches Hall both times and no storage exception appears in Console.

- [ ] **Step 8: 提交**

    git add assets/script/game/save tests/helpers tests/unit/save
    git commit -m "feat: persist versioned campaign snapshots"

## Plan Completion Gate

Run:

    yarn test
    yarn typecheck:test

Expected: zero failing tests and zero type errors. Then run the Creator startup persistence check before starting plan 02.
