import { Node } from "cc";

import { oops } from "../../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { BattleHUDViewComp } from "../../battle/BattleHUDViewComp";
import { NightDefenseViewComp } from "../../battle/NightDefenseViewComp";
import { HallViewComp } from "../../hall/HallViewComp";
import { EquipmentViewComp } from "../../equipment/view/EquipmentViewComp";
import { IntelPageViewComp } from "../../intel/IntelPageViewComp";
import { ResearchViewComp } from "../../research/ResearchViewComp";
import { ConfirmDialogViewComp } from "../../ui/ConfirmDialogViewComp";
import { FeaturePageViewComp } from "../../ui/FeaturePageViewComp";
import { PauseOverlayViewComp } from "../../ui/PauseOverlayViewComp";
import { ArkBuildViewComp } from "../../shelter/ArkBuildViewComp";
import { WorkshopViewComp } from "../../ui/WorkshopViewComp";
import { UIID } from "../config/GameUIConfig";
import type { RouteKey } from "./NavigationStack.ts";
import { UIPageBootstrap } from "./UIPageBootstrap";
import { UINavigationService } from "./UINavigationService.ts";
import type { PageParams, UIGateway } from "./UINavigationService.ts";

class OopsUIGateway implements UIGateway {
    async open(route: RouteKey, params: PageParams): Promise<void> {
        const data = { ...params, uiid: route };
        const node: Node = await oops.gui.open(route as UIID, { data });
        if (!node) throw new Error(`UI ${String(route)} returned no node`);
        UIPageBootstrap.attach(route, node, data);
    }

    remove(route: RouteKey): void {
        oops.gui.remove(route as UIID);
    }

    toast(message: string): void {
        oops.gui.toast(message);
    }
}

export const uiNavigation = new UINavigationService(new OopsUIGateway(), UIID.Hall);

UIPageBootstrap.register(UIID.Hall, HallViewComp);
UIPageBootstrap.register(UIID.Equipment, EquipmentViewComp);
UIPageBootstrap.register(UIID.Workshop, WorkshopViewComp);
UIPageBootstrap.register(UIID.ArkBuild, ArkBuildViewComp);
UIPageBootstrap.register(UIID.Research, ResearchViewComp);
UIPageBootstrap.register(UIID.Crew, FeaturePageViewComp);
UIPageBootstrap.register(UIID.Intel, IntelPageViewComp);
UIPageBootstrap.register(UIID.BattleHUD, BattleHUDViewComp);
UIPageBootstrap.register(UIID.NightDefense, NightDefenseViewComp);
UIPageBootstrap.register(UIID.PauseOverlay, PauseOverlayViewComp);
UIPageBootstrap.register(UIID.ConfirmDialog, ConfirmDialogViewComp);
