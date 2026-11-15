import type { DistrictKind } from "../world/infinite/InfiniteChunkGenerator.ts";

export type RgbaTuple = readonly [number, number, number, number];

export interface InfiniteDistrictPresentation {
    readonly label: string;
    readonly accent: RgbaTuple;
    readonly tint: RgbaTuple;
}

const DISTRICTS: Readonly<Record<DistrictKind, InfiniteDistrictPresentation>> = {
    residential: {
        label: "住宅区",
        accent: [104, 180, 168, 255],
        tint: [30, 44, 40, 32],
    },
    community: {
        label: "社区商业区",
        accent: [77, 218, 143, 255],
        tint: [26, 107, 70, 34],
    },
    industrial: {
        label: "工业区",
        accent: [255, 169, 31, 255],
        tint: [119, 72, 16, 36],
    },
    "open-space": {
        label: "荒废空地",
        accent: [142, 177, 122, 255],
        tint: [60, 84, 54, 30],
    },
};

const HOSPITAL: InfiniteDistrictPresentation = {
    label: "战地医院",
    accent: [238, 86, 92, 255],
    tint: [120, 24, 33, 38],
};

export function districtPresentation(district: DistrictKind, hasHospital: boolean): InfiniteDistrictPresentation {
    return hasHospital ? HOSPITAL : DISTRICTS[district];
}
