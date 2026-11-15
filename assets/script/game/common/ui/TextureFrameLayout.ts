export interface TextureFrameLayout {
    x: number;
    y: number;
    width: number;
    height: number;
    borderTop?: number;
    borderBottom?: number;
    borderLeft?: number;
    borderRight?: number;
}

const COMMON = "gui/ui-p0/texture/common";
const EXPLORATION_HUD = "gui/ui-p0/texture/exploration-hud";
const TOUCH = "gui/ui-p0/texture/touch-tutorial";

/**
 * Generated P0 component PNGs live on 256×256 transparent canvases. These
 * measurements isolate their authored pixels so runtime scaling operates on
 * the component itself instead of also stretching its transparent padding.
 * Y is expressed from the texture top, matching Cocos SpriteFrame.rect UVs.
 */
const TEXTURE_FRAME_LAYOUTS: Readonly<Record<string, TextureFrameLayout>> = {
    [`${COMMON}/01-panel-large`]: { x: 10, y: 81, width: 246, height: 175, borderTop: 32, borderBottom: 32, borderLeft: 36, borderRight: 36 },
    [`${COMMON}/02-panel-medium`]: { x: 15, y: 105, width: 241, height: 149, borderTop: 28, borderBottom: 28, borderLeft: 34, borderRight: 34 },
    [`${COMMON}/03-card-compact`]: { x: 61, y: 86, width: 161, height: 170, borderTop: 28, borderBottom: 28, borderLeft: 28, borderRight: 28 },
    [`${COMMON}/04-tooltip`]: { x: 22, y: 127, width: 216, height: 121, borderTop: 24, borderBottom: 24, borderLeft: 28, borderRight: 28 },
    [`${COMMON}/05-button-primary`]: { x: 22, y: 121, width: 228, height: 110, borderTop: 26, borderBottom: 26, borderLeft: 34, borderRight: 34 },
    [`${COMMON}/06-button-secondary`]: { x: 27, y: 122, width: 227, height: 109, borderTop: 26, borderBottom: 26, borderLeft: 34, borderRight: 34 },
    [`${COMMON}/07-button-warning`]: { x: 30, y: 122, width: 222, height: 109, borderTop: 26, borderBottom: 26, borderLeft: 34, borderRight: 34 },
    [`${COMMON}/08-button-danger`]: { x: 21, y: 122, width: 220, height: 109, borderTop: 26, borderBottom: 26, borderLeft: 34, borderRight: 34 },
    [`${COMMON}/09-tab-inactive`]: { x: 24, y: 127, width: 221, height: 92, borderTop: 22, borderBottom: 22, borderLeft: 30, borderRight: 30 },
    [`${COMMON}/10-tab-selected`]: { x: 27, y: 127, width: 221, height: 92, borderTop: 22, borderBottom: 22, borderLeft: 30, borderRight: 30 },
    [`${COMMON}/11-slot-empty`]: { x: 34, y: 67, width: 192, height: 170, borderTop: 28, borderBottom: 28, borderLeft: 28, borderRight: 28 },
    [`${COMMON}/12-slot-selected`]: { x: 30, y: 69, width: 191, height: 168, borderTop: 28, borderBottom: 28, borderLeft: 28, borderRight: 28 },
    [`${COMMON}/13-bar-status`]: { x: 17, y: 108, width: 232, height: 70, borderTop: 18, borderBottom: 18, borderLeft: 24, borderRight: 24 },

    [`${EXPLORATION_HUD}/01-player-health-frame`]: { x: 20, y: 112, width: 236, height: 89 },
    [`${EXPLORATION_HUD}/05-day-timer-frame`]: { x: 29, y: 95, width: 227, height: 90 },
    [`${EXPLORATION_HUD}/09-minimap-bezel`]: { x: 46, y: 35, width: 189, height: 196 },

    [`${TOUCH}/01-joystick-base`]: { x: 35, y: 31, width: 221, height: 225 },
    [`${TOUCH}/02-joystick-thumb`]: { x: 77, y: 83, width: 131, height: 134 },
    [`${TOUCH}/03-action-button-large`]: { x: 21, y: 45, width: 211, height: 211 },
    [`${TOUCH}/04-action-button-medium`]: { x: 37, y: 77, width: 157, height: 153 },
};

export function textureFrameLayout(assetPath: string): TextureFrameLayout | undefined {
    return TEXTURE_FRAME_LAYOUTS[assetPath];
}
