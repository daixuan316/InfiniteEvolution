import type {
    ArkEvolutionDefinition,
    ArkLayoutState,
    ArkModuleDefinition,
    ArkModuleInstance,
    ArkSlotDefinition,
    ArkState,
} from "./ArkTypes.ts";

export const ARK_SLOTS: readonly ArkSlotDefinition[] = Object.freeze([
    { id: "front-left", kind: "front", label: "左前防线", neighbors: ["front-right", "top-left"] },
    { id: "front-right", kind: "front", label: "右前防线", neighbors: ["front-left", "top-right"] },
    { id: "top-left", kind: "top", label: "左武器台", neighbors: ["front-left", "top-right", "internal"] },
    { id: "top-right", kind: "top", label: "右武器台", neighbors: ["front-right", "top-left", "internal"] },
    { id: "side", kind: "side", label: "侧舷槽", neighbors: ["front-right", "internal", "bio"] },
    { id: "internal", kind: "internal", label: "内部设施", neighbors: ["top-left", "top-right", "side", "bio"] },
    { id: "bio", kind: "bio", label: "生化接口", neighbors: ["side", "internal"] },
]);

export const ARK_EVOLUTIONS: readonly ArkEvolutionDefinition[] = Object.freeze([
    { id: "hunter-gland", name: "追猎腺体", abilityId: "target_low_health", compatibleDefinitionIds: ["machine-gun-turret", "shotgun-turret"], powerDelta: 2, noiseDelta: 5, visualMarker: "猎杀脉动", sideEffect: "耗电 +2，噪音 +5" },
    { id: "regenerative-armor", name: "再生甲壳", abilityId: "respite_regeneration", compatibleDefinitionIds: ["armor-plate", "barricade"], powerDelta: 1, noiseDelta: 2, visualMarker: "再生组织", sideEffect: "火焰易损 +20%" },
    { id: "sensory-organ", name: "感知器官", abilityId: "reveal_specials", compatibleDefinitionIds: ["radar"], powerDelta: 2, noiseDelta: 8, visualMarker: "感知触须", sideEffect: "基础污染 +8" },
]);

const cost = (scrap: number, parts = 0, alloy = 0) => [
    ...(scrap > 0 ? [{ resource: "scrap" as const, amount: scrap }] : []),
    ...(parts > 0 ? [{ resource: "parts" as const, amount: parts }] : []),
    ...(alloy > 0 ? [{ resource: "alloy" as const, amount: alloy }] : []),
];

