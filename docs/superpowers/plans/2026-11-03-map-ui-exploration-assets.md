# Map UI Exploration Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a clear region-selection-to-exploration visual flow for hospital, police station, and factory, including seven UI mockups and reusable map assets.

**Architecture:** Generated raster work is retained as immutable source art, while one deterministic PowerShell pipeline normalizes maps/mockups, composes node states from the existing icon library, creates route/hazard overlays, and gathers approved interactables. One manifest records generated sources, reused assets, normalized outputs, and provenance.

**Tech Stack:** Codex built-in image generation, PowerShell 7, System.Drawing, PNG/RGBA, existing `ui-icons`, `map-interactables`, and `world-characters-monsters` libraries, Cocos Creator 3.8.8 documentation conventions.

## Global Constraints

- Target platform is Douyin mini-game, landscape 1334×750.
- Preserve the approved orthographic high-angle refined 2D pixel-art direction and cyan/yellow/magenta/gray state language.
- Region-map location clicks select and reveal details; only the yellow “确认出发” action enters exploration.
- Region screens contain no player avatar, movement joystick, or combat skills.
- Exploration screens visibly contain the player, joystick, action cluster, minimap, interactables, objective, and evacuation direction.
- Functional text and dynamic values remain code-native; generated mockup text is explanatory only.
- Do not overwrite the existing `world-characters-monsters`, `ui-mockups`, `ui-icons`, or `map-interactables` libraries.
- Do not modify unrelated untracked project files.

---

### Task 1: Generate three clean exploration maps

**Files:**
- Create: `docs/design/assets/map-ui-v2/source/01-hospital-exploration-map.png`
- Create: `docs/design/assets/map-ui-v2/source/02-police-exploration-map.png`
- Create: `docs/design/assets/map-ui-v2/source/03-factory-exploration-map.png`

**Interfaces:**
- Consumes: `docs/design/assets/world-characters-monsters/maps/02-hospital-district-day.png`, `docs/design/assets/ui-main-gameplay-topdown-v1.png`, and the approved visual specification.
- Produces: three clean scene sources consumed by Task 2 mockup generation and Task 3 normalization.

- [ ] **Step 1: Generate the hospital map visual target**

Use the built-in image generator with the existing hospital map and main gameplay image as style references. Prompt: “Production game background for a daytime hospital exploration district in an orthographic high-angle refined 2D pixel-art survival game. Show a readable main road, hospital entrance, ambulance search zone, fenced contamination pocket, purifier station, rescue point, two route branches, indoor entrance, and a clearly reserved ark-return edge. Warm-yellow interactive objects must be visible in the environment without UI markers. No HUD, no text, no icons, no characters, no monsters, no route overlay, no baked collision markings, no isometric view, no side view, no 3D realism. Landscape 16:9 composition intended for deterministic crop to 1334×750.”

- [ ] **Step 2: Inspect hospital readability at gameplay scale**

Open the result and verify that the main route, two branches, hospital entrance, four interaction zones, and return edge remain distinguishable at a 1334×750 preview. Regenerate once with only the failed readability constraint changed if any required element is missing.

- [ ] **Step 3: Generate the police-station map**

Use the approved hospital result plus the same gameplay style reference. Prompt: “Production game background matching the approved hospital map’s exact camera, pixel density, palette roles, edge treatment, and lighting. Create a daytime ruined police-station district with a readable main road, fortified station entrance, security gate, keycard terminal, armory wing, evidence courtyard, two route branches, indoor entrance, and ark-return edge. Warm-yellow interactive props must read without UI markers. No HUD, text, icons, characters, monsters, route overlay, side view, isometric view, or 3D realism. Landscape 16:9 composition intended for deterministic crop to 1334×750.”

- [ ] **Step 4: Generate the factory map**

Use the approved hospital result plus the same gameplay style reference. Prompt: “Production game background matching the approved hospital map’s exact camera, pixel density, palette roles, edge treatment, and lighting. Create a daytime abandoned factory district with a readable service road, production hall entrance, power junction, generator yard, crane control, noisy conveyor area, two route branches, indoor entrance, and ark-return edge. Warm-yellow interactive props must read without UI markers. No HUD, text, icons, characters, monsters, route overlay, side view, isometric view, or 3D realism. Landscape 16:9 composition intended for deterministic crop to 1334×750.”

- [ ] **Step 5: Copy selected generated outputs into the workspace**

Resolve each built-in result under `$env:CODEX_HOME\generated_images`, then copy it with `Copy-Item -LiteralPath` to the exact three source paths. Never overwrite an existing file without first choosing a versioned sibling name and reconciling the plan.

### Task 2: Generate seven complete UI mockups

