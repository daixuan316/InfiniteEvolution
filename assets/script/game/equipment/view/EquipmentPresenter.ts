import { getTemplate } from "../config/EquipmentCatalog.ts";
import { availableEvolutionIds } from "../model/CombatMemory.ts";
import { resolveRoleCombatSnapshot } from "../model/EquipmentResolver.ts";
import type { EquipmentRuntime } from "../EquipmentRuntime.ts";
import type { EquipmentCatalog, EquipmentCommandResult, EquipmentSlot, EquipmentState, TemplateSlot } from "../model/EquipmentTypes.ts";

export type EquipmentCategory = "weapon" | "armor" | "tactical" | "organ";

function categoryForSlot(slot: TemplateSlot): EquipmentCategory {
    return slot === "helmet" || slot === "gloves" || slot === "boots" ? "armor" : slot;
}

function categoryContains(category: EquipmentCategory, slot: TemplateSlot): boolean {
    return category === "armor" ? ["helmet", "armor", "gloves", "boots"].includes(slot) : category === slot;
}

function physicalSlot(slot: TemplateSlot): EquipmentSlot {
    return slot === "weapon" ? "primary1" : slot;
}

export class EquipmentPresenter {
    private readonly runtime: EquipmentRuntime;
    private readonly catalog: EquipmentCatalog;
    private selectedId: string | null = null;
    private category: EquipmentCategory = "weapon";

    constructor(runtime: EquipmentRuntime, catalog: EquipmentCatalog) {
        this.runtime = runtime;
        this.catalog = catalog;
    }

    select(instanceId: string): this {
        this.selectedId = instanceId;
        const state = this.runtime.snapshot();
        const instance = state.instances.find((item) => item.instanceId === instanceId);
        const template = instance ? getTemplate(this.catalog, instance.templateId) : undefined;
        if (template) this.category = categoryForSlot(template.slot);
        return this;
    }

    setCategory(category: EquipmentCategory): this {
        this.category = category;
        this.selectedId = null;
        return this;
    }

