import { NavigationStack } from "./NavigationStack.ts";
import type { NavigationEntry, NavigationSnapshot, RouteKey } from "./NavigationStack.ts";

export type PageParams = Readonly<Record<string, unknown>>;

export interface UIGateway {
    open(route: RouteKey, params: PageParams): Promise<void>;
    remove(route: RouteKey): void;
    toast(message: string): void;
}

/** Coordinates atomic UI transitions while NavigationStack owns pure state. */
export class UINavigationService {
    private readonly stack = new NavigationStack();
    private transitioning = false;
    private readonly gateway: UIGateway;
    private readonly rootRoute: RouteKey;

    constructor(gateway: UIGateway, rootRoute: RouteKey) {
        this.gateway = gateway;
        this.rootRoute = rootRoute;
    }

    get currentRoute(): RouteKey | null {
        return this.stack.current?.route ?? null;
    }

    get topOverlayRoute(): RouteKey | null {
        return this.stack.topOverlay?.route ?? null;
    }

    get isTransitioning(): boolean {
        return this.transitioning;
    }

    snapshot(): NavigationSnapshot {
        return this.stack.snapshot();
    }

    async enterRoot(route: RouteKey = this.rootRoute, params: PageParams = {}): Promise<boolean> {
        if (this.transitioning) return false;
        this.transitioning = true;
        const previous = this.stack.snapshot();
        try {
            await this.gateway.open(route, params);
            this.stack.reset({ route, params });
            this.removeEntries(previous, route);
            return true;
        } catch (error) {
            this.onFailure(route, error);
            return false;
        } finally {
            this.transitioning = false;
        }
    }

    async push(route: RouteKey, params: PageParams = {}): Promise<boolean> {
        if (this.transitioning || this.currentRoute === route) return false;
        this.transitioning = true;
        const previous = this.stack.current;
        try {
            await this.gateway.open(route, params);
            this.stack.push({ route, params });
            if (previous) this.gateway.remove(previous.route);
            return true;
        } catch (error) {
            this.onFailure(route, error);
            return false;
        } finally {
            this.transitioning = false;
        }
    }

    async replace(route: RouteKey, params: PageParams = {}): Promise<boolean> {
        if (this.transitioning || (this.currentRoute === route && !this.topOverlayRoute)) return false;
        this.transitioning = true;
        const previous = this.stack.snapshot();
        try {
            await this.gateway.open(route, params);
            this.stack.replace({ route, params });
            this.removeEntries(previous, route);
            return true;
        } catch (error) {
            this.onFailure(route, error);
            return false;
        } finally {
            this.transitioning = false;
        }
    }

    async resetToRoot(params: PageParams = {}): Promise<boolean> {
        return this.replace(this.rootRoute, params);
    }

    async openOverlay(route: RouteKey, params: PageParams = {}): Promise<boolean> {
        if (this.transitioning || this.topOverlayRoute === route) return false;
        this.transitioning = true;
        try {
            await this.gateway.open(route, params);
            this.stack.openOverlay({ route, params });
            return true;
        } catch (error) {
            this.onFailure(route, error);
            return false;
        } finally {
            this.transitioning = false;
        }
    }

    closeOverlay(route: RouteKey = this.topOverlayRoute!): boolean {
        const current = this.stack.topOverlay;
        if (!current || current.route !== route) return false;
        this.gateway.remove(current.route);
        this.stack.closeOverlay();
        return true;
    }

    async back(): Promise<boolean> {
        if (this.transitioning) return false;

        const overlay = this.stack.topOverlay;
        if (overlay) {
            this.gateway.remove(overlay.route);
            this.stack.closeOverlay();
            return true;
        }

        const snapshot = this.stack.snapshot();
        if (snapshot.pages.length <= 1) return false;

        this.transitioning = true;
        const current = snapshot.pages[snapshot.pages.length - 1];
        const destination = snapshot.pages[snapshot.pages.length - 2];
        try {
            await this.gateway.open(destination.route, destination.params ?? {});
            this.stack.pop();
            this.gateway.remove(current.route);
            return true;
        } catch (error) {
            this.onFailure(destination.route, error);
            return false;
        } finally {
            this.transitioning = false;
        }
    }

    private removeEntries(snapshot: NavigationSnapshot, except: RouteKey): void {
        const removed = new Set<RouteKey>();
        const entries: NavigationEntry[] = [...snapshot.overlays].reverse().concat([...snapshot.pages].reverse());
        for (const entry of entries) {
            if (entry.route !== except && !removed.has(entry.route)) {
                this.gateway.remove(entry.route);
                removed.add(entry.route);
            }
        }
    }

    private onFailure(route: RouteKey, error: unknown): void {
        console.error("UI navigation failed", route, error);
        this.gateway.toast("界面加载失败，请重试");
    }
}
