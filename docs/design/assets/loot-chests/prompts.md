# 宝箱状态素材生成记录

> 生成日期：2026-11-10  
> 工具：OpenAI 内置图像生成  
> 用途：项目内部 UI 与世界物件素材  
> 发布要求：商业发布前完成平台生成式内容披露与权利复核

## 来源与固定顺序

`world-closed.png` 复制自 `docs/design/assets/map-interactables/source-sheets/03-world-loot-resource.png`；`icons-closed.png` 复制自 `docs/design/assets/map-interactables/source-sheets/01-ui-loot-resource.png`。二者是本轮的身份、构图、配色与 4×4 行优先顺序基准。

固定顺序：

```text
supply-crate, armory-crate, bio-crate, heavy-safe,
airdrop-crate, hidden-cache, weapon-case, medical-cabinet,
scrap-pile, alloy-stack, electronics-cache, energy-cell-crate,
fuel-drum, ration-box, blueprint-tube, mutation-pod
```

所有生成调用均请求真实透明背景，并在切片阶段检查 alpha。

## world-opening.png

```text
Use case: precise-object-edit
Asset type: production 4×4 game world-prop sprite source sheet
Primary request: transform every one of the sixteen objects into its distinct mid-opening or mid-search state while preserving all sixteen object identities and their exact cell positions.
Input image: the supplied world-closed.png is the edit target and identity/style reference.
Composition/framing: preserve the exact 4 columns × 4 rows, row-major ordering, one centered object per cell, identical object scale, visual center, and ground contact point to the reference. Keep generous transparent separation between cells.
Style/medium: post-apocalyptic industrial pixel illustration, crisp dark outline, three-quarter top-down view, same pixel density, same palette and same light direction as the reference.
State details by cell: crate lids partially raised; safe door partly rotated open; airdrop case partly unlatched; buried cache hatch partly open; weapon case lid partly open; medical cabinet door partly open; scrap/alloy piles visibly disturbed with one piece lifting; circuit cache activated and partly accessed; energy crate vents opening; fuel drum cap loosened with subtle safe glow, no explosion; ration tin pull tab partly peeled; blueprint tube cap partly removed and scroll beginning to emerge; mutation pod seal unlocked with contained magenta light.
Constraints: change only the opening/search state. Preserve identity, proportions, palette, symbols, materials, outline weight, lighting, camera angle, cell order, and anchor. Actual transparent background. No checkerboard, no black background, no text labels, no captions, no watermark, no scenery, no extra objects, no cropped edges, no shadows or particles crossing cell boundaries.
```

## world-opened.png

```text
Use case: precise-object-edit
Asset type: production 4×4 game world-prop sprite source sheet
Primary request: create the final fully opened / fully searched state for the same sixteen objects.
Input images: world-closed.png is the identity, order, palette, anchor and composition reference; world-opening.png is the matching mid-state reference whose motion must resolve naturally into the final state.
Composition/framing: exact 4 columns × 4 rows, row-major order, one centered object per cell, identical scale, visual center, and ground contact point. Keep transparent separation between cells.
Style/medium: same post-apocalyptic industrial pixel illustration, crisp dark outline, three-quarter top-down view, palette, pixel density and light direction.
Final-state details: lids and doors fully open with interiors clearly visible and mostly empty; airdrop case open beneath its canopy; hidden-cache hatch fully open; medical cabinet open; scrap and alloy piles visibly reduced and searched; circuit cache accessed with the loose chip set aside; energy crate open and depleted; fuel drum cap removed without spill or explosion; ration tin fully peeled and empty; blueprint tube uncapped with the blueprint collected; mutation pod open/depleted but not broken. Preserve safety and readable silhouette.
Constraints: change only the final opened/searched state. Preserve all identities, stable symbols, proportions, palette, materials, outline weight, camera angle, cell order and anchor. Actual transparent background. No checkerboard, no black background, no text labels, no captions, no watermark, no scenery, no extra loot floating outside objects, no cropped edges, no cross-cell effects.
```

## icons-opening.png

```text
Use case: precise-object-edit
Asset type: production 4×4 game UI icon source sheet
Primary request: create the opening-in-progress UI icon state for all sixteen loot objects.
Input images: icons-closed.png is the edit target and locks the circular plate, cyan border, ordering, scale and icon identity; world-opening.png supplies the matching half-open object silhouettes.
Composition/framing: exact 4 columns × 4 rows, row-major order, one centered circular icon per cell, identical circle diameter and cell center to icons-closed.png. No overlap between cells.
Style/medium: same post-apocalyptic industrial pixel UI, crisp dark outline, dark navy circular plate, bright cyan pixel border, same palette and lighting.
State treatment: place each matching half-open/searched silhouette inside its unchanged circular plate; add one small contained radial highlight behind the object to communicate motion, never crossing the cyan border. Keep object readable at 48–64 pixels.
Constraints: preserve exact plate and border geometry, object identity, cell order, symbol, palette, camera angle and outline. Actual transparent background outside the circular icons. No checkerboard, no black canvas, no text, no captions, no watermark, no extra badges, no cropped edges, no effects crossing cells.
```

## icons-opened.png

```text
Use case: precise-object-edit
Asset type: production 4×4 game UI icon source sheet
Primary request: create the final opened / searched / collected UI icon state for all sixteen loot objects.
Input images: icons-closed.png locks every circular plate, cyan border, ordering, scale and identity; world-opened.png supplies the matching fully opened and depleted silhouettes.
Composition/framing: exact 4 columns × 4 rows, row-major order, one centered circular icon per cell, identical circle diameter and center to icons-closed.png, no overlap.
Style/medium: same post-apocalyptic industrial pixel UI with crisp dark outline, dark navy circular plate, same cyan pixel border and light direction.
State treatment: use the matching fully opened or searched silhouette, visibly empty/depleted; reduce only the inner object brightness slightly while preserving readability; add a small high-contrast off-white check mark badge in the lower-right inside each circle without covering the object. The check mark shape and position must be consistent in all sixteen cells and remain readable at 48–64 pixels.
Constraints: preserve exact plate and border geometry, object identity, cell order, stable symbols, palette family, camera angle and outline. Actual transparent background outside circles. No checkerboard, no black canvas, no text, no captions, no watermark, no extra badges, no cropped edges, no effects crossing cells.
```

## effects.png

```text
Use case: stylized-concept
Asset type: production game VFX sprite source sheet
Primary request: create exactly eight isolated reusable loot-opening effects arranged in a strict 4 columns × 2 rows grid on a wide 2:1 transparent canvas.
Ordering, row 1 left to right: warm gold interaction ring; cyan technology ring; magenta contamination ring; white-gold four-point rare starburst.
Ordering, row 2 left to right: white-gold radial opening flash; small cyan/gold diamond particle cluster; upward reward trail made of three short light streaks; soft pale-cyan completed glow.
Style/medium: post-apocalyptic industrial pixel-art UI VFX, crisp pixel clusters, controlled bloom, high contrast, compatible with the project's dark navy/cyan/orange interface.
Composition: one centered effect per equal square cell; generous transparent padding; effects stay fully inside their cells and never touch neighboring cells. Rings are front-facing ellipses suitable beneath a three-quarter-view object. Star and flash use clean radial symmetry. Particle cluster contains only small squares/diamonds. Trail points upward.
Constraints: actual transparent background; no chests or objects; no text; no labels; no captions; no borders; no grid lines; no checkerboard; no black canvas; no watermark; no cropped effects; no cross-cell glow or overlap.
```
