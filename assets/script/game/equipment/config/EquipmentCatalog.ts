import type {
    AffixDefinition,
    EquipmentCatalog,
    EquipmentTemplate,
    EvolutionDefinition,
    RecipeDefinition,
    ResonanceDefinition,
    WeaponClass,
    WeaponStats,
} from "../model/EquipmentTypes.ts";

const WEAPON_ICON = "system-nav/06-storage";

function weapon(
    id: string,
    name: string,
    weaponClass: WeaponClass,
    stats: WeaponStats,
    fixedTrait: string,
    tags: EquipmentTemplate["tags"],
): EquipmentTemplate {
    return {
        id,
        name,
        slot: "weapon",
        weaponClass,
        icon: WEAPON_ICON,
        tags,
        baseStats: {},
        weapon: stats,
        fixedTrait,
        allowedAffixCategories: ["output", "handling", "element", "ark"],
        evolutionIds: [`${weaponClass}_path_a`, `${weaponClass}_path_b`],
    };
}

const WEAPONS: EquipmentTemplate[] = [
    weapon("weapon_assault", "灰港制式步枪", "assault", { damage: 35, interval: 0.35, range: 320, magazine: 24, reload: 1.7, heatPerShot: 0, heatCapacity: 100, coolingPerSecond: 25, projectileSpeed: 1400 }, "稳定连射", ["sentinel"]),
    weapon("weapon_smg", "流火冲锋枪", "smg", { damage: 19, interval: 0.13, range: 230, magazine: 34, reload: 1.35, heatPerShot: 0, heatCapacity: 100, coolingPerSecond: 30, projectileSpeed: 1350 }, "移动射击伤害提高", ["machine"]),
    weapon("weapon_shotgun", "破门霰弹枪", "shotgun", { damage: 14, interval: 0.82, range: 180, magazine: 8, reload: 2.2, heatPerShot: 0, heatCapacity: 100, coolingPerSecond: 20, projectileSpeed: 1100, pellets: 6, status: "corrode", statusChance: 0.18 }, "近距击退并破甲", ["heavy"]),
    weapon("weapon_sniper", "猎眼狙击枪", "sniper", { damage: 115, interval: 1.25, range: 560, magazine: 6, reload: 2.4, heatPerShot: 0, heatCapacity: 100, coolingPerSecond: 20, projectileSpeed: 2100, penetration: 2 }, "弱点倍率提高", ["wasteland"]),
    weapon("weapon_lmg", "壁垒轻机枪", "lmg", { damage: 29, interval: 0.2, range: 350, magazine: 72, reload: 3.4, heatPerShot: 1.5, heatCapacity: 100, coolingPerSecond: 18, projectileSpeed: 1450 }, "持续射击叠加压制", ["heavy"]),
    weapon("weapon_grenade", "裂城榴弹发射器", "grenade", { damage: 86, interval: 1.1, range: 430, magazine: 5, reload: 2.8, heatPerShot: 0, heatCapacity: 100, coolingPerSecond: 20, projectileSpeed: 620, splashRadius: 115, minimumRange: 80 }, "爆炸范围伤害", ["sentinel"]),
    weapon("weapon_flame", "焚疫喷射器", "flame", { damage: 12, interval: 0.1, range: 155, magazine: 100, reload: 0.1, heatPerShot: 7, heatCapacity: 100, coolingPerSecond: 24, projectileSpeed: 900, status: "burn", statusChance: 1 }, "燃烧阻止再生", ["mutation"]),
    weapon("weapon_arc", "雷潮电弧器", "arc", { damage: 28, interval: 0.48, range: 290, magazine: 18, reload: 1.8, heatPerShot: 4, heatCapacity: 100, coolingPerSecond: 26, projectileSpeed: 1700, chainTargets: 2, status: "shock", statusChance: 0.65 }, "电弧自动连锁", ["thunder"]),
    weapon("weapon_bio", "噬群生化枪", "bio", { damage: 31, interval: 0.42, range: 270, magazine: 20, reload: 2, heatPerShot: 0, heatCapacity: 100, coolingPerSecond: 20, projectileSpeed: 1050, splashRadius: 45, status: "infection", statusChance: 0.75, pollutionCost: 1.5 }, "感染扩散并提高污染", ["mutation"]),
];