    view() {
        const state = this.runtime.snapshot();
        const loadout = state.loadouts.find((item) => item.id === state.activeLoadoutId)!;
        const inventory = state.instances.filter((instance) => {
            const template = getTemplate(this.catalog, instance.templateId);
            return template ? categoryContains(this.category, template.slot) : false;
        });
        const selected = state.instances.find((item) => item.instanceId === this.selectedId) ?? inventory[0] ?? null;
        if (selected) this.selectedId = selected.instanceId;
        const selectedTemplate = selected ? getTemplate(this.catalog, selected.templateId) : undefined;
        const slot = selectedTemplate ? physicalSlot(selectedTemplate.slot) : null;
        const currentId = slot ? loadout.slots[slot] : null;
        const current = currentId ? state.instances.find((item) => item.instanceId === currentId) ?? null : null;
        const currentSnapshot = resolveRoleCombatSnapshot(state, this.catalog);
        let candidateSnapshot = currentSnapshot;
        if (selected && slot) {
            const candidateState = structuredClone(state);
            candidateState.loadouts.find((item) => item.id === state.activeLoadoutId)!.slots[slot] = selected.instanceId;
            candidateSnapshot = resolveRoleCombatSnapshot(candidateState, this.catalog);
        }
        const currentDamage = currentSnapshot.weapons[0].damage;
        const candidateDamage = candidateSnapshot.weapons[0].damage;
        const referenced = new Set(state.loadouts.flatMap((item) => Object.values(item.slots).filter((id): id is string => id !== null)));
        return {
            category: this.category,
            capacity: { used: state.instances.length, max: state.capacity },
            materials: structuredClone(state.materials),
            loadouts: state.loadouts.map((item) => ({ id: item.id, name: item.name, active: item.id === state.activeLoadoutId })),
            slots: Object.entries(loadout.slots).map(([id, instanceId]) => {
                const instance = state.instances.find((item) => item.instanceId === instanceId);
                const template = instance ? getTemplate(this.catalog, instance.templateId) : undefined;
                return { id, instanceId, name: template?.name ?? "空槽位", quality: instance?.quality ?? null };
            }),
            inventory: inventory.map((item) => {
                const template = getTemplate(this.catalog, item.templateId)!;
                return { ...structuredClone(item), name: template.name, slot: template.slot, equipped: referenced.has(item.instanceId) };
            }),
            selected: selected ? { ...structuredClone(selected), name: selectedTemplate?.name ?? selected.templateId, template: selectedTemplate } : null,
            current: current ? { ...structuredClone(current), name: getTemplate(this.catalog, current.templateId)?.name ?? current.templateId } : null,
            comparison: {
                damage: { current: currentDamage, candidate: candidateDamage, delta: Number((candidateDamage - currentDamage).toFixed(2)) },
                health: { current: currentSnapshot.maxHealth, candidate: candidateSnapshot.maxHealth, delta: candidateSnapshot.maxHealth - currentSnapshot.maxHealth },
                shield: { current: currentSnapshot.maxShield, candidate: candidateSnapshot.maxShield, delta: candidateSnapshot.maxShield - currentSnapshot.maxShield },
                defense: { current: currentSnapshot.defense, candidate: candidateSnapshot.defense, delta: candidateSnapshot.defense - currentSnapshot.defense },
                speed: { current: currentSnapshot.moveSpeed, candidate: candidateSnapshot.moveSpeed, delta: candidateSnapshot.moveSpeed - currentSnapshot.moveSpeed },
            },
            resonances: candidateSnapshot.resonances,
            evolutionIds: selected ? availableEvolutionIds(selected, this.catalog) : [],
            actions: {
                equip: { enabled: Boolean(selected && slot && currentId !== selected.instanceId) },
                unequip: { enabled: Boolean(selected && slot && currentId === selected.instanceId) },
                evolve: { enabled: Boolean(selected && !selected.evolutionId && availableEvolutionIds(selected, this.catalog).length > 0) },
                resetEvolution: { enabled: Boolean(selected?.evolutionId && state.materials.evolutionSample >= 1 + selected.evolutionResetCount * 2) },
                salvage: { enabled: Boolean(selected && !referenced.has(selected.instanceId) && !selected.favorite && !selected.locked) },
            },
        };
    }

    equipSelected(): EquipmentCommandResult<EquipmentState> {
        const state = this.runtime.snapshot();
        const selected = state.instances.find((item) => item.instanceId === this.selectedId);
        const template = selected ? getTemplate(this.catalog, selected.templateId) : undefined;
        if (!selected || !template) return { ok: false, error: "missing-instance" };
        return this.runtime.equip(state.activeLoadoutId, physicalSlot(template.slot), selected.instanceId);
    }

    unequipSelected(): EquipmentCommandResult<EquipmentState> {
        const state = this.runtime.snapshot();
        const selected = state.instances.find((item) => item.instanceId === this.selectedId);
        const template = selected ? getTemplate(this.catalog, selected.templateId) : undefined;
        if (!selected || !template) return { ok: false, error: "missing-instance" };
        return this.runtime.unequip(state.activeLoadoutId, physicalSlot(template.slot));
    }

    selectLoadout(id: string): EquipmentCommandResult<EquipmentState> {
        return this.runtime.selectLoadout(id);
    }

    toggleFavorite(): EquipmentCommandResult<EquipmentState> {
        return this.selectedId ? this.runtime.toggleFavorite(this.selectedId) : { ok: false, error: "missing-instance" };
    }

    toggleLock(): EquipmentCommandResult<EquipmentState> {
        return this.selectedId ? this.runtime.toggleLock(this.selectedId) : { ok: false, error: "missing-instance" };
    }

    chooseEvolution(id: string): EquipmentCommandResult<EquipmentState> {
        return this.selectedId ? this.runtime.chooseEvolution(this.selectedId, id) : { ok: false, error: "missing-instance" };
    }

    resetEvolution(): EquipmentCommandResult<EquipmentState> {
        return this.selectedId ? this.runtime.resetEvolution(this.selectedId) : { ok: false, error: "missing-instance" };
    }

    swapWeapons(): EquipmentCommandResult<EquipmentState> {
        return this.runtime.swapPrimaries();
    }
}
