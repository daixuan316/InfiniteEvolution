# Responsive Surface Frame Design

## Goal

Remove the visible stretching of authored panel decorations when Cocos Creator UI surfaces are rendered at very wide or tall aspect ratios. The hall top bar and side panels must retain the existing industrial visual language without elongating the amber side modules or the yellow-black caution strip.

## Root Cause

`UIBuilder.surface` currently renders the complete `01-panel-large` bitmap as one nine-sliced sprite. Although its corners are protected by slice borders, the source image also contains authored decorations inside the horizontally and vertically stretchable center regions. A wide surface therefore elongates the bottom caution strip, while a tall surface elongates the amber side modules.

## Chosen Design

Render large surfaces as a composited frame instead of stretching the complete decorated bitmap:

1. Keep the existing programmatic cut-corner panel as the opaque fill and fallback border.
2. Divide the authored large-panel frame into fixed corner and decoration regions plus neutral edge regions.
3. Place corner and decoration regions at their authored size. The top badge, bottom caution plate, and left/right amber modules remain centered on their respective edges and never scale along their decorated axis.
4. Stretch or tile only neutral edge regions between the fixed pieces.
5. Keep the current single-sprite nine-slice path for surface kinds whose target geometry is close to the source proportions and whose decoration is not visibly distorted.

The composition belongs in `UIBuilder`, not `HallViewComp`, because the defect originates in the shared surface renderer and can affect every large panel.

## Components

### Texture frame layout

Extend the existing texture layout metadata with the authored regions needed for the large-panel composition. Region coordinates remain centralized beside the current crop and border metadata so they can be validated without scattering pixel constants through view code.

### UIBuilder surface renderer

Add a private large-surface frame path that:

- loads the existing large-panel texture once through the project resource loader;
- creates child sprites from explicit source rectangles;
- preserves fixed regions at their authored dimensions, reducing them uniformly only when the target is smaller than the minimum supported frame;
- sizes only neutral rails to fill the remaining horizontal or vertical span;
- leaves the programmatic panel visible if texture loading fails.

`UIBuilder.surface` keeps its public API. Hall and feature-page callers require no layout changes.

### Small-size fallback

If a target surface cannot fit the fixed decorations without overlap, the renderer uses the existing nine-sliced frame. This preserves current behavior for compact dialogs and avoids clipping or negative rail sizes.

## Data Flow

`UIBuilder.surface` creates the programmatic panel, selects the surface asset, and checks whether the asset is the large panel. Large panels enter the composited-frame renderer; other kinds retain the existing nine-slice renderer. The renderer reads region metadata, loads the texture, creates the fixed pieces and neutral rails, and attaches them beneath content nodes.

## Failure Handling

- Missing texture or invalid node: retain the programmatic panel and destroy incomplete decorative children.
- Invalid or undersized target geometry: use the existing nine-slice fallback.
- Missing region metadata: use the existing nine-slice fallback.
- Asynchronous completion after node destruction: perform the same validity checks already used by `UIBuilder.sprite`.

## Verification

Automated checks will cover:

- selection of the composited path for the large surface asset;
- fixed decoration dimensions for both wide and tall target sizes;
- non-negative neutral rail dimensions;
- fallback behavior for compact targets or absent layout metadata;
- preservation of the existing public `UIBuilder.surface` API and other surface kinds.

The existing UI test suite must remain green. Visual verification will cover at least:

- the hall top bar at approximately `1278 × 82`;
- the hall left and right panels at approximately `258 × 500`;
- a conventional dialog-sized large panel;
- the project's reference resolution and one wider aspect ratio.

## Scope

This change fixes shared large-panel frame rendering only. It does not redesign hall information hierarchy, change labels, modify gameplay data, or replace the source artwork.
