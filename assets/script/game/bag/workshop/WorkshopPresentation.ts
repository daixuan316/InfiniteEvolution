import type { EnqueueFailure } from "./WorkshopTypes.ts";

export function formatRemainingTime(remainingMs: number): string {
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) return "00:00";
    const totalSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function actionTextForReason(reason: EnqueueFailure | null): string {
    switch (reason) {
        case "materials-missing": return "材料不足";
        case "queue-full": return "队列已满";
        case "output-full": return "仓库空间不足";
        case "recipe-locked": return "配方未解锁";
        case "recipe-missing": return "配方不存在";
        case "save-failed": return "保存失败";
        default: return "开始制造";
    }
}

export interface MaterialRequirementLayout {
    rows: number[];
    footerY: number;
}

export function materialRequirementLayout(height: number, rowCount: number): MaterialRequirementLayout {
    const safeHeight = Number.isFinite(height) ? Math.max(120, height) : 120;
    const count = Number.isSafeInteger(rowCount) ? Math.max(0, rowCount) : 0;
    const firstRowY = safeHeight / 2 - 78;
    const footerY = -safeHeight / 2 + 26;
    const lastRowY = footerY + 36;
    if (count === 0) return { rows: [], footerY };
    if (count === 1) return { rows: [firstRowY], footerY };
    const spacing = Math.min(54, (firstRowY - lastRowY) / (count - 1));
    return {
        rows: Array.from({ length: count }, (_, index) => firstRowY - spacing * index),
        footerY,
    };
}
