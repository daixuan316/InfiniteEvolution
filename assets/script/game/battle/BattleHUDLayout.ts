export interface BattleSafeEdges {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface LayoutRect {
    centerX: number;
    centerY: number;
    width: number;
    height: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export interface BattleControlLayout {
    primaryAction: LayoutRect;
    skillAction: LayoutRect;
    dodgeAction: LayoutRect;
    returnArk: LayoutRect;
}

export interface BattlePlayerStatusLayout {
    content: LayoutRect;
    healthBar: LayoutRect;
    healthText: LayoutRect;
    shieldBar: LayoutRect;
    shieldText: LayoutRect;
    pollutionText: LayoutRect;
    downedText: LayoutRect;
}

function centeredRect(centerX: number, centerY: number, width: number, height: number): LayoutRect {
    return {
        centerX,
        centerY,
        width,
        height,
        left: centerX - width / 2,
        right: centerX + width / 2,
        top: centerY + height / 2,
        bottom: centerY - height / 2,
    };
}

export function battleControlLayout(frame: BattleSafeEdges): BattleControlLayout {
    const actionX = frame.right - 118;
    const actionY = frame.bottom + 122;
    return {
        primaryAction: centeredRect(actionX, actionY, 154, 154),
        skillAction: centeredRect(actionX - 130, actionY + 38, 112, 112),
        dodgeAction: centeredRect(actionX - 54, actionY + 132, 100, 100),
        returnArk: centeredRect(frame.right - 104, frame.top - 238, 164, 64),
    };
}

export function playerStatusLayout(): BattlePlayerStatusLayout {
    return {
        content: centeredRect(19, -5, 322, 106),
        healthBar: centeredRect(26, 31, 278, 24),
        healthText: centeredRect(70, 31, 170, 24),
        shieldBar: centeredRect(7, -15, 240, 16),
        shieldText: centeredRect(-3, 7, 220, 18),
        pollutionText: centeredRect(-28, -37, 170, 18),
        downedText: centeredRect(120, -37, 110, 22),
    };
}

export function rectanglesOverlap(a: LayoutRect, b: LayoutRect): boolean {
    return a.left < b.right && a.right > b.left && a.bottom < b.top && a.top > b.bottom;
}
