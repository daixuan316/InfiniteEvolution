import type { DayPressure } from "./DayClock.ts";

export type DayFlowAction = "continue" | "return-to-shelter";

/** Converts the clock's night boundary into a single navigation request. */
export class DayPhaseFlow {
    private returnRequested = false;

    update(pressure: DayPressure): DayFlowAction {
        if (this.returnRequested || (pressure !== "night" && pressure !== "hunt")) return "continue";
        this.returnRequested = true;
        return "return-to-shelter";
    }
}
