import type { BattleMapDefinition, WorldPoint } from "../../battle/BattleMapModel.ts";
import {
    intelTargetWorldPoint,
    isIntelTargetReached,
    type IntelTargetDefinition,
} from "./IntelCatalog.ts";

export interface IntelTargetProgress {
    readonly distanceMeters: number;
    readonly reached: boolean;
    readonly becameReached: boolean;
}

export class IntelTargetTracker {
    private reached = false;
    readonly target: IntelTargetDefinition;
    private readonly map: BattleMapDefinition;
    private readonly radius: number;

    constructor(
        target: IntelTargetDefinition,
        map: BattleMapDefinition,
        radius = 180,
    ) {
        this.target = target;
        this.map = map;
        this.radius = radius;
    }

    update(player: WorldPoint): IntelTargetProgress {
        const destination = intelTargetWorldPoint(this.target, this.map);
        const distanceMeters = Math.ceil(Math.hypot(destination.x - player.x, destination.y - player.y) / 4);
        const reachedNow = isIntelTargetReached(this.target, player, this.map, this.radius);
        const becameReached = reachedNow && !this.reached;
        if (reachedNow) this.reached = true;
        return { distanceMeters, reached: this.reached, becameReached };
    }
}
