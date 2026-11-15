import type { IntelTargetDefinition, IntelTargetId } from "./IntelCatalog.ts";

export type IntelDepartureDecision =
    | { readonly destination: "intel" }
    | { readonly destination: "battle"; readonly targetId: IntelTargetId };

export function decideIntelDeparture(target: IntelTargetDefinition | null): IntelDepartureDecision {
    if (!target) return { destination: "intel" };
    return { destination: "battle", targetId: target.id };
}
