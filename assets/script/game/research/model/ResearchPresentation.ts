export function formatCountdown(milliseconds: number): string {
    const finiteMilliseconds = Number.isFinite(milliseconds) ? milliseconds : 0;
    const totalSeconds = Math.max(0, Math.ceil(finiteMilliseconds / 1000));
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
    const seconds = (totalSeconds % 60).toString().padStart(2, "0");
    return `${minutes}:${seconds}`;
}