const ARMOR: EquipmentTemplate[] = [
    { id: "helmet_scout", name: "荒原侦察盔", slot: "helmet", icon: WEAPON_ICON, tags: ["wasteland"], baseStats: { maxShield: 25, weakpointMultiplier: 0.15 }, fixedTrait: "标记弱点", allowedAffixCategories: ["survival", "handling", "ark"], evolutionIds: [] },
    { id: "armor_bulwark", name: "壁垒复合甲", slot: "armor", icon: WEAPON_ICON, tags: ["heavy"], baseStats: { maxHealth: 120, defense: 18 }, fixedTrait: "受击积蓄反击能量", allowedAffixCategories: ["survival", "ark"], evolutionIds: [] },
    { id: "gloves_loader", name: "磁轨装填手套", slot: "gloves", icon: WEAPON_ICON, tags: ["machine"], baseStats: { reload: -0.12, interval: -0.05 }, fixedTrait: "换枪后快速装填", allowedAffixCategories: ["handling", "output"], evolutionIds: [] },
    { id: "boots_runner", name: "猎荒动力战靴", slot: "boots", icon: WEAPON_ICON, tags: ["wasteland"], baseStats: { moveSpeed: 35, dodgeCooldown: -0.12 }, fixedTrait: "无视轻度减速", allowedAffixCategories: ["survival", "handling"], evolutionIds: [] },
    { id: "tactical_drone", name: "守望标记无人机", slot: "tactical", icon: WEAPON_ICON, tags: ["sentinel"], baseStats: { range: 0.08 }, fixedTrait: "周期标记高威胁目标", allowedAffixCategories: ["ark", "output"], evolutionIds: [] },
    { id: "organ_arc", name: "异化雷腺", slot: "organ", icon: WEAPON_ICON, tags: ["thunder", "mutation"], baseStats: { chainTargets: 1, maxHealth: -30 }, fixedTrait: "感电可扩散感染", allowedAffixCategories: ["element", "survival"], evolutionIds: [] },
];

const AFFIXES: AffixDefinition[] = [
    { id: "affix_damage_08", name: "火力增幅", category: "output", stat: "damage", value: 0.08, allowedSlots: ["weapon", "gloves", "tactical"] },
    { id: "affix_crit_06", name: "精密校准", category: "output", stat: "critChance", value: 0.06, allowedSlots: ["weapon", "helmet", "gloves"] },
    { id: "affix_interval_07", name: "高速机匣", category: "handling", stat: "interval", value: -0.07, allowedSlots: ["weapon", "gloves"] },
    { id: "affix_reload_12", name: "快速装填", category: "handling", stat: "reload", value: -0.12, allowedSlots: ["weapon", "gloves"] },
    { id: "affix_range_10", name: "远距测算", category: "handling", stat: "range", value: 0.1, allowedSlots: ["weapon", "helmet", "tactical"] },
    { id: "affix_health_60", name: "生命强化", category: "survival", stat: "maxHealth", value: 60, allowedSlots: ["helmet", "armor", "boots", "organ"] },
    { id: "affix_shield_45", name: "护盾电容", category: "survival", stat: "maxShield", value: 45, allowedSlots: ["helmet", "armor", "tactical", "organ"] },
    { id: "affix_defense_08", name: "复合装甲", category: "survival", stat: "defense", value: 8, allowedSlots: ["helmet", "armor", "boots"] },
    { id: "affix_move_20", name: "动力辅助", category: "handling", stat: "moveSpeed", value: 20, allowedSlots: ["boots", "organ"] },
    { id: "affix_chain_01", name: "雷链增幅", category: "element", stat: "chainTargets", value: 1, allowedSlots: ["weapon", "organ"], allowedWeaponClasses: ["arc"] },
    { id: "affix_cooling_20", name: "液冷回路", category: "element", stat: "coolingPerSecond", value: 0.2, allowedSlots: ["weapon", "tactical"], allowedWeaponClasses: ["flame", "arc", "lmg"] },
    { id: "affix_ark_damage_06", name: "守望协议", category: "ark", stat: "damage", value: 0.06, allowedSlots: ["weapon", "helmet", "armor", "tactical"] },
];

