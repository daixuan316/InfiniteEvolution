# Infinite Map Readability, Collision, and Distance Scaling Design

## Goal

Improve daytime infinite exploration so that district boundaries are readable, actor scale matches the street grid, visible roads are traversable, visible solid structures block movement, and encounter pressure grows with distance from the Ark.

The implementation keeps Cocos Creator 3.8.8, the existing seeded chunk generator, sparse world deltas, streamed 3×3 active chunks, pooled presentation nodes, and the current pixel-art assets.

## Confirmed Player Experience

- Residential, community, industrial, open-space, and hospital areas have clearly different border colors and readable district labels.
- The player and ordinary monsters occupy less visual space and can pass through intended two-cell roads without appearing to overlap buildings.
- Streets visible in a chunk background are represented by the navigation mask instead of being decorative dead space.
- Buildings, fences, rubble, parked vehicles, and other substantial visual blockers use the same collision mask consumed by movement and pathfinding.
- Enemy density and health increase predictably as the player travels farther from the Ark at chunk `0:0`.
- Returning to a chunk reproduces the same enemy positions, kinds, difficulty, and stable IDs from the world seed and chunk coordinate.

## Chosen Approach

Use data-aligned art templates rather than replacing all current art or adding presentation-only overlays.

Each background family supplies a deterministic local navigation template. The template describes walkable road cells and solid cells that match the 14×8 grid represented by the 1344×768 chunk image. Chunk edge cells are opened only when the shared seeded road connection is open, preserving cross-chunk connectivity. Closed edges receive a full-width visual closure matching the collision boundary.

This approach fixes the source mismatch between art and navigation while keeping current assets and seed reconstruction intact.

## Architecture

### 1. District presentation

Add a pure district-presentation mapping with:

- localized label;
- border color;
- translucent ground tint;
- landmark override for hospital chunks.

`BattleHUDViewComp` applies the presentation whenever a chunk node is created or reused from its pool. The overlay remains below actors and interaction objects and is refreshed when a pooled node changes district.

Proposed palette:

| District | Label | Accent |
| --- | --- | --- |
| residential | 住宅区 | blue-cyan |
| community | 社区商业区 | green |
| industrial | 工业区 | orange |
| open-space | 荒废空地 | muted green-gray |
| hospital landmark | 战地医院 | red-white |

### 2. Art-aligned navigation and collision

The generator selects a local template from `backgroundId`. Generation remains pure and deterministic.

The template produces:

- interior road cells matching the visible central and perimeter streets;
- edge cells conditioned on north/east/south/west connection flags;
- solid cells or obstacle rectangles for substantial art blockers;
- safe spawn candidates chosen only from walkable, non-solid cells.

The final `roadCells` array is the shared source of truth for A* pathfinding, direct actor movement, navigation overlays, minimaps, and discovery summaries. Explicit solid cells are subtracted before the array is exposed. Building lots remain semantic content for district composition, but movement no longer assumes that a generic lot rectangle exactly matches every background image.

Connectivity validation checks every generated template has a route between all enabled edge portals. Seed sweeps verify neighboring chunks agree on their shared edge and never isolate an enabled portal.

### 3. Actor scale

Presentation sizes:

| Actor | Current | Target |
| --- | ---: | ---: |
| Player | 158 px | 104 px |
| Walker | 112 px | 78 px |
| Runner | 118 px | 82 px |
| Mutant | 126 px | 90 px |
| Brute | 172 px | 118 px |

Collision radii are adjusted independently from sprite bounds:

- player: 22 world units;
- walker/runner: 18;
- mutant: 20;
- brute: 28.

Health bars are scaled and repositioned with the presentation size. Combat reach continues to use actor radii plus the existing melee margin.

### 4. Distance-based encounter scaling

The Ark anchor is chunk `0:0`. Difficulty uses Euclidean chunk distance:

`distance = floor(hypot(chunkX, chunkY))`

Enemy count per active chunk:

| Distance | Count |
| --- | ---: |
| 0–1 | 1 |
| 2–3 | 2 |
| 4–6 | 3 |
| 7+ | 4 |

Enemy health multiplier:

`healthMultiplier = min(3, 1 + distance * 0.1)`

Only maximum health scales in this change. Damage, speed, defense, and attack interval stay unchanged to keep the tuning legible and avoid compounding difficulty. A maximum of four enemies per chunk limits a 3×3 active window to 36 streamed enemies.

Spawn candidates are deterministic road cells with minimum spacing from the Ark start, loot, exploration targets, portals, and other spawns. Stable IDs include chunk key and spawn slot so sparse destroyed-enemy deltas continue to suppress defeated enemies after recycling and reload. Slot zero also checks the previous cell-based enemy ID as a legacy alias before spawning, preserving already-defeated enemies from existing saves.

## Data Flow

1. Seed and chunk coordinate select district, background, road connections, and difficulty distance.
2. The background navigation template builds the local walkable/solid mask.
3. Deterministic spawn selection chooses the required number of safe cells.
4. `InfiniteBattleMap` converts local masks and spawns into permanent world cells.
5. `BattleSimulation` creates enemies with the chunk health multiplier and stable spawn ID.
6. `BattleHUDViewComp` renders the district overlay and reduced actor presentation from the same chunk and actor data.
7. Sparse deltas store only defeated/opened/completed changes; base masks and scaling reconstruct from the seed.

## Compatibility and Failure Handling

- Existing world saves remain compatible: the snapshot schema is unchanged, new enemies use stable slot IDs, and slot zero recognizes the previous cell-based ID as a legacy alias.
- If a template has no valid spawn candidate, it emits fewer enemies instead of placing one on a blocker.
- If connectivity validation fails during development, the test reports the seed, coordinate, and background template.
- Existing chunk pooling and the six-preload-per-frame budget remain unchanged.
- No new runtime texture loading path is introduced.

## Testing

Follow test-driven development with a failing test before each production change.

Automated coverage:

- district presentation returns distinct labels and accents, including hospital override;
- actor presentation sizes and collision radii stay below the street-cell metrics;
- every visible template street sample is walkable and every declared blocker is not;
- all enabled portals remain connected within each chunk;
- neighboring chunks agree on shared road edges across a large seed sweep;
- enemy count follows all four distance bands;
- health multiplier grows monotonically and caps at 3×;
- spawn cells are unique, walkable, and deterministic;
- stable IDs and defeated-enemy sparse deltas survive chunk recycling;
- full battle and UI regression suites pass.

Manual Cocos Creator smoke test:

- cross at least six chunk boundaries in all directions;
- walk the central and perimeter streets of residential, commercial, and hospital backgrounds;
- attempt to enter representative buildings, fences, rubble, and parked vehicles;
- compare actor scale at intersections and narrow passages;
- travel through distance bands and confirm density/health changes without a frame spike.

## Out of Scope

- Replacing or regenerating the current chunk artwork;
- scaling enemy damage, speed, defense, or loot rewards by distance;
- adding elite affixes or new monster species;
- changing night-defense wave balance;
- changing the 3×3 active / 5×5 preload streaming model.
