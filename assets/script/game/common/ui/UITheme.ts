import { Color } from "cc";

export const UI_THEME = {
    designWidth: 1334,
    designHeight: 750,
    safeMargin: 28,
    touchMin: 72,
    colors: {
        background: new Color(5, 18, 31, 255),
        panel: new Color(8, 32, 49, 246),
        panelSoft: new Color(14, 48, 68, 232),
        cyan: new Color(36, 228, 239, 255),
        cyanDark: new Color(14, 99, 118, 255),
        orange: new Color(255, 169, 31, 255),
        magenta: new Color(244, 42, 147, 255),
        danger: new Color(235, 69, 75, 255),
        success: new Color(66, 211, 145, 255),
        white: new Color(239, 248, 250, 255),
        muted: new Color(148, 177, 190, 255),
        black: new Color(2, 9, 15, 255),
    },
    font: {
        title: 36,
        heading: 26,
        body: 20,
        caption: 16,
        number: 28,
    },
} as const;
