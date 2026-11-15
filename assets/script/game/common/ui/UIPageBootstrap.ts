import { Component, Node } from "cc";

import type { RouteKey } from "./NavigationStack.ts";
import type { PageParams } from "./UINavigationService.ts";

export type PageComponent = Component & { configure?(params: PageParams): void };
export type PageComponentConstructor = new () => PageComponent;

/** Attaches view controllers to lightweight prefab roots without coupling navigation to pages. */
export class UIPageBootstrap {
    private static readonly registry = new Map<RouteKey, PageComponentConstructor>();

    static register(route: RouteKey, component: PageComponentConstructor): void {
        this.registry.set(route, component);
    }

    static attach(route: RouteKey, node: Node, params: PageParams): PageComponent | null {
        const constructor = this.registry.get(route);
        if (!constructor) return null;

        let component = node.getComponent(constructor as any) as PageComponent | null;
        if (!component) component = node.addComponent(constructor as any) as PageComponent;
        component.configure?.(params);
        return component;
    }
}
