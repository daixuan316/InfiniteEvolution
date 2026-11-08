export interface SurfaceFrameRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export type SurfaceFramePieceName =
    | "top-left"
    | "top-badge"
    | "top-right"
    | "left-module"
    | "right-module"
    | "bottom-left"
    | "bottom-caution"
    | "bottom-right";

export interface SurfaceFramePiece {
    name: SurfaceFramePieceName;
    source: SurfaceFrameRect;
    x: number;
    y: number;
    width: number;
    height: number;
}

type SurfaceFrameEdge =
    | "top-left"
    | "top"
    | "top-right"
    | "left"
    | "right"
    | "bottom-left"
    | "bottom"
    | "bottom-right";

interface AuthoredSurfaceFramePiece {
    name: SurfaceFramePieceName;
    source: SurfaceFrameRect;
    edge: SurfaceFrameEdge;
}

const SOURCE_FRAME_WIDTH = 246;
const COMPOSITE_REFERENCE_HEIGHT = 96;
const MIN_COMPOSITE_WIDTH = 160;
const MIN_COMPOSITE_HEIGHT = 64;

const AUTHORED_PIECES: readonly AuthoredSurfaceFramePiece[] = [
    { name: "top-left", source: { x: 10, y: 81, width: 57, height: 43 }, edge: "top-left" },
    { name: "top-badge", source: { x: 90, y: 81, width: 89, height: 43 }, edge: "top" },
    { name: "top-right", source: { x: 199, y: 81, width: 57, height: 43 }, edge: "top-right" },
    { name: "left-module", source: { x: 10, y: 110, width: 51, height: 71 }, edge: "left" },
    { name: "right-module", source: { x: 215, y: 110, width: 41, height: 71 }, edge: "right" },
    { name: "bottom-left", source: { x: 10, y: 208, width: 60, height: 48 }, edge: "bottom-left" },
    { name: "bottom-caution", source: { x: 81, y: 211, width: 105, height: 45 }, edge: "bottom" },
    { name: "bottom-right", source: { x: 196, y: 208, width: 60, height: 48 }, edge: "bottom-right" },
];

/** Returns whether the target can show the authored decorations without collapsing them. */
export function shouldComposeLargeSurface(width: number, height: number): boolean {
    return Number.isFinite(width)
        && Number.isFinite(height)
        && width >= MIN_COMPOSITE_WIDTH
        && height >= MIN_COMPOSITE_HEIGHT;
}

/** Places authored frame decorations against target edges without non-uniform stretching. */
export function surfaceFramePieces(width: number, height: number): readonly SurfaceFramePiece[] {
    if (!shouldComposeLargeSurface(width, height)) return [];

    const scale = Math.min(1, width / SOURCE_FRAME_WIDTH, height / COMPOSITE_REFERENCE_HEIGHT);
    return AUTHORED_PIECES.map((piece) => {
        const pieceWidth = Math.round(piece.source.width * scale);
        const pieceHeight = Math.round(piece.source.height * scale);
        let x = 0;
        let y = 0;

        if (piece.edge.includes("left")) x = Math.round(-width / 2 + pieceWidth / 2);
        if (piece.edge.includes("right")) x = Math.round(width / 2 - pieceWidth / 2);
        if (piece.edge.includes("top")) y = Math.round(height / 2 - pieceHeight / 2);
        if (piece.edge.includes("bottom")) y = Math.round(-height / 2 + pieceHeight / 2);

        return {
            name: piece.name,
            source: piece.source,
            x,
            y,
            width: pieceWidth,
            height: pieceHeight,
        };
    });
}
