import { UIID } from "../config/GameUIConfig";

export interface UIRouteDefinition {
    id: UIID;
    title: string;
    icon: string;
    kind: "page" | "overlay" | "dialog";
}

export const FEATURE_ROUTES: readonly UIRouteDefinition[] = [
    { id: UIID.Equipment, title: "装备", icon: "storage", kind: "page" },
    { id: UIID.Workshop, title: "工坊", icon: "workshop", kind: "page" },
    { id: UIID.ArkBuild, title: "建设", icon: "layout", kind: "page" },
    { id: UIID.Research, title: "研究", icon: "research", kind: "page" },
    { id: UIID.Crew, title: "成员", icon: "crew", kind: "page" },
    { id: UIID.Intel, title: "情报", icon: "map", kind: "page" },
];
