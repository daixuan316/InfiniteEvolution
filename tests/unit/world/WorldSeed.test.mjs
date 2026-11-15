import assert from "node:assert/strict";
import test from "node:test";

import {
    SeededRandom,
    chunkKey,
    deriveSeed,
    parseChunkKey,
} from "../../../assets/script/game/world/infinite/WorldSeed.ts";

test("signed chunk coordinates round-trip through stable keys", () => {
    assert.deepEqual(parseChunkKey(chunkKey({ x: -12, y: 7 })), { x: -12, y: 7 });
    assert.deepEqual(parseChunkKey(chunkKey({ x: 0, y: -1 })), { x: 0, y: -1 });
});

test("chunk keys reject malformed or non-integer coordinates", () => {
    assert.throws(() => chunkKey({ x: 1.5, y: 2 }), /integer/);
    assert.throws(() => parseChunkKey("1.5:2"), /chunk key/);
    assert.throws(() => parseChunkKey("west"), /chunk key/);
});

test("derived random streams are repeatable and isolated", () => {
    const first = new SeededRandom(deriveSeed(0x4a17, { x: -3, y: 9 }, "roads"));
    const second = new SeededRandom(deriveSeed(0x4a17, { x: -3, y: 9 }, "roads"));
    const decoration = new SeededRandom(deriveSeed(0x4a17, { x: -3, y: 9 }, "decoration"));

    assert.deepEqual(
        [first.next(), first.next(), first.int(0, 99)],
        [second.next(), second.next(), second.int(0, 99)],
    );
    assert.notEqual(first.state, decoration.state);
});

test("seeded random values stay inside documented ranges", () => {
    const random = new SeededRandom(deriveSeed(1, { x: 0, y: 0 }, "range"));
    for (let index = 0; index < 1_000; index++) {
        const value = random.next();
        assert.ok(value >= 0 && value < 1);
        const integer = random.int(-4, 7);
        assert.ok(integer >= -4 && integer <= 7);
    }
    assert.throws(() => random.int(4, 3), /range/);
});
