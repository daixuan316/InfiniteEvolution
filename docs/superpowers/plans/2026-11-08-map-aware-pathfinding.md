# 地图感知寻路系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 基于医院城区底图建立玩家与怪物共用的地图感知导航系统，使大型实体阻挡、小型装饰可穿过，并支持不同体型、动态障碍、路径平滑、局部避让和卡住恢复。

**Architecture:** `BattleMapModel` 提供 3×3 平铺后的障碍轮廓，`NavigationGrid` 将轮廓栅格化并缓存按半径膨胀的通行层，`GridPathfinder` 负责最近可达目标、A* 和路径平滑。`BattleSimulation` 消费导航结果完成玩家与怪物移动，`BattleHUDViewComp` 仅处理输入与可视化。

**Tech Stack:** Cocos Creator 3.8.8、TypeScript、Oops Framework、Node.js `node:test`、纯规则单元测试。

## Global Constraints

- 使用当前 `hospital-district.png` 的画面布局和 3×3 平铺方式，不迁移引擎、不引入第三方寻路依赖。
- 导航格尺寸固定为 32 世界单位，4032×2304 世界对应 126×72 网格。
- 玩家和普通怪默认使用 28 世界单位半径，大型怪默认使用 40 世界单位半径。
- 建筑、院墙、围栏、废墟断墙、固定路障、大型箱堆、不可进入绿化和地图边界阻挡。
- 井盖、纸屑、小石块、水坑、裂纹、道路标线和斑马线不阻挡。
- 玩家输入优先：摇杆或键盘输入立即取消点击路径。
- 怪物不得每帧重算路径，常规重算周期保持在 0.5～0.8 秒并错峰执行。
- 路径、直接移动、翻滚、小地图和调试层必须引用同一导航数据。
- 每项生产代码改动必须先有能够因缺失行为而失败的测试。

---

## File Structure

- Create: `assets/script/game/battle/NavigationGrid.ts` — 障碍栅格化、半径膨胀、动态障碍和线段查询。
- Create: `assets/script/game/battle/NavigationGrid.ts.meta` — Cocos Creator 脚本资源元数据。
- Create: `assets/script/game/battle/LocalAvoidance.ts` — 单位之间的确定性轻量分离。
- Create: `assets/script/game/battle/LocalAvoidance.ts.meta` — Cocos Creator 脚本资源元数据。
- Modify: `assets/script/game/battle/BattleMapModel.ts` — 归一化障碍模板、3×3 展开及导航数据入口。
- Modify: `assets/script/game/battle/GridPathfinder.ts` — 代理半径、连通目标解析、路径结果和平滑。
- Modify: `assets/script/game/battle/BattleSimulation.ts` — 玩家路径跟随、导航版本、怪物错峰重算、分离和卡住恢复。
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts` — 最终路径显示和可切换调试层。
- Create: `tests/unit/battle/NavigationGrid.test.mjs` — 栅格化、不同半径、线段查询和动态障碍测试。
- Create: `tests/unit/battle/LocalAvoidance.test.mjs` — 分离向量测试。
- Modify: `tests/unit/battle/BattleMapModel.test.mjs` — 障碍模板、九块连续性和兴趣点可达测试。
- Modify: `tests/unit/battle/GridPathfinder.test.mjs` — 最近连通目标、路径平滑和体型测试。
- Modify: `tests/unit/battle/BattleSimulation.test.mjs` — 玩家、翻滚、动态障碍、怪物重算和卡住测试。
- Modify: `tests/integration/ui/UIViewBindings.test.mjs` — HUD 导航与调试层绑定测试。

### Task 1: 地图障碍模板与九块展开

**Files:**
- Modify: `assets/script/game/battle/BattleMapModel.ts`
- Modify: `tests/unit/battle/BattleMapModel.test.mjs`

**Interfaces:**
- Produces: `ObstacleShape`、`MapObstacle`、`BattleMapDefinition.obstacles`、`BattleMapDefinition.blockSize`。
- Consumes: 当前世界尺寸、出生点、兴趣点和 3×3 底图渲染方式。

- [ ] **Step 1: Write the failing obstacle-template tests**

```js
test("hospital district expands one obstacle template across all nine visual blocks", () => {
    const map = createHospitalDistrictMap();
    const blockIds = new Set(map.obstacles.map((obstacle) => obstacle.blockId));
    assert.deepEqual([...blockIds].sort(), ["0,0", "0,1", "0,2", "1,0", "1,1", "1,2", "2,0", "2,1", "2,2"]);
    assert.ok(map.obstacles.some((obstacle) => obstacle.kind === "building"));
    assert.ok(map.obstacles.some((obstacle) => obstacle.kind === "fence"));
    assert.ok(map.obstacles.some((obstacle) => obstacle.kind === "barricade"));
});

