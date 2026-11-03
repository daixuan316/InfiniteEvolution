# Shelter Level UI Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce five shelter-level UI mockups and a reusable transparent asset library for five ark chassis, 32 modules, and 16 interaction/status overlays.

**Architecture:** Generated raster images are retained as source sheets, while a deterministic PowerShell pipeline center-crops UI mockups and slices normalized transparent runtime assets. Stable IDs, source mappings, technical properties, and provenance live in one JSON manifest; Markdown provides the human-facing catalog and preview.

**Tech Stack:** Codex built-in image generation, PowerShell 7, System.Drawing, PNG/RGBA, Cocos Creator 3.8.8 documentation conventions.

## Global Constraints

- Preserve the approved orthographic high-angle top-down refined 2D pixel-art direction.
- Reference resolution is 1334×750 landscape; functional text and dynamic values remain code-native.
- Night combat occurs on or inside the ark, never outside it.
- Repair is remote/automatic and never depicted as a character manually repairing a module.
- Do not modify unrelated untracked project files.

---

### Task 1: Generate and retain source artwork

**Files:**
- Create: `docs/design/assets/shelter-levels/source-sheets/01-ui-modified-transport.png`
- Create: `docs/design/assets/shelter-levels/source-sheets/02-ui-armored-tracked-fortress.png`
- Create: `docs/design/assets/shelter-levels/source-sheets/03-ui-mobile-industrial-platform.png`
- Create: `docs/design/assets/shelter-levels/source-sheets/04-ui-biomechanical-ark.png`
- Create: `docs/design/assets/shelter-levels/source-sheets/05-ui-doomsday-mobile-citadel.png`
- Create: `docs/design/assets/shelter-levels/source-sheets/06-ark-level-bases.png`
- Create: `docs/design/assets/shelter-levels/source-sheets/07-structural-utility-modules.png`
- Create: `docs/design/assets/shelter-levels/source-sheets/08-defense-evolution-modules.png`
- Create: `docs/design/assets/shelter-levels/source-sheets/09-interaction-state-overlays.png`

**Interfaces:**
- Consumes: approved references under `docs/design/assets/ui-mockups/` and the stable IDs in the design specification.
- Produces: nine immutable source images consumed by `scripts/normalize-shelter-level-assets.ps1`.

- [ ] **Step 1: Generate five UI mockups**

Use one built-in image-generation call per level. Each prompt must name the exact growth stage, keep the same screen shell, reserve UI safe areas, and prohibit rasterized functional text, manual character repair, side view, isometric view, or 3D realism.

- [ ] **Step 2: Generate the chassis source sheet**

Generate one transparent 2×3 row-major sheet containing levels 1–5 plus an empty sixth calibration cell. Require isolated cells, consistent camera, vehicle center, track baseline, light direction, and no replaceable modules.

- [ ] **Step 3: Generate two module sheets and one overlay sheet**

Generate three transparent 4×4 row-major sheets using the exact ordered ID lists from the specification. Require isolated cells, consistent scale and lighting, no text, no frames, and no clipped silhouettes.

- [ ] **Step 4: Copy generated files into the workspace**

Run `Get-ChildItem "$env:CODEX_HOME\generated_images" -Recurse -File | Sort-Object LastWriteTime` to resolve each result, then use `Copy-Item -LiteralPath <generated-file> -Destination <exact-source-path>`.

### Task 2: Build deterministic normalization

**Files:**
- Create: `scripts/normalize-shelter-level-assets.ps1`
- Create: `docs/design/assets/shelter-levels/ui-mockups/*.png`
- Create: `docs/design/assets/shelter-levels/ark-bases/*.png`
- Create: `docs/design/assets/shelter-levels/modules/structural-utility/*.png`
- Create: `docs/design/assets/shelter-levels/modules/defense-evolution/*.png`
- Create: `docs/design/assets/shelter-levels/overlays/*.png`
- Create: `docs/design/assets/shelter-levels/previews/*.png`

**Interfaces:**
- Consumes: nine source images and the ordered stable-ID arrays embedded in the script.
- Produces: five 1334×750 mockups, five 768×512 chassis, 32 256×256 modules, 16 256×256 overlays, and four preview sheets.

- [ ] **Step 1: Add ordered IDs and source mappings**

Declare the five chassis IDs, two 16-item module arrays, and one 16-item overlay array exactly as written in the specification.

