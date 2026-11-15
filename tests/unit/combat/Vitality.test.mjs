import assert from "node:assert/strict";
import test from "node:test";

import { VitalityRuntime } from "../../../assets/script/game/combat/Vitality.ts";

test("damage drains shield before health and reports the split", () => {
    const vitality = new VitalityRuntime({ maxHealth: 100, maxShield: 30, zeroState: "downed" });
    const result = vitality.applyDamage(50);

    assert.equal(result.accepted, true);
    assert.equal(result.shieldDamage, 30);
    assert.equal(result.healthDamage, 20);
    assert.equal(result.remainingHealth, 80);
    assert.equal(result.remainingShield, 0);
    assert.equal(result.healthRatio, 0.8);
    assert.equal(result.becameZero, false);
});

test("zero transition is emitted only once", () => {
    const vitality = new VitalityRuntime({ maxHealth: 40, zeroState: "dead" });
    const lethal = vitality.applyDamage(100);
    const repeated = vitality.applyDamage(10);

    assert.equal(lethal.becameZero, true);
    assert.equal(lethal.state, "dead");
    assert.equal(repeated.accepted, false);
    assert.equal(repeated.reason, "inactive-target");
    assert.equal(repeated.becameZero, false);
    assert.equal(vitality.currentHealth, 0);
});

test("invalid amounts never mutate vitality", () => {
    const vitality = new VitalityRuntime({ maxHealth: 100, zeroState: "downed" });

    for (const amount of [-1, 0, Number.NaN, Number.POSITIVE_INFINITY]) {
        assert.equal(vitality.applyDamage(amount).accepted, false);
    }

    assert.equal(vitality.currentHealth, 100);
    assert.equal(vitality.state, "active");
});

test("healing and shield restoration clamp to their maxima", () => {
    const vitality = new VitalityRuntime({ maxHealth: 100, maxShield: 40, zeroState: "downed" });
    vitality.applyDamage(70);

    assert.equal(vitality.heal(100).remainingHealth, 100);
    assert.equal(vitality.restoreShield(100).remainingShield, 40);
});

test("disabled structures reactivate after repair", () => {
    const vitality = new VitalityRuntime({ maxHealth: 60, zeroState: "disabled" });
    vitality.applyDamage(100);
    const repaired = vitality.repair(15);

    assert.equal(repaired.accepted, true);
    assert.equal(repaired.state, "active");
    assert.equal(repaired.remainingHealth, 15);
});

test("repair cannot revive dead actors", () => {
    const vitality = new VitalityRuntime({ maxHealth: 60, zeroState: "dead" });
    vitality.applyDamage(100);

    assert.equal(vitality.repair(15).reason, "not-repairable");
    assert.equal(vitality.state, "dead");
});

test("constructor rejects non-finite initial values", () => {
    assert.throws(
        () => new VitalityRuntime({ maxHealth: 100, initialHealth: Number.NaN, zeroState: "downed" }),
        /initialHealth/,
    );
    assert.throws(
        () => new VitalityRuntime({ maxHealth: 100, maxShield: Number.POSITIVE_INFINITY, zeroState: "downed" }),
        /maxShield/,
    );
});
