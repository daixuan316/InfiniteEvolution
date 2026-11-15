import type { ResearchDefinition, ResearchEffect } from "./ResearchTypes.ts";

export const RESEARCH_DEFINITIONS: readonly ResearchDefinition[] = Object.freeze([
    {
        id: "mech_plating_1",
        branch: "mechanical",
        tier: 1,
        name: "复合装甲",
        description: "为战斗装甲加装轻量复合层，提高护盾容量。",
        cost: 1,
        durationSeconds: 20,
        prerequisites: [],
        effects: [{ stat: "maxShield", add: 30 }],
    },
    {
        id: "mech_servo_2",
        branch: "mechanical",
        tier: 2,
        name: "伺服增压",
        description: "改进外骨骼响应速度，提高移动效率。",
        cost: 2,
        durationSeconds: 45,
        prerequisites: ["mech_plating_1"],
        effects: [{ stat: "moveSpeed", multiplier: 1.08 }],
    },
    {
        id: "mech_capacitor_3",
        branch: "mechanical",
        tier: 3,
        name: "脉冲电容",
        description: "稳定武器瞬时供能，提高输出功率。",
        cost: 3,
        durationSeconds: 90,
        prerequisites: ["mech_servo_2"],
        effects: [{ stat: "attackDamage", multiplier: 1.15 }],
    },
    {
        id: "survival_conditioning_1",
        branch: "survival",
        tier: 1,
        name: "荒野体能",
        description: "系统化训练提升探索者的基础生存能力。",
        cost: 1,
        durationSeconds: 20,
        prerequisites: [],
        effects: [{ stat: "maxHealth", add: 60 }],
    },
    {
        id: "survival_march_2",
        branch: "survival",
        tier: 2,
        name: "轻装行军",
        description: "优化负重分配，在废墟间更快移动。",
        cost: 2,
        durationSeconds: 45,
        prerequisites: ["survival_conditioning_1"],
        effects: [{ stat: "moveSpeed", multiplier: 1.06 }],
    },
    {
        id: "survival_resilience_3",
        branch: "survival",
        tier: 3,
        name: "极限韧性",
        description: "提升恶劣环境下的持续作战能力。",
        cost: 3,
        durationSeconds: 90,
        prerequisites: ["survival_march_2"],
        effects: [{ stat: "maxHealth", add: 100 }],
    },
    {
        id: "bio_tissue_1",
        branch: "biochemical",
        tier: 1,
        name: "再生组织",
        description: "植入受控活性组织，强化身体承伤能力。",
        cost: 1,
        durationSeconds: 20,
        prerequisites: [],
        effects: [{ stat: "maxHealth", add: 80 }],
        bioLoad: 8,
    },
    {
        id: "bio_synapse_2",
        branch: "biochemical",
        tier: 2,
        name: "突触加速",
        description: "强化神经信号传导，提高攻击效率。",
        cost: 2,
        durationSeconds: 45,
        prerequisites: ["bio_tissue_1"],
        effects: [{ stat: "attackDamage", multiplier: 1.10 }],
        bioLoad: 10,
    },
    {
        id: "bio_carapace_3",
        branch: "biochemical",
        tier: 3,
        name: "活体甲壳",
        description: "让活体材料与护盾发生共振，扩大护盾容量。",
        cost: 3,
        durationSeconds: 90,
        prerequisites: ["bio_synapse_2"],
        effects: [{ stat: "maxShield", add: 70 }],
        bioLoad: 14,
    },
    {
        id: "hybrid_interface_1",
        branch: "hybrid",
        tier: 1,
        name: "神经接口",
        description: "连接机械装甲与活性组织，提高行动协调性。",
        cost: 2,
        durationSeconds: 30,
        prerequisites: ["mech_plating_1", "bio_tissue_1"],
        effects: [{ stat: "moveSpeed", multiplier: 1.05 }],
        bioLoad: 4,
    },
    {
        id: "hybrid_overdrive_2",
        branch: "hybrid",
        tier: 2,
        name: "共生过载",
        description: "短路式调动机械和生化系统，提高攻击输出。",
        cost: 3,
        durationSeconds: 60,
        prerequisites: ["hybrid_interface_1"],
        effects: [{ stat: "attackDamage", multiplier: 1.12 }],
        bioLoad: 8,
    },
    {
        id: "hybrid_core_3",
        branch: "hybrid",
        tier: 3,
        name: "进化核心",
        description: "建立稳定共生核心，同时强化生命与护盾。",
        cost: 4,
        durationSeconds: 90,
        prerequisites: ["hybrid_overdrive_2", "survival_march_2"],
        effects: [
            { stat: "maxHealth", add: 80 },
            { stat: "maxShield", add: 50 },
        ],
        bioLoad: 12,
    },
]);

function validateEffect(effect: ResearchEffect, nodeId: string): void {
    if ("add" in effect) {
        if (!Number.isFinite(effect.add) || effect.add <= 0) {
            throw new RangeError(`Research effect for ${nodeId} must have a positive finite add value`);
        }
        return;
    }
    if (!Number.isFinite(effect.multiplier) || effect.multiplier <= 0) {
        throw new RangeError(`Research effect for ${nodeId} must have a positive finite multiplier`);
    }
}

export function validateResearchCatalog(definitions: readonly ResearchDefinition[]): void {
    const byId = new Map<string, ResearchDefinition>();
    for (const definition of definitions) {
        if (!definition.id.trim()) throw new Error("Research id must not be empty");
        if (byId.has(definition.id)) throw new Error(`Duplicate research id: ${definition.id}`);
        if (!Number.isFinite(definition.cost) || definition.cost <= 0) {
            throw new RangeError(`Research cost for ${definition.id} must be positive`);
        }
        if (!Number.isFinite(definition.durationSeconds) || definition.durationSeconds <= 0) {
            throw new RangeError(`Research duration for ${definition.id} must be positive`);
        }
        if (definition.bioLoad !== undefined && (!Number.isFinite(definition.bioLoad) || definition.bioLoad < 0)) {
            throw new RangeError(`Research bio load for ${definition.id} must be non-negative`);
        }
        for (const effect of definition.effects) validateEffect(effect, definition.id);
        byId.set(definition.id, definition);
    }

    for (const definition of definitions) {
        for (const prerequisite of definition.prerequisites) {
            if (!byId.has(prerequisite)) {
                throw new Error(`Unknown prerequisite ${prerequisite} for ${definition.id}`);
            }
        }
    }

    const visiting = new Set<string>();
    const visited = new Set<string>();
    const visit = (id: string): void => {
        if (visiting.has(id)) throw new Error(`Research dependency cycle includes ${id}`);
        if (visited.has(id)) return;
        visiting.add(id);
        for (const prerequisite of byId.get(id)!.prerequisites) visit(prerequisite);
        visiting.delete(id);
        visited.add(id);
    };
    for (const definition of definitions) visit(definition.id);
}

validateResearchCatalog(RESEARCH_DEFINITIONS);

const RESEARCH_BY_ID = new Map(RESEARCH_DEFINITIONS.map((definition) => [definition.id, definition]));

export function researchById(id: string): ResearchDefinition | undefined {
    return RESEARCH_BY_ID.get(id);
}