test("small road decorations are not represented as blocking obstacles", () => {
    const map = createHospitalDistrictMap();
    const kinds = new Set(map.obstacles.map((obstacle) => obstacle.kind));
    for (const decoration of ["manhole", "paper", "puddle", "road-marking"]) {
        assert.equal(kinds.has(decoration), false);
    }
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/unit/battle/BattleMapModel.test.mjs`

Expected: FAIL because `BattleMapDefinition` does not expose `obstacles` or `blockSize`.

- [ ] **Step 3: Add explicit obstacle types and block expansion**

Implement these public types and fields:

```ts
export type ObstacleKind = "building" | "wall" | "fence" | "ruin" | "barricade" | "crate" | "greenery";

export type ObstacleShape =
    | { readonly type: "rect"; readonly x: number; readonly y: number; readonly width: number; readonly height: number }
    | { readonly type: "polygon"; readonly points: readonly WorldPoint[] };

export interface MapObstacle {
    readonly id: string;
    readonly blockId: string;
    readonly kind: ObstacleKind;
    readonly shape: ObstacleShape;
    readonly center: WorldPoint;
}

export interface BattleMapDefinition {
    // Keep existing fields.
    readonly blockSize: Readonly<{ width: number; height: number }>;
    readonly obstacles: readonly MapObstacle[];
}
```

Define the single-block template in normalized 0..1 coordinates. Mark the visible hospital complex, fenced tent yard, upper/right ruined structures, lower fenced medians, edge buildings, large crate/barricade groups and blocked vegetation. Convert normalized coordinates to world rectangles/polygons and repeat them at block offsets `column = 0..2`, `row = 0..2`. Use stable IDs in the form `block-<column>-<row>:<template-id>`.

- [ ] **Step 4: Keep spawn and objective cells out of obstacle interiors**

Add assertions that `start`, `extraction`, every enemy spawn and every point of interest is not contained by a raw obstacle. Move only the affected cell to the nearest matching road location; do not remove an obstacle merely to preserve an old coarse-road coordinate.

- [ ] **Step 5: Run map tests and verify GREEN**

Run: `node --test tests/unit/battle/BattleMapModel.test.mjs`

Expected: PASS with nine block IDs, stable obstacle kinds and all important locations outside raw obstacles.

- [ ] **Step 6: Commit**

```powershell
git add assets/script/game/battle/BattleMapModel.ts tests/unit/battle/BattleMapModel.test.mjs
git commit -m "feat: map hospital district obstacles"
```

### Task 2: 导航栅格、体型安全层与动态障碍

**Files:**
- Create: `assets/script/game/battle/NavigationGrid.ts`
- Create: `assets/script/game/battle/NavigationGrid.ts.meta`
- Create: `tests/unit/battle/NavigationGrid.test.mjs`
- Modify: `assets/script/game/battle/BattleMapModel.ts`

**Interfaces:**
- Consumes: `BattleMapDefinition.worldWidth`、`worldHeight`、`obstacles` 和 `ObstacleShape`。
- Produces: `NavigationGrid`、`NavigationAgent`、`DynamicObstacle`、`NavigationGrid.version`、`isCellWalkable()`、`isWorldWalkable()`、`hasLineOfSight()`、`addDynamicObstacle()`、`removeDynamicObstacle()`。

- [ ] **Step 1: Write failing rasterization and clearance tests**

```js
test("navigation rasterizes solid shapes while leaving small road decoration positions open", () => {
    const navigation = new NavigationGrid(createHospitalDistrictMap(), 32);
    assert.equal(navigation.isWorldWalkable({ x: -1500, y: 700 }, 28), false);
    assert.equal(navigation.isWorldWalkable({ x: 0, y: 0 }, 28), true);
});

test("a narrow passage can admit a medium agent and reject a large agent", () => {
    const navigation = NavigationGrid.fromShapes({ width: 192, height: 192, cellSize: 32 }, [
        { id: "top", shape: { type: "rect", x: -96, y: 30, width: 192, height: 66 } },
        { id: "bottom", shape: { type: "rect", x: -96, y: -96, width: 192, height: 66 } },
    ]);
    assert.equal(navigation.isWorldWalkable({ x: 0, y: 0 }, 28), true);
    assert.equal(navigation.isWorldWalkable({ x: 0, y: 0 }, 40), false);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/battle/NavigationGrid.test.mjs`

Expected: FAIL with module-not-found for `NavigationGrid.ts`.

- [ ] **Step 3: Implement grid rasterization and radius-aware queries**

Use this public surface:

```ts
export interface NavigationAgent { readonly radius: number; }
export interface DynamicObstacle { readonly id: string; readonly shape: ObstacleShape; }

export class NavigationGrid {
    static empty(columns: number, rows: number, cellSize: number): NavigationGrid;
    static fromShapes(
        bounds: Readonly<{ width: number; height: number; cellSize: number }>,
        obstacles: readonly DynamicObstacle[],
    ): NavigationGrid;
    readonly columns: number;
    readonly rows: number;
    readonly cellSize: number;
    get version(): number;
    isCellWalkable(cell: GridPoint, radius?: number): boolean;
    isWorldWalkable(point: WorldPoint, radius?: number): boolean;
    worldToCell(point: WorldPoint): GridPoint;
    cellToWorld(cell: GridPoint): WorldPoint;
    hasLineOfSight(from: WorldPoint, to: WorldPoint, radius?: number): boolean;
    addDynamicObstacle(obstacle: DynamicObstacle): boolean;
    removeDynamicObstacle(id: string): boolean;
}
```

Rasterize a cell as blocked when its center or footprint intersects an obstacle polygon/rectangle. Build radius layers lazily by testing the requested cell center against obstacle edges using `radius` clearance; cache layers by rounded radius. Treat out-of-bounds samples as blocked.

- [ ] **Step 4: Write failing dynamic-obstacle version tests**

```js
test("dynamic obstacles invalidate cached clearance layers and advance the navigation version", () => {
    const navigation = NavigationGrid.empty(10, 6, 32);
    const before = navigation.version;
    assert.equal(navigation.isWorldWalkable({ x: 0, y: 0 }, 28), true);
    assert.equal(navigation.addDynamicObstacle({
        id: "wreck",
        shape: { type: "rect", x: -20, y: -20, width: 40, height: 40 },
    }), true);
    assert.equal(navigation.version, before + 1);
    assert.equal(navigation.isWorldWalkable({ x: 0, y: 0 }, 28), false);
    assert.equal(navigation.removeDynamicObstacle("wreck"), true);
    assert.equal(navigation.isWorldWalkable({ x: 0, y: 0 }, 28), true);
});
```

- [ ] **Step 5: Run the dynamic test and verify RED**

Run: `node --test --test-name-pattern="dynamic obstacles" tests/unit/battle/NavigationGrid.test.mjs`

Expected: FAIL because dynamic registration/versioning is not implemented.

- [ ] **Step 6: Implement dynamic obstacles and line traversal**

Store dynamic obstacles by stable ID, reject duplicate IDs, clear radius caches on successful add/remove and increment `version` once. Implement `hasLineOfSight` using a supercover grid traversal plus radius-aware world samples so the segment cannot skip thin walls or cut blocked corners.

- [ ] **Step 7: Run navigation tests and verify GREEN**

Run: `node --test tests/unit/battle/NavigationGrid.test.mjs tests/unit/battle/BattleMapModel.test.mjs`

Expected: PASS for static obstacles, radius layers, dynamic invalidation and line traversal.

- [ ] **Step 8: Commit**

```powershell
git add assets/script/game/battle/NavigationGrid.ts assets/script/game/battle/NavigationGrid.ts.meta assets/script/game/battle/BattleMapModel.ts tests/unit/battle/NavigationGrid.test.mjs tests/unit/battle/BattleMapModel.test.mjs
git commit -m "feat: build radius-aware navigation grid"
```

### Task 3: 最近可达目标、A* 与路径平滑

**Files:**
- Modify: `assets/script/game/battle/GridPathfinder.ts`
- Modify: `tests/unit/battle/GridPathfinder.test.mjs`

**Interfaces:**
- Consumes: `NavigationGrid.isCellWalkable()`、`worldToCell()`、`cellToWorld()` 和 `hasLineOfSight()`。
- Produces: `PathResult`、`findPath()`、`findPathToNearest()`、`findWorldPath()`。

- [ ] **Step 1: Write failing nearest-connected and smoothing tests**

```js
test("nearest target selection never chooses a closer cell behind a sealed wall", () => {
    const blocked = new Set(["2,0", "2,1", "2,2", "2,3", "2,4"]);
    const map = grid(5, 5, blocked);
    const result = new GridPathfinder(map).findPathToNearest({ x: 0, y: 2 }, { x: 4, y: 2 });
    assert.deepEqual(result.at(-1), { x: 1, y: 2 });
});

test("world paths remove redundant bends without crossing obstacles", () => {
    const navigation = NavigationGrid.empty(12, 8, 32);
    navigation.addDynamicObstacle({ id: "block", shape: { type: "rect", x: -20, y: -64, width: 40, height: 128 } });
    const result = new GridPathfinder(navigation).findWorldPath({ x: -150, y: 0 }, { x: 150, y: 0 }, 28);
    assert.ok(result.raw.length > result.waypoints.length);
    for (let index = 1; index < result.waypoints.length; index++) {
        assert.equal(navigation.hasLineOfSight(result.waypoints[index - 1], result.waypoints[index], 28), true);
    }
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/battle/GridPathfinder.test.mjs`

Expected: FAIL because the sealed-wall case currently scans globally and `findWorldPath` does not exist.

- [ ] **Step 3: Implement one-search nearest resolution and path result**

Add:

```ts
export interface PathResult {
    readonly requestedGoal: WorldPoint;
    readonly resolvedGoal: WorldPoint;
    readonly raw: readonly WorldPoint[];
    readonly waypoints: readonly WorldPoint[];
    readonly navigationVersion: number;
}
```

Run a single A* search from the start. If the requested goal is blocked or unreachable, track the visited walkable node with the smallest octile distance to the requested goal, breaking ties by lower path cost and then stable `y/x` order. Reconstruct only from visited nodes, ensuring the resolved goal is connected to the start.

- [ ] **Step 4: Implement deterministic line-of-sight smoothing**

Starting at the first raw world point, select the farthest later point visible to the current anchor at the requested radius, append it and continue. Always preserve the exact start and resolved goal. Return an empty result when the start has no valid navigation cell.

- [ ] **Step 5: Run pathfinder tests and verify GREEN**

Run: `node --test tests/unit/battle/GridPathfinder.test.mjs tests/unit/battle/NavigationGrid.test.mjs`

Expected: PASS with deterministic connected target resolution and collision-safe smoothing.

- [ ] **Step 6: Commit**

```powershell
git add assets/script/game/battle/GridPathfinder.ts tests/unit/battle/GridPathfinder.test.mjs
git commit -m "feat: smooth connected navigation paths"
```

### Task 4: 玩家路径跟随、直接移动与翻滚碰撞

**Files:**
- Modify: `assets/script/game/battle/BattleSimulation.ts`
- Modify: `tests/unit/battle/BattleSimulation.test.mjs`

**Interfaces:**
- Consumes: `NavigationGrid`、`GridPathfinder.findWorldPath()` 和 `PathResult.navigationVersion`。
- Produces: `BattleSimulation.navigation`、`playerPath`（世界航点）、`playerRawPath`、`playerPathVersion`、`addDynamicObstacle()`、`removeDynamicObstacle()`。

- [ ] **Step 1: Write failing player navigation tests**

```js
test("clicking inside a building resolves to a reachable exterior point", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const buildingCenter = simulation.map.obstacles.find((item) => item.kind === "building").center;
    assert.equal(simulation.setPlayerDestination(buildingCenter), true);
    advance(simulation, 30);
    assert.equal(simulation.navigation.isWorldWalkable(simulation.player, simulation.playerRadius), true);
    assert.ok(Math.hypot(simulation.player.x - buildingCenter.x, simulation.player.y - buildingCenter.y) > simulation.playerRadius);
});

test("direct input immediately cancels a click path", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    simulation.setPlayerDestination(simulation.map.cellToWorld(simulation.map.extraction));
    assert.ok(simulation.playerPath.length > 0);
    simulation.setMoveInput(1, 0);
    assert.deepEqual(simulation.playerPath, []);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test --test-name-pattern="building|cancels" tests/unit/battle/BattleSimulation.test.mjs`

Expected: FAIL because the simulation still consumes coarse grid cells and does not expose the navigation grid.

- [ ] **Step 3: Bind simulation movement to NavigationGrid**

Construct one `NavigationGrid` per battle session and one `GridPathfinder` over it. Store smoothed world waypoints in `playerPath`, raw world points in `playerRawPath`, and the path version separately. Before each path-following step, reject a stale version and request a fresh path to the last requested destination.

Update `moveWithCollision` to substep movement by at most half a navigation cell and axis-resolve against `navigation.isWorldWalkable(position, actor.radius)`. Use the same function for direct movement, path movement and dodge.

- [ ] **Step 4: Write failing thin-wall dodge and dynamic invalidation tests**

```js
test("dodge substeps cannot tunnel through a thin dynamic barricade", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const before = { ...simulation.player };
    simulation.addDynamicObstacle({ id: "test-wall", shape: { type: "rect", x: before.x + 70, y: before.y - 80, width: 20, height: 160 } });
    simulation.setMoveInput(1, 0);
    simulation.tryDodge();
    assert.ok(simulation.player.x < before.x + 70 - simulation.playerRadius);
});

test("adding a dynamic obstacle invalidates an active player path and produces a legal replacement", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    simulation.setPlayerDestination(simulation.map.cellToWorld(simulation.map.extraction));
    const oldVersion = simulation.playerPathVersion;
    const next = simulation.playerPath[1];
    simulation.addDynamicObstacle({ id: "wreck", shape: { type: "rect", x: next.x - 25, y: next.y - 25, width: 50, height: 50 } });
    simulation.update(1 / 60);
    assert.ok(simulation.playerPathVersion > oldVersion);
    assert.equal(simulation.navigation.hasLineOfSight(simulation.player, simulation.playerPath[0], simulation.playerRadius), true);
});
```

- [ ] **Step 5: Run the new tests and verify RED**

Run: `node --test --test-name-pattern="thin dynamic|invalidates" tests/unit/battle/BattleSimulation.test.mjs`

Expected: FAIL because dynamic obstacle APIs and path-version refresh are missing.

- [ ] **Step 6: Implement dynamic obstacle forwarding and path refresh**

Expose `addDynamicObstacle(obstacle): boolean` and `removeDynamicObstacle(id): boolean` as forwarding methods. Preserve the player’s requested destination until arrival or explicit direct input. When version changes, recompute once; if no replacement exists, clear the path and leave the player in place.

- [ ] **Step 7: Run player and map tests and verify GREEN**

Run: `node --test tests/unit/battle/BattleSimulation.test.mjs tests/unit/battle/GridPathfinder.test.mjs tests/unit/battle/NavigationGrid.test.mjs tests/unit/battle/BattleMapModel.test.mjs`

Expected: PASS for click movement, direct input, sprinting, dodge, collision and dynamic invalidation.

- [ ] **Step 8: Commit**

```powershell
git add assets/script/game/battle/BattleSimulation.ts tests/unit/battle/BattleSimulation.test.mjs
git commit -m "feat: route player movement through navigation"
```

### Task 5: 怪物局部避让、错峰重算与卡住恢复

**Files:**
- Create: `assets/script/game/battle/LocalAvoidance.ts`
- Create: `assets/script/game/battle/LocalAvoidance.ts.meta`
- Create: `tests/unit/battle/LocalAvoidance.test.mjs`
- Modify: `assets/script/game/battle/BattleSimulation.ts`
- Modify: `tests/unit/battle/BattleSimulation.test.mjs`

**Interfaces:**
- Consumes: `BattleActor` 的位置/半径、怪物路径、`NavigationGrid.version`。
- Produces: `separationFor(actor, neighbors, strength)`、怪物 `stuckFor`、`repathCount` 和合法位置恢复。

- [ ] **Step 1: Write failing deterministic separation tests**

```js
test("overlapping actors receive opposite deterministic separation vectors", () => {
    const left = { id: "a", x: 0, y: 0, radius: 20 };
    const right = { id: "b", x: 10, y: 0, radius: 20 };
    const a = separationFor(left, [right], 1);
    const b = separationFor(right, [left], 1);
    assert.ok(a.x < 0);
    assert.ok(b.x > 0);
    assert.equal(a.y, 0);
    assert.equal(b.y, 0);
});

test("coincident actors use stable IDs instead of a random direction", () => {
    const a = separationFor({ id: "a", x: 0, y: 0, radius: 20 }, [{ id: "b", x: 0, y: 0, radius: 20 }], 1);
    const again = separationFor({ id: "a", x: 0, y: 0, radius: 20 }, [{ id: "b", x: 0, y: 0, radius: 20 }], 1);
    assert.deepEqual(a, again);
});
```

- [ ] **Step 2: Run tests and verify RED**

Run: `node --test tests/unit/battle/LocalAvoidance.test.mjs`

Expected: FAIL with module-not-found for `LocalAvoidance.ts`.

- [ ] **Step 3: Implement bounded local separation**

Implement:

```ts
export interface AvoidanceActor extends WorldPoint { readonly id: string; readonly radius: number; }
export function separationFor(actor: AvoidanceActor, neighbors: readonly AvoidanceActor[], strength: number): WorldPoint;
```

For neighbors closer than the sum of radii plus 8 units, accumulate a normalized away vector weighted by overlap. Resolve exact coincidence with a deterministic axis derived from `id.localeCompare(neighbor.id)`. Clamp the result length to `strength`.

- [ ] **Step 4: Write failing monster recovery tests**

```js
test("enemy repaths immediately after navigation changes instead of following a stale route", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    const enemy = simulation.enemies[0];
    advance(simulation, 1);
    const before = enemy.repathCount;
    const next = enemy.path[enemy.pathIndex];
    simulation.addDynamicObstacle({ id: "enemy-wreck", shape: { type: "rect", x: next.x - 20, y: next.y - 20, width: 40, height: 40 } });
    simulation.update(1 / 60);
    assert.ok(enemy.repathCount > before);
    assert.equal(simulation.navigation.isWorldWalkable(enemy, enemy.radius), true);
});

test("enemies separate while staying outside static obstacles", () => {
    const simulation = new BattleSimulation(createHospitalDistrictMap());
    simulation.enemies[1].x = simulation.enemies[0].x;
    simulation.enemies[1].y = simulation.enemies[0].y;
    advance(simulation, 0.5);
    assert.ok(Math.hypot(simulation.enemies[1].x - simulation.enemies[0].x, simulation.enemies[1].y - simulation.enemies[0].y) > 1);
    for (const enemy of simulation.enemies) assert.equal(simulation.navigation.isWorldWalkable(enemy, enemy.radius), true);
});
```

- [ ] **Step 5: Run monster tests and verify RED**

Run: `node --test --test-name-pattern="repaths immediately|separate" tests/unit/battle/BattleSimulation.test.mjs`

Expected: FAIL because enemies have no navigation version, repath count or separation pass.

- [ ] **Step 6: Implement staggered repath, separation and stuck detection**

Keep each enemy’s `pathVersion`, `lastPosition`, `stuckFor`, `repathCount` and requested player destination. Use initial `repathIn = index * 0.12` and reset to `0.5 + (index % 4) * 0.08`. Trigger immediate replan on navigation-version mismatch, changed target cell, exhausted path or `stuckFor >= 0.35` seconds. Reset stuck time after moving at least 2 units.

After desired path movement, add a bounded separation displacement and pass it through `moveWithCollision`. If a unit is slightly inside a newly added dynamic obstacle, locate the nearest connected safe cell within four grid rings and move only to that cell center; otherwise keep it still and retry.

- [ ] **Step 7: Run avoidance and simulation tests and verify GREEN**

Run: `node --test tests/unit/battle/LocalAvoidance.test.mjs tests/unit/battle/BattleSimulation.test.mjs`

Expected: PASS with deterministic separation, immediate stale-path recovery, attack-range stopping and no obstacle penetration.

- [ ] **Step 8: Commit**

```powershell
git add assets/script/game/battle/LocalAvoidance.ts assets/script/game/battle/LocalAvoidance.ts.meta assets/script/game/battle/BattleSimulation.ts tests/unit/battle/LocalAvoidance.test.mjs tests/unit/battle/BattleSimulation.test.mjs
git commit -m "feat: recover and separate navigating enemies"
```

### Task 6: HUD 路径、调试层与完整回归

**Files:**
- Modify: `assets/script/game/battle/BattleHUDViewComp.ts`
- Modify: `tests/integration/ui/UIViewBindings.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `BattleSimulation.playerPath`、`playerRawPath`、`navigation` 和地图障碍。
- Produces: `toggleNavigationDebug()`、最终路线绘制、障碍/禁行格/原始路径调试显示。

- [ ] **Step 1: Write failing HUD binding tests**

```js
test("battle HUD renders smoothed routes and exposes a navigation debug toggle", () => {
    const source = readFileSync("assets/script/game/battle/BattleHUDViewComp.ts", "utf8");
    assert.match(source, /playerRawPath/);
    assert.match(source, /toggleNavigationDebug/);
    assert.match(source, /NavigationDebug/);
    assert.match(source, /isCellWalkable/);
});
```

- [ ] **Step 2: Run integration test and verify RED**

Run: `node --test tests/integration/ui/UIViewBindings.test.mjs`

Expected: FAIL because the debug toggle and raw-path rendering do not exist.

- [ ] **Step 3: Update route drawing and add an opt-in debug overlay**

Change `syncPath()` to draw `simulation.playerPath` as world-space waypoints instead of converting grid cells. Add a `NavigationDebug` `Graphics` node under `worldLayer`, default inactive. Implement `toggleNavigationDebug()` to switch it and redraw:

- raw obstacle outlines in magenta;
- medium-agent blocked cells with translucent red;
- raw A* path in muted white;
- smoothed path in orange;
- current player and enemy path anchors.

Bind keyboard `F3` to the toggle for desktop development. Do not add a production HUD button.

- [ ] **Step 4: Add the full navigation test script**

Add to `package.json`:

```json
"test:navigation": "node --test tests/unit/battle/BattleMapModel.test.mjs tests/unit/battle/NavigationGrid.test.mjs tests/unit/battle/GridPathfinder.test.mjs tests/unit/battle/LocalAvoidance.test.mjs tests/unit/battle/BattleSimulation.test.mjs tests/integration/ui/UIViewBindings.test.mjs"
```

- [ ] **Step 5: Run focused and full automated verification**

Run: `npm run test:navigation`

Expected: all navigation and HUD binding tests pass.

Run: `npm run test:battle`

Expected: all battle tests pass.

Run: `npm run test:ui`

Expected: all existing UI and battle tests pass without warnings or unhandled rejections.

- [ ] **Step 6: Run TypeScript verification**

Run: `npx tsc --noEmit --allowImportingTsExtensions`

Expected: exit code 0 with no type errors.

- [ ] **Step 7: Perform Creator manual acceptance**

Open `main.scene` in Cocos Creator 3.8.8 and verify:

1. Clicking hospital roofs, fenced yards, ruined walls and barricades resolves to legal exterior positions.
2. Clicking through a fence gap follows the gap and never cuts a corner.
3. WASD/joystick immediately cancels click movement and slides along walls.
4. Dodge stops at thin walls and map boundaries.
5. Normal and large monsters choose routes with correct clearance and do not stack at the player center.
6. F3 shows obstacle outlines, blocked cells, raw path and smoothed path aligned to the visible 3×3 map.
7. Adding/removing a runtime wreck invalidates current routes and triggers legal replans.

- [ ] **Step 8: Commit**

```powershell
git add assets/script/game/battle/BattleHUDViewComp.ts tests/integration/ui/UIViewBindings.test.mjs package.json
git commit -m "feat: visualize and verify navigation"
```

## Completion Gate

Implementation is complete only when `npm run test:navigation`, `npm run test:battle`, `npm run test:ui` and `npx tsc --noEmit --allowImportingTsExtensions` all exit with code 0, the debug overlay aligns with all nine visible blocks in Creator, and player/monster movement cannot enter any marked large obstacle.
