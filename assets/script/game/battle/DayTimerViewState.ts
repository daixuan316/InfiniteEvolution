export interface DayTimerLabel<TColor> {
    string: string;
    color: TColor;
}

export interface DayTimerView<TColor, TProgressBar> {
    readonly timeLabel: DayTimerLabel<TColor> | null;
    readonly pressureLabel: DayTimerLabel<TColor> | null;
    readonly progressBar: TProgressBar | null;
}

export interface DayTimerPresentation<TColor> {
    readonly timeText: string;
    readonly pressureText: string;
    readonly remainingRatio: number;
    readonly color: TColor;
}

/** Runtime-built HUD elements can be absent during editor-preview lifecycle transitions. */
export function syncDayTimerView<TColor, TProgressBar>(
    view: DayTimerView<TColor, TProgressBar>,
    presentation: DayTimerPresentation<TColor>,
    setProgress: (progressBar: TProgressBar, ratio: number) => void,
): boolean {
    const { timeLabel, pressureLabel, progressBar } = view;
    if (!timeLabel || !pressureLabel || !progressBar) return false;

    timeLabel.string = presentation.timeText;
    pressureLabel.string = presentation.pressureText;
    timeLabel.color = presentation.color;
    pressureLabel.color = presentation.color;
    setProgress(progressBar, presentation.remainingRatio);
    return true;
}
