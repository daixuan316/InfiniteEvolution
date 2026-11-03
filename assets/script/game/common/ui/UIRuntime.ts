import { Node } from "cc";

import { oops } from "../../../../../extensions/oops-plugin-framework/assets/core/Oops";
import { UIID } from "../config/GameUIConfig";
import type { RouteKey } from "./NavigationStack.ts";
import { UIPageBootstrap } from "./UIPageBootstrap";
import { PageParams, UIGateway, UINavigationService } from "./UINavigationService.ts";

class OopsUIGateway implements UIGateway {
    async open(route: RouteKey, params: PageParams): Promise<void> {
        const node: Node = await oops.gui.open(route as UIID, { ...params, uiid: route });
        if (!node) throw new Error(`UI ${String(route)} returned no node`);
        UIPageBootstrap.attach(route, node, params);
    }

    remove(route: RouteKey): void {
        oops.gui.remove(route as UIID);
    }

    toast(message: string): void {
        oops.gui.toast(message);
    }
}

export const uiNavigation = new UINavigationService(new OopsUIGateway(), UIID.Hall);
