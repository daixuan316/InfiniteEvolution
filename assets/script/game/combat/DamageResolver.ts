export interface DamageRequest {
    sourceId: string;
    targetId: string;
    baseDamage: number;
    defense: number;
    skillMultiplier?: number;
    additiveBonuses?: readonly number[];
    criticalMultiplier?: number;
    weakpointMultiplier?: number;
    tags?: readonly string[];
}

export interface DamageResolution {
    accepted: boolean;
    reason?: "invalid-request";
    sourceId: string;
    targetId: string;
    rawDamage: number;
    reduction: number;
    amount: number;
    tags: readonly string[];
}

function rejected(request: DamageRequest): DamageResolution {
    return {
        accepted: false,
        reason: "invalid-request",
        sourceId: request.sourceId,
        targetId: request.targetId,
        rawDamage: 0,
        reduction: 0,
        amount: 0,
        tags: Object.freeze([...(request.tags ?? [])]),
    };
}

export function resolveDamage(request: DamageRequest): DamageResolution {
    const skillMultiplier = request.skillMultiplier ?? 1;
    const criticalMultiplier = request.criticalMultiplier ?? 1;
    const weakpointMultiplier = request.weakpointMultiplier ?? 1;
    const additiveBonuses = request.additiveBonuses ?? [];
    const additiveMultiplier = 1 + additiveBonuses.reduce((sum, value) => sum + value, 0);
    const valid = request.sourceId.length > 0
        && request.targetId.length > 0
        && Number.isFinite(request.baseDamage) && request.baseDamage > 0
        && Number.isFinite(request.defense) && request.defense >= 0
        && Number.isFinite(skillMultiplier) && skillMultiplier > 0
        && Number.isFinite(criticalMultiplier) && criticalMultiplier > 0
        && Number.isFinite(weakpointMultiplier) && weakpointMultiplier > 0
        && additiveBonuses.every((value) => Number.isFinite(value))
        && Number.isFinite(additiveMultiplier) && additiveMultiplier > 0;

    if (!valid) return rejected(request);

    const rawDamage = request.baseDamage
        * skillMultiplier
        * additiveMultiplier
        * criticalMultiplier
        * weakpointMultiplier;
    const reduction = request.defense / (request.defense + 100);

    return {
        accepted: true,
        sourceId: request.sourceId,
        targetId: request.targetId,
        rawDamage,
        reduction,
        amount: Math.max(1, Math.round(rawDamage * (1 - reduction))),
        tags: Object.freeze([...(request.tags ?? [])]),
    };
}
