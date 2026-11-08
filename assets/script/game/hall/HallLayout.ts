export interface FittedSize {
    width: number;
    height: number;
}

/** Converts a bounded value into the number of illuminated industrial segments. */
export function filledSegments(value: number, maximum: number, segmentCount: number): number {
    if (maximum <= 0 || segmentCount <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, value / maximum));
    return Math.max(0, Math.min(segmentCount, Math.round(ratio * segmentCount)));
}

/** Fits source dimensions inside a box without distorting the source aspect ratio. */
export function fitSizeWithin(sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number): FittedSize {
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    return {
        width: Math.round(sourceWidth * scale),
        height: Math.round(sourceHeight * scale),
    };
}