**Files:**
- Create: `docs/design/assets/map-ui-v2/source/04-region-overview-ui.png`
- Create: `docs/design/assets/map-ui-v2/source/05-hospital-selected-ui.png`
- Create: `docs/design/assets/map-ui-v2/source/06-police-selected-ui.png`
- Create: `docs/design/assets/map-ui-v2/source/07-factory-selected-ui.png`
- Create: `docs/design/assets/map-ui-v2/source/08-hospital-exploration-ui.png`
- Create: `docs/design/assets/map-ui-v2/source/09-police-exploration-ui.png`
- Create: `docs/design/assets/map-ui-v2/source/10-factory-exploration-ui.png`

**Interfaces:**
- Consumes: the three approved map sources from Task 1 and `docs/design/assets/ui-mockups/06-world-map-intelligence.png` plus `01-day-exploration.png` as UI-shell references.
- Produces: seven UI sources normalized by Task 3.

- [ ] **Step 1: Generate the region overview**

Prompt with the existing region-map mockup and gray-harbor map as references: “High-fidelity 1334×750 landscape UI mockup for a mobile survival game’s region intelligence map. The center map prominently shows three clickable locations—hospital, police station, factory—with cyan default node frames, distinct silhouettes, and route connections from the ark. Left rail shows compact objectives and filters. Right panel is collapsed and reads as inactive. Top bar shows day/time/resources. Bottom-right yellow action is disabled until a location is selected. Absolutely no joystick, player avatar, weapon skills, or combat HUD. Keep text minimal; exact functional copy will be code-native. Orthographic refined pixel-art UI, cyan/yellow/magenta/gray visual language, no watermark.”

- [ ] **Step 2: Generate three selected-location states**

Issue one built-in edit/generation call for each location using the overview and matching thumbnail. Preserve the complete shell and node positions. For each result require: selected node enlarged with yellow outline, other nodes dimmed but readable, recommended yellow route, dangerous magenta segment when relevant, and a fixed right detail panel containing thumbnail, risk symbols, three reward icons, travel distance, expected duration, event warning, and a large yellow button with the exact text “确认出发”. The hospital state emphasizes medicine/pollution/rescue; police emphasizes weapons/locked zone/armored threat; factory emphasizes machinery/power/high noise. Do not add joystick or combat controls.

- [ ] **Step 3: Generate three exploration gameplay states**

Issue one call per Task 1 map while using the existing day-exploration mockup as the HUD reference. Require the same fixed HUD shell: player and enemies in the world, left joystick, right dodge/skill/grenade/interaction/weapon cluster, top-center daylight timer, top-left health/shield/injury/pollution, top-right minimap with objective and ark-return direction. Hospital must visibly show ambulance search, purifier, rescue target, and hospital entrance. Police must show keycard terminal, locked armory, password clue, and station entrance. Factory must show power junction, generator, crane control, and noisy production zone. Use warm-yellow interaction rings and markers. No full-screen region map, no location-selection panel, no isometric or side view.

- [ ] **Step 4: Copy the seven selected outputs into the workspace**

Resolve each built-in result under `$env:CODEX_HOME\generated_images` and copy it to the exact source path. Record the final prompt and source-result mapping in the manifest created by Task 4.

### Task 3: Build deterministic normalization and reusable layers

**Files:**
- Create: `scripts/normalize-map-ui-v2-assets.ps1`
- Create: `docs/design/assets/map-ui-v2/mockups/*.png`
- Create: `docs/design/assets/map-ui-v2/maps/*.png`
- Create: `docs/design/assets/map-ui-v2/location-thumbnails/square/*.png`
- Create: `docs/design/assets/map-ui-v2/location-thumbnails/wide/*.png`
- Create: `docs/design/assets/map-ui-v2/map-nodes/*.png`
- Create: `docs/design/assets/map-ui-v2/route-overlays/*.png`
- Create: `docs/design/assets/map-ui-v2/hazard-overlays/*.png`
- Create: `docs/design/assets/map-ui-v2/markers/*.png`
- Create: `docs/design/assets/map-ui-v2/interactables/{hospital,police-station,factory}/*.png`
- Create: `docs/design/assets/map-ui-v2/previews/*.png`

**Interfaces:**
- Consumes: ten generated source files, three existing map-action icons, existing thumbnails, and twelve existing map-interactable props.
- Produces: three 1334×750 maps, seven 1334×750 mockups, twelve 128×128 node states, sixteen 128×128 markers, three route overlays, three hazard overlays, twelve gathered interactables, and preview sheets.

- [ ] **Step 1: Implement centered normalization**

In PowerShell/System.Drawing, implement `Get-CoverRect` and `Save-Region` using `CompositingMode.SourceCopy`, `InterpolationMode.NearestNeighbor`, `PixelOffsetMode.Half`, and `SmoothingMode.None`. Normalize Task 1 images to `maps/01-hospital-day.png`, `02-police-station-day.png`, and `03-factory-day.png`; normalize Task 2 images to seven numbered files under `mockups/`, all exactly 1334×750.

- [ ] **Step 2: Gather thumbnails and interactables**

