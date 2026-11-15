import { Component, isValid, Node } from "cc";

import { UIBuilder } from "./UIBuilder";
import type { PageParams } from "./UINavigationService.ts";

/** Shared view lifecycle: configure once per open and dispose every listener on destroy. */
export abstract class GamePage extends Component {
    protected params: PageParams = {};
    private disposers: Array<() => void> = [];

    configure(params: PageParams): void {
        this.params = params;
    }

    protected bindTouch(node: Node, handler: () => void): void {
        UIBuilder.pressable(node);
        node.on(Node.EventType.TOUCH_END, handler, this);
        this.disposers.push(() => {
            if (isValid(node, true)) {
                node.off(Node.EventType.TOUCH_END, handler, this);
            }
        });
    }

    protected clearBindings(): void {
        while (this.disposers.length > 0) {
            this.disposers.pop()!();
        }
    }

    protected onDestroy(): void {
        this.clearBindings();
    }
}
