import type { BattleMapDefinition, GridPoint, WorldPoint } from "../../battle/BattleMapModel.ts";

export type IntelTargetId = "hospital" | "depot" | "signal";
export type IntelRisk = "low" | "medium" | "high";
export type IntelEventStatus = "known" | "undetected";

export interface IntelTargetDefinition {
    readonly id: IntelTargetId;
    readonly locationName: string;
    readonly objectiveTitle: string;
    readonly summary: string;
    readonly risk: IntelRisk;
    readonly rewardLabels: readonly string[];
    readonly estimatedMinutes: number;
    readonly cell: GridPoint;
}

export interface IntelEventDefinition {
    readonly id: "rescue-beacon" | "radar-terminal" | "hidden-cache";
    readonly title: string;
    readonly status: IntelEventStatus;
    readonly detail: string;
}

export const INTEL_TARGETS: readonly IntelTargetDefinition[] = [
    {
        id: "hospital",
        locationName: "战地医院",
        objectiveTitle: "搜索医疗补给",
        summary: "清理医院外围并调查医疗终端。",
        risk: "medium",
        rewardLabels: ["医疗物资", "医疗终端"],
        estimatedMinutes: 3,
        cell: { x: 14, y: 12 },
    },
    {
        id: "depot",
        locationName: "物资仓库",
        objectiveTitle: "回收建造材料",
        summary: "突破仓库防线并回收补给箱。",
        risk: "high",
        rewardLabels: ["废料", "零件", "补给箱"],
        estimatedMinutes: 4,
        cell: { x: 24, y: 19 },
    },
    {
        id: "signal",
        locationName: "信号塔",
        objectiveTitle: "调查异常信号",
        summary: "抵达信号塔并确认求救信号来源。",
        risk: "high",
        rewardLabels: ["弹药", "零件", "情报"],
        estimatedMinutes: 5,
        cell: { x: 38, y: 3 },
    },
];

export const INTEL_EVENTS: readonly IntelEventDefinition[] = [
    { id: "rescue-beacon", title: "求救信标", status: "known", detail: "现场可能存在幸存者与感染者。" },
    { id: "radar-terminal", title: "雷达终端", status: "known", detail: "调查后可揭示隐藏缓存。" },
    { id: "hidden-cache", title: "隐藏缓存点", status: "undetected", detail: "待雷达侦测，坐标未知。" },
];

export const NEXT_HORDE_FORECAST = {
    threat: "中等",
    enemies: ["奔袭者", "巨力怪"],
    advice: "准备减速火力与高耐久路障。",
} as const;

export function findIntelTarget(id: unknown): IntelTargetDefinition | null {
    return INTEL_TARGETS.find((target) => target.id === id) ?? null;
}

export function intelTargetWorldPoint(target: IntelTargetDefinition, map: BattleMapDefinition): WorldPoint {
    return map.cellToWorld(target.cell);
}

export function intelTargetDistanceMeters(target: IntelTargetDefinition, map: BattleMapDefinition): number {
    const start = map.cellToWorld(map.start);
    const end = intelTargetWorldPoint(target, map);
    return Math.ceil(Math.hypot(end.x - start.x, end.y - start.y) / 4);
}

export function isIntelTargetReached(
    target: IntelTargetDefinition,
    player: WorldPoint,
    map: BattleMapDefinition,
    radius = 180,
): boolean {
    const point = intelTargetWorldPoint(target, map);
    return Math.hypot(point.x - player.x, point.y - player.y) <= radius;
}