export const ARK_MODULES: readonly ArkModuleDefinition[] = Object.freeze([
    { id: "armor-plate", name: "复合装甲板", category: "structure", acceptedSlots: ["front", "side"], cost: cost(35, 0, 10), maxDurability: 420, powerDemand: 0, powerCapacity: 0, noise: 0, tags: ["armor"], battle: { defense: 42, radius: 56 }, evolutionIds: ["regenerative-armor"] },
    { id: "barricade", name: "伸缩路障", category: "structure", acceptedSlots: ["front"], cost: cost(25, 4), maxDurability: 300, powerDemand: 0, powerCapacity: 0, noise: 1, tags: ["barrier"], battle: { defense: 24, radius: 48 }, evolutionIds: ["regenerative-armor"] },
    { id: "generator", name: "柴油发电机", category: "energy", acceptedSlots: ["internal"], cost: cost(45, 8), maxDurability: 260, powerDemand: 0, powerCapacity: 18, noise: 22, tags: ["generator"], battle: { defense: 12, radius: 42 }, evolutionIds: [] },
    { id: "battery", name: "脉冲储能器", category: "energy", acceptedSlots: ["internal", "side"], cost: cost(30, 10), maxDurability: 220, powerDemand: 0, powerCapacity: 8, noise: 2, tags: ["battery"], battle: { defense: 10, radius: 40 }, evolutionIds: [] },
    { id: "machine-gun-turret", name: "机枪塔", category: "defense", acceptedSlots: ["top"], cost: cost(50, 12, 4), maxDurability: 240, powerDemand: 6, powerCapacity: 0, noise: 16, tags: ["weapon", "rapid"], battle: { attackDamage: 24, attackInterval: 0.32, attackRange: 460, defense: 14, radius: 38 }, evolutionIds: ["hunter-gland"] },
    { id: "shotgun-turret", name: "霰弹塔", category: "defense", acceptedSlots: ["top"], cost: cost(55, 14, 5), maxDurability: 260, powerDemand: 7, powerCapacity: 0, noise: 20, tags: ["weapon", "close"], battle: { attackDamage: 55, attackInterval: 1.05, attackRange: 270, defense: 16, radius: 40 }, evolutionIds: ["hunter-gland"] },
    { id: "electric-grid", name: "高压电网", category: "defense", acceptedSlots: ["front", "side"], cost: cost(42, 16), maxDurability: 210, powerDemand: 5, powerCapacity: 0, noise: 10, tags: ["control"], battle: { attackDamage: 12, attackInterval: 0.8, attackRange: 190, defense: 8, radius: 55, controlSeconds: 0.4 }, evolutionIds: [] },
    { id: "repair-drone", name: "维修无人机", category: "structure", acceptedSlots: ["internal", "side"], cost: cost(38, 18), maxDurability: 180, powerDemand: 4, powerCapacity: 0, noise: 7, tags: ["repair"], battle: { defense: 6, radius: 34, repairRate: 8 }, evolutionIds: [] },
    { id: "radar", name: "威胁雷达", category: "energy", acceptedSlots: ["top", "side"], cost: cost(32, 14), maxDurability: 190, powerDemand: 3, powerCapacity: 0, noise: 6, tags: ["radar"], battle: { defense: 8, radius: 36 }, evolutionIds: ["sensory-organ"] },
    { id: "regenerative-tissue", name: "活体再生组织", category: "bio", acceptedSlots: ["bio"], cost: cost(20, 8), maxDurability: 160, powerDemand: 3, powerCapacity: 0, noise: 9, tags: ["bio", "repair"], battle: { defense: 4, radius: 45, repairRate: 5 }, evolutionIds: [] },
]);

export const arkModuleById = (id: string): ArkModuleDefinition | undefined => ARK_MODULES.find((item) => item.id === id);
export const arkSlotById = (id: string): ArkSlotDefinition | undefined => ARK_SLOTS.find((item) => item.id === id);
export const arkEvolutionById = (id: string): ArkEvolutionDefinition | undefined => ARK_EVOLUTIONS.find((item) => item.id === id);

function emptyLayout(): ArkLayoutState {
    return { slots: Object.fromEntries(ARK_SLOTS.map((slot) => [slot.id, null])) };
}

function instance(instanceId: string, definitionId: string, priority: ArkModuleInstance["priority"], commissioned = false): ArkModuleInstance {
    const definition = arkModuleById(definitionId)!;
    return { instanceId, definitionId, durability: definition.maxDurability, priority, evolutionId: null, commissioned };
}

export function createDefaultArkState(): ArkState {
    const alpha = emptyLayout();
    alpha.slots["front-left"] = "armor-1";
    alpha.slots["top-left"] = "turret-mg-1";
    alpha.slots.internal = "generator-1";
    return {
        schemaVersion: 1,
        resources: { scrap: 368, parts: 80, alloy: 72, energyCell: 12, mutationCore: 2 },
        modules: [
            instance("armor-1", "armor-plate", "important", true),
            instance("barricade-1", "barricade", "normal"),
            instance("generator-1", "generator", "core", true),
            instance("battery-1", "battery", "important"),
            instance("turret-mg-1", "machine-gun-turret", "important", true),
            instance("turret-shotgun-1", "shotgun-turret", "normal"),
            instance("grid-1", "electric-grid", "normal"),
            instance("repair-drone-1", "repair-drone", "important"),
            instance("radar-1", "radar", "normal"),
            instance("bio-tissue-1", "regenerative-tissue", "normal"),
        ],
        layouts: { alpha, beta: emptyLayout(), gamma: emptyLayout() },
        activeLayoutId: "alpha",
        repairQueue: [],
        repairSpentToday: 0,
        coreDurability: 920,
        coreMaxDurability: 1000,
        appliedBattleIds: [],
    };
}
