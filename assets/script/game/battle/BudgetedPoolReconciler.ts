export interface BudgetedAcquisition<T> {
    readonly value: T;
    readonly created: boolean;
}

/** Retains matching IDs, releases obsolete entries, then allows only a bounded number of allocations. */
export function reconcileBudgetedEntries<T>(
    previous: ReadonlyMap<string, T>,
    desiredIds: readonly string[],
    release: (value: T) => void,
    acquire: (index: number, allowCreate: boolean) => BudgetedAcquisition<T> | null,
    creationBudget: number,
): Array<T | null> {
    const remaining = new Map(previous);
    const next: Array<T | null> = desiredIds.map((id) => {
        const retained = remaining.has(id) ? remaining.get(id)! : null;
        if (remaining.has(id)) remaining.delete(id);
        return retained;
    });

    for (const entry of remaining.values()) release(entry);

    let created = 0;
    const budget = Math.max(0, Math.floor(creationBudget));
    for (let index = 0; index < next.length; index++) {
        if (next[index]) continue;
        const acquired = acquire(index, created < budget);
        if (!acquired) continue;
        next[index] = acquired.value;
        if (acquired.created) created++;
    }
    return next;
}
