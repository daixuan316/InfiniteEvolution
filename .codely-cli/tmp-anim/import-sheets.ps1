$ErrorActionPreference = 'Stop'
$src = 'E:\project\game\InfiniteEvolutionDoomsdaySurvival\NewProject\.codely-cli\tmp-anim'
$dst = 'E:\project\game\InfiniteEvolutionDoomsdaySurvival\NewProject\assets\bundle\gui\battle-hud\actors'
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$imageTemplate = @'
{
  "ver": "1.0.27",
  "importer": "image",
  "imported": true,
  "uuid": "__UUID__",
  "files": [
    ".json",
    ".png"
  ],
  "subMetas": {
    "6c48a": {
      "importer": "texture",
      "uuid": "__UUID__@6c48a",
      "displayName": "__NAME__",
      "id": "6c48a",
      "name": "texture",
      "userData": {
        "wrapModeS": "clamp-to-edge",
        "wrapModeT": "clamp-to-edge",
        "minfilter": "nearest",
        "magfilter": "nearest",
        "mipfilter": "none",
        "anisotropy": 0,
        "isUuid": true,
        "imageUuidOrDatabaseUri": "__UUID__",
        "visible": false
      },
      "ver": "1.0.22",
      "imported": true,
      "files": [
        ".json"
      ],
      "subMetas": {}
    }
  },
  "userData": {
    "type": "texture",
    "fixAlphaTransparencyArtifacts": false,
    "hasAlpha": true,
    "redirect": "__UUID__@6c48a"
  }
}
'@

foreach ($name in @('player-idle', 'player-attack', 'runner-walk')) {
    $uuid = [guid]::NewGuid().ToString()
    Copy-Item (Join-Path $src "$name.png") (Join-Path $dst "$name.png") -Force
    $meta = $imageTemplate.Replace('__UUID__', $uuid).Replace('__NAME__', $name)
    [IO.File]::WriteAllText((Join-Path $dst "$name.png.meta"), $meta, $utf8NoBom)
    "$name.png imported, uuid $uuid"
}

$scriptTemplate = @'
{
  "ver": "4.0.24",
  "importer": "typescript",
  "imported": true,
  "uuid": "__UUID__",
  "files": [],
  "subMetas": {},
  "userData": {}
}
'@
$scriptUuid = [guid]::NewGuid().ToString()
[IO.File]::WriteAllText('E:\project\game\InfiniteEvolutionDoomsdaySurvival\NewProject\assets\script\game\battle\ActorAnimator.ts.meta', $scriptTemplate.Replace('__UUID__', $scriptUuid), $utf8NoBom)
"ActorAnimator.ts.meta written, uuid $scriptUuid"
