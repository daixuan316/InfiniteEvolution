import { Color } from "cc";

/**
 * 全局 UI 视觉规范（成熟废土生存风）。
 *
 * 配色以暖炭灰为底，强调色收敛为琥珀金；护盾/安全用低饱和苔青，
 * 危险与追猎保留暖红、降饱和玫红。所有界面统一从这里取色与度量，
 * 新增界面不得在局部脚本里写死霓虹色值。
 */
export const UI_THEME = {
    designWidth: 1334,
    designHeight: 750,
    safeMargin: 28,
    touchMin: 72,
    /** 圆角半径（px） */
    radius: {
        panel: 14,
        small: 8,
        bar: 6,
        chip: 10,
    },
    /** 描边宽度（px） */
    stroke: {
        width: 1.5,
        softWidth: 1,
    },
    colors: {
        /** 场景最底层底色 */
        background: new Color(17, 19, 18, 255),
        /** 主面板：暖焦油灰 */
        panel: new Color(31, 34, 32, 238),
        /** 次级面板/按钮底板 */
        panelSoft: new Color(44, 48, 44, 232),
        /** 主行动 / 选中 / 关键数值：琥珀金 */
        amber: new Color(216, 166, 82, 255),
        /** 护盾 / 安全 / 探索点：低饱和苔青（沿用旧 key 名 cyan） */
        cyan: new Color(104, 180, 168, 255),
        cyanDark: new Color(62, 88, 82, 255),
        /** 警告 / 计时 / 战利品：暖橙 */
        orange: new Color(214, 138, 66, 255),
        /** 精英 / 追猎 / 污染：降饱和玫红 */
        magenta: new Color(198, 84, 130, 255),
        danger: new Color(198, 74, 66, 255),
        success: new Color(96, 178, 118, 255),
        white: new Color(233, 230, 220, 255),
        muted: new Color(151, 154, 144, 255),
        black: new Color(11, 12, 11, 255),
    },
    font: {
        title: 34,
        heading: 24,
        body: 19,
        caption: 15,
        number: 26,
    },
} as const;
