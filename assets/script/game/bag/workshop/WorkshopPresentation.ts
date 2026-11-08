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
