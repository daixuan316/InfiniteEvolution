export type VitalityState = "active" | "downed" | "dead" | "disabled" | "destroyed";
export type VitalityZeroState = Exclude<VitalityState, "active">;
export type VitalityRejectReason = "invalid-amount" | "inactive-target" | "not-repairable";

export interface VitalityConfig {
    maxHealth: number;
    initialHealth?: number;
    maxShield?: number;
    initialShield?: number;
    zeroState: VitalityZeroState;
}

export interface VitalitySnapshot {
    health: number;
    maxHealth: number;
    shield: number;
    maxShield: number;
    healthRatio: number;
    shieldRatio: number;
    state: VitalityState;
}

export interface VitalityChangeResult extends VitalitySnapshot {
    accepted: boolean;
    reason?: VitalityRejectReason;
    requestedAmount: number;
    shieldDamage: number;
    healthDamage: number;
    restoredHealth: number;
    restoredShield: number;
    becameZero: boolean;
    remainingHealth: number;
    remainingShield: number;
}

function validPositive(value: number): boolean {
    return Number.isFinite(value) && value > 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
    return Math.max(minimum, Math.min(maximum, value));
}

export class VitalityRuntime {
    readonly maxHealth: number;
    readonly maxShield: number;
    readonly zeroState: VitalityZeroState;
    currentHealth: number;
    currentShield: number;
    state: VitalityState;

    constructor(config: VitalityConfig) {
        if (!Number.isFinite(config.maxHealth) || config.maxHealth <= 0) {
            throw new RangeError("maxHealth must be finite and positive");
        }
        const maxShield = config.maxShield ?? 0;
        if (!Number.isFinite(maxShield) || maxShield < 0) {
            throw new RangeError("maxShield must be finite and non-negative");
        }
        if (config.initialHealth !== undefined && !Number.isFinite(config.initialHealth)) {
            throw new RangeError("initialHealth must be finite");
        }
        if (config.initialShield !== undefined && !Number.isFinite(config.initialShield)) {
            throw new RangeError("initialShield must be finite");
        }

        this.maxHealth = config.maxHealth;
        this.maxShield = maxShield;
        this.zeroState = config.zeroState;
        this.currentHealth = clamp(config.initialHealth ?? config.maxHealth, 0, config.maxHealth);
        this.currentShield = clamp(config.initialShield ?? maxShield, 0, maxShield);
        this.state = this.currentHealth === 0 ? config.zeroState : "active";
    }

    get healthRatio(): number {
        return this.currentHealth / this.maxHealth;
    }

    get shieldRatio(): number {
        return this.maxShield > 0 ? this.currentShield / this.maxShield : 0;
    }

    get active(): boolean {
        return this.state === "active";
    }

    applyDamage(amount: number): VitalityChangeResult {
        if (!validPositive(amount)) return this.result(false, amount, "invalid-amount");
        if (!this.active) return this.result(false, amount, "inactive-target");

        const shieldDamage = Math.min(this.currentShield, amount);
        this.currentShield -= shieldDamage;
        const healthDamage = Math.min(this.currentHealth, amount - shieldDamage);
        this.currentHealth -= healthDamage;
        const becameZero = this.currentHealth === 0;
        if (becameZero) this.state = this.zeroState;

        return this.result(true, amount, undefined, shieldDamage, healthDamage, 0, 0, becameZero);
    }

    heal(amount: number): VitalityChangeResult {
        if (!validPositive(amount)) return this.result(false, amount, "invalid-amount");
        if (!this.active) return this.result(false, amount, "inactive-target");

        const restoredHealth = Math.min(amount, this.maxHealth - this.currentHealth);
        this.currentHealth += restoredHealth;
        return this.result(true, amount, undefined, 0, 0, restoredHealth);
    }

    restoreShield(amount: number): VitalityChangeResult {
        if (!validPositive(amount)) return this.result(false, amount, "invalid-amount");
        if (!this.active) return this.result(false, amount, "inactive-target");

        const restoredShield = Math.min(amount, this.maxShield - this.currentShield);
        this.currentShield += restoredShield;
        return this.result(true, amount, undefined, 0, 0, 0, restoredShield);
    }

    repair(amount: number): VitalityChangeResult {
        if (!validPositive(amount)) return this.result(false, amount, "invalid-amount");
        if (this.zeroState !== "disabled") return this.result(false, amount, "not-repairable");

        const restoredHealth = Math.min(amount, this.maxHealth - this.currentHealth);
        this.currentHealth += restoredHealth;
        if (this.currentHealth > 0) this.state = "active";
        return this.result(true, amount, undefined, 0, 0, restoredHealth);
    }

    snapshot(): VitalitySnapshot {
        return {
            health: this.currentHealth,
            maxHealth: this.maxHealth,
            shield: this.currentShield,
            maxShield: this.maxShield,
            healthRatio: this.healthRatio,
            shieldRatio: this.shieldRatio,
            state: this.state,
        };
    }

    private result(
        accepted: boolean,
        requestedAmount: number,
        reason?: VitalityRejectReason,
        shieldDamage = 0,
        healthDamage = 0,
        restoredHealth = 0,
        restoredShield = 0,
        becameZero = false,
    ): VitalityChangeResult {
        return {
            ...this.snapshot(),
            accepted,
            reason,
            requestedAmount,
            shieldDamage,
            healthDamage,
            restoredHealth,
            restoredShield,
            becameZero,
            remainingHealth: this.currentHealth,
            remainingShield: this.currentShield,
        };
    }
}
