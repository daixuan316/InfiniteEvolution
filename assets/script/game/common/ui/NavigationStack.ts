export type RouteKey = string | number;

export interface NavigationEntry {
    route: RouteKey;
    params?: Readonly<Record<string, unknown>>;
}

export type BackResult =
    | { kind: "overlay"; entry: NavigationEntry }
    | { kind: "page"; entry: NavigationEntry }
    | { kind: "root"; entry: NavigationEntry | null };

export interface NavigationSnapshot {
    pages: NavigationEntry[];
    overlays: NavigationEntry[];
}

/** Pure navigation state. Rendering and asset lifetime stay in UINavigationService. */
export class NavigationStack {
    private pages: NavigationEntry[] = [];
    private overlays: NavigationEntry[] = [];

    get current(): NavigationEntry | null {
        return this.pages[this.pages.length - 1] ?? null;
    }

    get topOverlay(): NavigationEntry | null {
        return this.overlays[this.overlays.length - 1] ?? null;
    }

    reset(root: NavigationEntry): void {
        this.pages = [root];
        this.overlays = [];
    }

    push(entry: NavigationEntry): void {
        if (this.current?.route !== entry.route) {
            this.pages.push(entry);
        }
    }

    replace(entry: NavigationEntry): void {
        this.pages = [entry];
        this.overlays = [];
    }

    pop(): NavigationEntry | null {
        if (this.pages.length > 1) {
            this.pages.pop();
        }
        return this.current;
    }

    openOverlay(entry: NavigationEntry): void {
        if (this.topOverlay?.route !== entry.route) {
            this.overlays.push(entry);
        }
    }

    closeOverlay(): NavigationEntry | null {
        return this.overlays.pop() ?? null;
    }

    back(): BackResult {
        const overlay = this.closeOverlay();
        if (overlay) {
            return { kind: "overlay", entry: overlay };
        }

        if (this.pages.length > 1) {
            this.pages.pop();
            return { kind: "page", entry: this.current! };
        }

        return { kind: "root", entry: this.current };
    }

    snapshot(): NavigationSnapshot {
        return {
            pages: [...this.pages],
            overlays: [...this.overlays],
        };
    }
}
