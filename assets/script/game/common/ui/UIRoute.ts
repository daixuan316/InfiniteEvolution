import { UIID } from "../config/GameUIConfig";
import { FEATURE_ICON_ASSETS } from "./UIIconAssets";

export interface UIRouteDefinition {
    id: UIID;
    title: string;
    icon: string;
    kind: "page" | "overlay" | "dialog";
}

export const FEATURE_ROUTES: readonly UIRouteDefinition[] = [
    { id: UIID.Equipment, title: "装备", icon: FEATURE_ICON_ASSETS.equipment, kind: "page" },
    { id: UIID.Workshop, title: "工坊", icon: FEATURE_ICON_ASSETS.workshop, kind: "page" },
    { id: UIID.ArkBuild, title: "建设", icon: FEATURE_ICON_ASSETS.arkBuild, kind: "page" },
    { id: UIID.Research, title: "研究", icon: FEATURE_ICON_ASSETS.research, kind: "page" },
    { id: UIID.Crew, title: "成员", icon: FEATURE_ICON_ASSETS.crew, kind: "page" },
    { id: UIID.Intel, title: "情报", icon: FEATURE_ICON_ASSETS.intel, kind: "page" },
];