const RESONANCES: ResonanceDefinition[] = [
    { tag: "thunder", name: "雷暴", tiers: [{ count: 2, modifiers: { chainTargets: 1 }, mechanic: "感电多连锁一个目标" }, { count: 3, modifiers: { damage: 0.12 }, mechanic: "连锁伤害不再衰减" }] },
    { tag: "sentinel", name: "守望", tiers: [{ count: 2, modifiers: { range: 0.1 }, mechanic: "方舟附近射程提高" }, { count: 3, modifiers: { damage: 0.14 }, mechanic: "命中为炮塔标记目标" }] },
    { tag: "machine", name: "机械", tiers: [{ count: 2, modifiers: { reload: -0.12 }, mechanic: "换枪触发后台装填" }, { count: 3, modifiers: { interval: -0.1 }, mechanic: "技能驱动无人机齐射" }] },
    { tag: "mutation", name: "异化", tiers: [{ count: 2, modifiers: { damage: 0.1 }, mechanic: "污染提高伤害", drawback: "治疗效果降低 10%" }, { count: 3, modifiers: { maxHealth: 80 }, mechanic: "高污染触发异化爆发", drawback: "污染自然衰减变慢" }] },
    { tag: "wasteland", name: "猎荒", tiers: [{ count: 2, modifiers: { moveSpeed: 20 }, mechanic: "搜刮与撤离速度提高" }, { count: 3, modifiers: { weakpointMultiplier: 0.2 }, mechanic: "精英弱点暴露延长" }] },
    { tag: "heavy", name: "重装", tiers: [{ count: 2, modifiers: { defense: 10 }, mechanic: "受击积累反击能量", drawback: "翻滚冷却增加 8%" }, { count: 3, modifiers: { maxShield: 90 }, mechanic: "满能量释放冲击波", drawback: "移动速度降低 5%" }] },
];

const EVOLUTIONS: EvolutionDefinition[] = WEAPONS.flatMap((item) => {
    const weaponClass = item.weaponClass!;
    return [
        { id: `${weaponClass}_path_a`, templateId: item.id, name: `${item.name}·突进型`, memory: "closeHit", threshold: 20, modifiers: { damage: 0.18 }, mechanic: "近距命中获得短时火力" },
        { id: `${weaponClass}_path_b`, templateId: item.id, name: `${item.name}·猎手型`, memory: "weakpointHit", threshold: 25, modifiers: { weakpointMultiplier: 0.25 }, mechanic: "弱点命中返还射击间隔" },
    ];
});

const RECIPES: RecipeDefinition[] = WEAPONS.map((item, index) => ({
    id: `recipe_${item.weaponClass}`,
    templateId: item.id,
    costs: { scrap: 80 + index * 10, parts: 20 + index * 3 },
    minimumWorkshopLevel: 1 + Math.floor(index / 3),
}));

export const EQUIPMENT_CATALOG: EquipmentCatalog = {
    templates: [...WEAPONS, ...ARMOR],
    affixes: AFFIXES,
    resonances: RESONANCES,
    evolutions: EVOLUTIONS,
    recipes: RECIPES,
};

export function validateEquipmentCatalog(catalog: EquipmentCatalog): string[] {
    const errors: string[] = [];
    const templateIds = new Set<string>();
    const affixIds = new Set<string>();
    const evolutionIds = new Set(catalog.evolutions.map((item) => item.id));
    for (const template of catalog.templates) {
        if (templateIds.has(template.id)) errors.push(`duplicate template id: ${template.id}`);
        templateIds.add(template.id);
        if (template.slot === "weapon") {
            if (!template.weaponClass || !template.weapon) errors.push(`invalid weapon definition: ${template.id}`);
            if (!Number.isFinite(template.weapon?.damage) || (template.weapon?.damage ?? 0) <= 0) errors.push(`invalid weapon damage: ${template.id}`);
            for (const key of ["interval", "range", "magazine", "reload", "heatCapacity", "coolingPerSecond", "projectileSpeed"] as const) {
                if (!Number.isFinite(template.weapon?.[key]) || (template.weapon?.[key] ?? 0) <= 0) errors.push(`invalid weapon ${key}: ${template.id}`);
            }
        }
        for (const evolutionId of template.evolutionIds) if (!evolutionIds.has(evolutionId)) errors.push(`missing evolution ${evolutionId}: ${template.id}`);
    }
    for (const affix of catalog.affixes) {
        if (affixIds.has(affix.id)) errors.push(`duplicate affix id: ${affix.id}`);
        affixIds.add(affix.id);
        if (!Number.isFinite(affix.value)) errors.push(`invalid affix value: ${affix.id}`);
    }
    for (const evolution of catalog.evolutions) {
        if (!templateIds.has(evolution.templateId)) errors.push(`missing evolution template: ${evolution.id}`);
        if (!Number.isFinite(evolution.threshold) || evolution.threshold <= 0) errors.push(`invalid evolution threshold: ${evolution.id}`);
    }
    for (const recipe of catalog.recipes) {
        if (!templateIds.has(recipe.templateId)) errors.push(`missing recipe template: ${recipe.id}`);
        if (Object.values(recipe.costs).some((value) => !Number.isFinite(value) || value! < 0)) errors.push(`invalid recipe cost: ${recipe.id}`);
    }
    return errors;
}

export function getTemplate(catalog: EquipmentCatalog, id: string): EquipmentTemplate | undefined {
    return catalog.templates.find((item) => item.id === id);
}