Copy hospital, police-station, and factory square/wide thumbnails from `world-characters-monsters/location-thumbnails`. Copy these exact existing prop files into location folders: hospital—`medical-cabinet`, `purifier`, `rescue-beacon`, `extraction-beacon`; police—`armory-crate`, `locked-door`, `keycard-reader`, `weapon-case`; factory—`power-junction`, `generator`, `crane-control`, `electronics-cache`. Preserve source filenames and record their original paths.

- [ ] **Step 3: Compose twelve node-state assets**

Use the existing hospital, police-station, and factory map-action icons as centers. Draw each into 128×128 transparent RGBA outputs with four non-color-only states: default cyan hex/ring; selected yellow double ring plus lower pointer notch; high-risk magenta ring plus skull warning badge; locked gray ring plus padlock badge. Name outputs `<location>-default.png`, `<location>-selected.png`, `<location>-high-risk.png`, and `<location>-locked.png`.

- [ ] **Step 4: Compose sixteen navigation markers**

Reuse the closest existing icons and draw consistent cyan/yellow/magenta rings for: `player`, `ark`, `objective`, `search`, `indoor-entrance`, `evacuation`, `rescue`, `keycard`, `armory`, `power`, `crane`, `noise`, `pollution`, `safe-route`, `high-risk-route`, and `locked-area`. Save each as transparent 128×128 RGBA.

- [ ] **Step 5: Draw route and hazard overlays**

Create transparent 1024×128 route strips: cyan solid safe route, yellow dashed recommended route with arrowheads, and magenta dashed high-risk route with warning chevrons. Create transparent 512×512 hazard overlays: magenta organic pollution hatch, gray cross-hatched locked area, and yellow pulse-ring high-noise area. Keep alpha below 45% outside borders so map details remain readable.

- [ ] **Step 6: Build previews and run normalization**

Generate checkerboard contact sheets for nodes, markers, routes/hazards, interactables, maps, and seven mockups. Run `pwsh -NoProfile -File scripts/normalize-map-ui-v2-assets.ps1` and expect a successful summary containing exact counts for every group.

### Task 4: Document, validate, and commit the library

**Files:**
- Create: `docs/design/17-map-ui-exploration-assets.md`
- Create: `docs/design/assets/map-ui-v2/asset-manifest.json`
- Modify: `docs/design/README.md`
- Modify: `docs/design/02-world-exploration.md`
- Verify: `docs/design/assets/map-ui-v2/**/*.png`

**Interfaces:**
- Consumes: all normalized assets and source mappings from Tasks 1–3.
- Produces: human catalog, machine manifest, clarified terminology, and reproducible validation evidence.

- [ ] **Step 1: Write the machine manifest**

Record schema version, library ID `infinite-evolution-map-ui-v2`, generation date `2026-11-03`, built-in source tool, every source prompt, reference paths, generated/reused source type, output dimensions, alpha requirement, stable ID, original path for reused assets, normalization method, internal visual review status, and commercial-release review requirement.

- [ ] **Step 2: Write the catalog and terminology rules**

Document the selection-to-departure-to-exploration flow, color/state meanings, all asset groups, intended layer order, Cocos import guidance, and previews. Add an explicit terminology table to `02-world-exploration.md`: “区域情报地图” is a selection/navigation UI, “探索战场” is player-controlled world space, and “小地图” is a HUD navigator without teleportation.

- [ ] **Step 3: Add the catalog to the design index**

Add document 17 after the existing asset-library entries in `docs/design/README.md` without reordering unrelated documents.

- [ ] **Step 4: Rebuild from source**

Run: `pwsh -NoProfile -File scripts/normalize-map-ui-v2-assets.ps1`

Expected: a clean successful run regenerating every derivative without changing source images.

- [ ] **Step 5: Verify counts, dimensions, alpha, and uniqueness**

Use System.Drawing and `Get-FileHash` to assert: 7 mockups and 3 maps at 1334×750; 12 nodes and 16 markers at 128×128 with usable alpha; 3 route overlays at 1024×128 with alpha; 3 hazard overlays at 512×512 with alpha; 6 thumbnails; 12 gathered interactables; 6 preview sheets; no duplicate hashes within nodes, markers, maps, or mockups. Parse the manifest with `ConvertFrom-Json` and assert every declared output exists.

- [ ] **Step 6: Verify specification coverage and repository formatting**

Run `rg -n "[T]BD|[T]ODO|待定|implement\s+later" docs/design/17-map-ui-exploration-assets.md docs/design/assets/map-ui-v2/asset-manifest.json` and `git diff --check`.

Expected: no placeholder matches and no whitespace errors.

- [ ] **Step 7: Commit the completed asset library**

Run `git add -- docs/design/02-world-exploration.md docs/design/17-map-ui-exploration-assets.md docs/design/README.md docs/design/assets/map-ui-v2 scripts/normalize-map-ui-v2-assets.ps1 docs/superpowers/plans/2026-11-03-map-ui-exploration-assets.md` followed by `git commit -m "docs: add map ui exploration asset library"`.

