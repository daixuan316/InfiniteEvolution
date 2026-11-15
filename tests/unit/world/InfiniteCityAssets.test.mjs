import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ASSETS = [
    "residential-district-a",
    "residential-district-b",
    "neighborhood-commercial-a",
];

async function pngDimensions(path) {
    const bytes = await readFile(path);
    assert.equal(bytes.toString("ascii", 1, 4), "PNG");
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test("infinite city chunk art exists at the exact logical chunk aspect", async () => {
    for (const id of ASSETS) {
        const base = `assets/bundle/gui/battle-hud/texture/${id}.png`;
        assert.deepEqual(await pngDimensions(base), { width: 1344, height: 768 });
        const meta = JSON.parse(await readFile(`${base}.meta`, "utf8"));
        const texture = Object.values(meta.subMetas).find((entry) => entry.importer === "texture");
        assert.ok(texture, `${id} needs a texture subresource`);
        assert.equal(texture.userData.minfilter, "nearest");
        assert.equal(texture.userData.magfilter, "nearest");
        assert.equal(texture.userData.mipfilter, "none");
    }
});

test("asset manifest maps every generated district id to its Cocos resource", async () => {
    const manifest = JSON.parse(await readFile("docs/design/assets/infinite-city/asset-manifest.json", "utf8"));
    assert.deepEqual(manifest.assets.map((asset) => asset.id), ASSETS);
    assert.ok(manifest.assets.every((asset) => asset.width === 1344 && asset.height === 768));
    assert.ok(manifest.assets.every((asset) => asset.connectors.join(",") === "north,east,south,west"));
});