- [ ] **Step 2: Implement UI normalization**

For every UI source, compute a centered `1334 / 750` crop rectangle, draw it to a 1334×750 bitmap with `InterpolationMode.NearestNeighbor`, and save it under `ui-mockups/`.

- [ ] **Step 3: Implement grid slicing**

Slice the chassis sheet as 2×3 and the other sheets as 4×4 using rounded fractional cell boundaries. Draw each cell into the exact target size using `CompositingMode.SourceCopy`, transparent clear, nearest-neighbor interpolation, no smoothing, and stable row-major names.

- [ ] **Step 4: Implement preview generation**

Create checkerboard-backed contact sheets for chassis, modules, and overlays plus one five-screen UI contact sheet without mutating the transparent outputs.

- [ ] **Step 5: Run normalization**

Run: `pwsh -NoProfile -File scripts/normalize-shelter-level-assets.ps1`

Expected: `Normalized 58 shelter-level deliverables` and all target folders exist.

### Task 3: Document and index the library

**Files:**
- Create: `docs/design/16-shelter-level-assets.md`
- Create: `docs/design/assets/shelter-levels/asset-manifest.json`
- Modify: `docs/design/README.md`
- Modify: `docs/design/03-mobile-ark.md`

**Interfaces:**
- Consumes: normalized file names and source mappings.
- Produces: human catalog, machine manifest, navigation entry, and a repair rule consistent with the approved visual direction.

- [ ] **Step 1: Write the human-facing catalog**

List all five stages, all 53 composable asset IDs, folder roles, state priority, Cocos import guidance, and preview images. State explicitly that UI text/numbers, slot rules, ranges, collisions, and animation are code/data responsibilities.

- [ ] **Step 2: Write the machine manifest**

Record schema version, library ID, generation date, source tool, style references, format definitions, ordered groups, relative source paths, asset IDs, runtime layer rules, pivot guidance, normalization method, review status, and commercial-release review requirement.

- [ ] **Step 3: Reconcile repair rules**

Replace player manual-repair wording in `03-mobile-ark.md` with remote repair allocation and automatic drone dispatch; preserve resource cost, durability thresholds, night restrictions, and survivor engineer bonuses.

- [ ] **Step 4: Add the catalog to the design index**

Add document 16 after the existing map-interactable library entry in `docs/design/README.md`.

### Task 4: Validate and commit

**Files:**
- Verify: `docs/design/assets/shelter-levels/**/*.png`
- Verify: `docs/design/assets/shelter-levels/asset-manifest.json`
- Verify: `docs/design/16-shelter-level-assets.md`
- Verify: `scripts/normalize-shelter-level-assets.ps1`

**Interfaces:**
- Consumes: all outputs from Tasks 1–3.
- Produces: reproducible evidence that counts, dimensions, transparency, uniqueness, documentation, and repository formatting are correct.

- [ ] **Step 1: Rebuild from source**

Run: `pwsh -NoProfile -File scripts/normalize-shelter-level-assets.ps1`

Expected: a clean successful run that regenerates every derivative.

- [ ] **Step 2: Verify counts and dimensions**

Use System.Drawing in PowerShell to assert: 5 UI mockups at 1334×750, 5 chassis at 768×512 with alpha, 32 modules at 256×256 with alpha, 16 overlays at 256×256 with alpha, and 4 previews.

- [ ] **Step 3: Verify uniqueness and manifest mappings**

Run `Get-FileHash` over each finished group and assert no duplicate hashes. Parse `asset-manifest.json` with `ConvertFrom-Json` and assert all 53 composable IDs resolve to existing files.

- [ ] **Step 4: Verify documentation quality**

Run `rg -n "[T]BD|[T]ODO|待定|implement\s+later" docs/design/16-shelter-level-assets.md docs/design/assets/shelter-levels/asset-manifest.json` and `git diff --check`.

Expected: no placeholder matches and no whitespace errors.

- [ ] **Step 5: Commit the asset library**

Run `git add -- docs/design/03-mobile-ark.md docs/design/16-shelter-level-assets.md docs/design/README.md docs/design/assets/shelter-levels scripts/normalize-shelter-level-assets.ps1 docs/superpowers/plans/2026-11-03-shelter-level-ui-assets.md` followed by `git commit -m "docs: add shelter level ui asset library"`.

