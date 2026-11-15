export interface FittedSize {
    width: number;
    height: number;
}

export interface HorizontalSlot {
    centerX: number;
    width: number;
}

export interface HallTopBarLeftLayout {
    chapterBadge: HorizontalSlot;
    chapter: HorizontalSlot;
    dayIcon: HorizontalSlot;
    day: HorizontalSlot;
}

/** Converts a bounded value into the number of illuminated industrial segments. */
export function filledSegments(value: number, maximum: number, segmentCount: number): number {
    if (maximum <= 0 || segmentCount <= 0) return 0;
    const ratio = Math.max(0, Math.min(1, value / maximum));
    return Math.max(0, Math.min(segmentCount, Math.round(ratio * segmentCount)));
}

/** Places the chapter and day groups sequentially so their hit boxes never overlap. */
export function hallTopBarLeftLayout(topWidth: number): HallTopBarLeftLayout {
    const gap = 10;
    let cursor = -topWidth / 2 + 12;
    const take = (width: number): HorizontalSlot => {
        const slot = { centerX: cursor + width / 2, width };
        cursor += width + gap;
        return slot;
    };
    return {
        chapterBadge: take(52),
        chapter: take(190),
        dayIcon: take(42),
        day: take(180),
    };
}

/** Alternates the bright caution blocks used by the yellow-black warning strip. */
export function isHazardStripeBright(index: number): boolean {
    return index % 2 === 0;
}

/** Fits source dimensions inside a box without distorting the source aspect ratio. */
export function fitSizeWithin(sourceWidth: number, sourceHeight: number, maxWidth: number, maxHeight: number): FittedSize {
    const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
    return {
        width: Math.round(sourceWidth * scale),
        height: Math.round(sourceHeight * scale),
    };
}
