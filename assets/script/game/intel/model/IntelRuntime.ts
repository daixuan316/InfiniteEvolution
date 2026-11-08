import { findIntelTarget, type IntelTargetDefinition, type IntelTargetId } from "./IntelCatalog";

export class IntelRuntime {
    private targetId: IntelTargetId | null = null;

    get selectedTargetId(): IntelTargetId | null {
        return this.targetId;
    }

    get selectedTarget(): IntelTargetDefinition | null {
        return findIntelTarget(this.targetId);
    }

    selectTarget(id: unknown): boolean {
        const target = findIntelTarget(id);
        if (!target) return false;
        this.targetId = target.id;
        return true;
    }

    clear(): void {
        this.targetId = null;
    }
}

export const intelRuntime = new IntelRuntime();
