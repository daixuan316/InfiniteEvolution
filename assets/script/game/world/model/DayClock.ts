export type DayPressure = "safe" | "warning" | "night" | "hunt";

export function explorationTimeScale(systemPaused: boolean, reducedTimeMode: boolean): number {
    if (systemPaused) return 0;
    return reducedTimeMode ? 0.2 : 1;
}

export class DayClock {
    readonly duration: number;
    remaining: number;
    private readonly warningAt: number;
    private readonly nightAt: number;
    private readonly huntAt: number;

    constructor(
        duration: number,
        warningAt: number,
        nightAt: number,
        huntAt: number,
    ) {
        if (!Number.isFinite(duration) || duration <= 0) {
            throw new RangeError("DayClock duration must be a positive finite number");
        }
        this.duration = duration;
        this.remaining = duration;
        this.warningAt = warningAt;
        this.nightAt = nightAt;
        this.huntAt = huntAt;
    }

    tick(realDeltaTime: number, timeScale = 1): void {
        if (!Number.isFinite(realDeltaTime) || realDeltaTime <= 0) return;
        if (!Number.isFinite(timeScale) || timeScale <= 0) return;
        this.remaining -= realDeltaTime * timeScale;
    }

    get remainingRatio(): number {
        return Math.max(0, Math.min(1, this.remaining / this.duration));
    }

    get pressure(): DayPressure {
        if (this.remaining <= this.huntAt) return "hunt";
        if (this.remaining <= this.nightAt) return "night";
        if (this.remaining <= this.warningAt) return "warning";
        return "safe";
    }
}

export function formatDayTime(remaining: number): string {
    const overtime = remaining < 0;
    const totalSeconds = Math.ceil(Math.abs(Number.isFinite(remaining) ? remaining : 0));
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${overtime ? "+" : ""}${minutes}:${seconds}`;
}
