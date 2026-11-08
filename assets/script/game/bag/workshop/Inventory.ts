import type { InventorySnapshot, ItemDefinition } from "./WorkshopTypes.ts";

function isPositiveInteger(value: number): boolean {
    return Number.isSafeInteger(value) && value > 0;
}

export class Inventory {
    private readonly counts = new Map<string, number>();
    readonly capacity: number;
    private readonly definitions: Readonly<Record<string, ItemDefinition>>;

    constructor(
        capacity: number,
        definitions: Readonly<Record<string, ItemDefinition>>,
        initial: Readonly<InventorySnapshot> = {},
    ) {
        if (!Number.isSafeInteger(capacity) || capacity < 0) {
            throw new RangeError("capacity must be a non-negative integer");
        }
        this.capacity = capacity;
        this.definitions = definitions;
        for (const [itemId, amount] of Object.entries(initial)) {
            if (this.definitions[itemId] && isPositiveInteger(amount)) {
                this.counts.set(itemId, amount);
                if (this.usedSlots > this.capacity) this.counts.delete(itemId);
            }
        }
    }

    get usedSlots(): number {
        return this.slotsFor(this.counts);
    }

    count(itemId: string): number {
        return this.counts.get(itemId) ?? 0;
    }

    add(itemId: string, amount: number): boolean {
        if (!this.definitions[itemId] || !isPositiveInteger(amount)) return false;
        if (!this.canFit({ [itemId]: amount })) return false;
        this.counts.set(itemId, this.count(itemId) + amount);
        return true;
    }

    remove(itemId: string, amount: number): boolean {
        if (!this.definitions[itemId] || !isPositiveInteger(amount) || this.count(itemId) < amount) return false;
        const next = this.count(itemId) - amount;
        if (next === 0) this.counts.delete(itemId);
        else this.counts.set(itemId, next);
        return true;
    }

    canFit(additions: Readonly<InventorySnapshot>): boolean {
        const projected = new Map(this.counts);
        for (const [itemId, amount] of Object.entries(additions)) {
            if (!this.definitions[itemId] || !isPositiveInteger(amount)) return false;
            projected.set(itemId, (projected.get(itemId) ?? 0) + amount);
        }
        return this.slotsFor(projected) <= this.capacity;
    }

    toSnapshot(): InventorySnapshot {
        return Object.fromEntries(this.counts);
    }

    private slotsFor(counts: ReadonlyMap<string, number>): number {
        let slots = 0;
        for (const [itemId, amount] of counts) {
            slots += Math.ceil(amount / this.definitions[itemId].maxStack);
        }
        return slots;
    }
}
