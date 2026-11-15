/** Resolves an imported PNG's Cocos Texture2D subresource exactly once. */
export function textureAssetPath(assetPath: string): string {
    return assetPath.endsWith("/texture") ? assetPath : `${assetPath}/texture`;
}
