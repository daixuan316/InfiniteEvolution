# 导入已购音频素材组：下载 zip -> 解压 -> 按清单 §2 映射到 assets/bundle/audio/
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$base = "E:\project\game\InfiniteEvolutionDoomsdaySurvival\NewProject\.codely-cli\audio-import"
$audioRoot = "E:\project\game\InfiniteEvolutionDoomsdaySurvival\NewProject\assets\bundle\audio"
$zipsDir = Join-Path $base "zips"
$extDir = Join-Path $base "extracted"
New-Item -ItemType Directory -Path $zipsDir -Force | Out-Null
New-Item -ItemType Directory -Path $extDir -Force | Out-Null

$zips = [ordered]@{
  "groan_croak"   = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/25b3889dc0a7ac88/394dca654d9d072d.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015355Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "hiss"          = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/25b3889dc0a7ac88/49e16e10ace70d78.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015355Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "general_emote" = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/25b3889dc0a7ac88/0e68e21b5de89d85.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015355Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "groan"         = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/25b3889dc0a7ac88/40ae6046917c9d04.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015355Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "troll_slow"    = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/25b3889dc0a7ac88/9e60d5e3c6ea7b78.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015355Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "semi_auto"     = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/25e6460590f15052/d0003c2087e07a79.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015358Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "tail_only"     = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/25e6460590f15052/1aec3d92bfcc5c17.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015358Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "scifi_large"   = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/25b3889dc0a7ac88/1355a11d9baf2d2e.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015358Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "shotgun_shot"  = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/25e6460590f15052/05b05c74a011e3ac.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015358Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "cock"          = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/25e6460590f15052/df13b610a4dc7eb6.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015358Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "load"          = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/25e6460590f15052/6fc220e104609c8b.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015358Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "flesh"         = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/1539b1fe5864a03d/ffb46edef91a0b0d.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015402Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "concrete"      = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/1539b1fe5864a03d/a0fdb199fbf6bed5.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015402Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "metal_light"   = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/1539b1fe5864a03d/3a93f8a7b5be34fc.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015402Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "metal_heavy"   = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/1539b1fe5864a03d/7b4da6d9f5714951.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015402Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
  "metal_tin"     = "https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/audio/zip/25b3889dc0a7ac88/d8094322a473b73d.zip?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261103T015402Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host"
}

# 1) 下载 zip（已存在则跳过）
$failed = @()
foreach ($k in $zips.Keys) {
  $zipPath = Join-Path $zipsDir "$k.zip"
  if (Test-Path $zipPath) { continue }
  try {
    Invoke-WebRequest -Uri $zips[$k] -OutFile $zipPath -UseBasicParsing
  } catch {
    $failed += $k
    Write-Host "DOWNLOAD_FAILED: $k -> $($_.Exception.Message)"
  }
}

# 2) 解压
foreach ($k in $zips.Keys) {
  $zipPath = Join-Path $zipsDir "$k.zip"
  if (-not (Test-Path $zipPath)) { continue }
  $dest = Join-Path $extDir $k
  if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
  Expand-Archive -Path $zipPath -DestinationPath $dest -Force
}

# 3) 映射表：group -> (srcName, targetRelativePath)
$pairs = New-Object System.Collections.Generic.List[object]
function Add-Range([string]$g, [string]$srcFmt, [int]$srcStart, [int]$count, [string]$tgtFmt, [int]$tgtStart = 1) {
  for ($i = 0; $i -lt $count; $i++) {
    $script:pairs.Add([pscustomobject]@{ G = $g; Src = ($srcFmt -f ($srcStart + $i)); Tgt = ($tgtFmt -f ($tgtStart + $i)) })
  }
}

# 行尸 walker
Add-Range 'groan_croak'   'zombie_voice_groan_croak_{0:D2}.wav'   1 4 'enemy/walker/idle-{0:D2}.wav'
Add-Range 'hiss'          'zombie_voice_hiss_{0:D2}.wav'          1 3 'enemy/walker/alert-{0:D2}.wav'
Add-Range 'general_emote' 'zombie_voice_general_emote_{0:D2}.wav' 1 4 'enemy/walker/attack-{0:D2}.wav'
Add-Range 'general_emote' 'zombie_voice_general_emote_{0:D2}.wav' 5 4 'enemy/walker/hit-{0:D2}.wav'
Add-Range 'groan'         'zombie_voice_groan_{0:D2}.wav'         1 4 'enemy/walker/death-{0:D2}.wav'
# 奔袭者 runner
Add-Range 'hiss'          'zombie_voice_hiss_{0:D2}.wav'          4 3 'enemy/runner/pounce-{0:D2}.wav'
Add-Range 'general_emote' 'zombie_voice_general_emote_{0:D2}.wav' 9 3 'enemy/runner/hit-{0:D2}.wav'
Add-Range 'general_emote' 'zombie_voice_general_emote_{0:D2}.wav' 12 3 'enemy/runner/death-{0:D2}.wav'
# 巨躯者 brute
Add-Range 'troll_slow'    'troll_monster_growl_slow_{0:D2}.wav'   1 3 'enemy/brute/death-{0:D2}.wav'
# 突击步枪 assault-rifle
Add-Range 'scifi_large'   'sci-fi_weapon_rifle_large_shot_{0:D2}.wav' 1 5 'weapon/assault-rifle/fire-{0:D2}.wav'
Add-Range 'semi_auto'     'gun_semi_auto_rifle_shot_{0:D2}.wav'   1 3 'weapon/assault-rifle/mech-{0:D2}.wav'
$pairs.Add([pscustomobject]@{ G = 'tail_only'; Src = 'gun_semi_auto_rifle_shot_00_tail_only_01.wav'; Tgt = 'weapon/assault-rifle/tail-01.wav' })
# 机枪塔 turret machine-gun
Add-Range 'semi_auto'     'gun_semi_auto_rifle_shot_{0:D2}.wav'   4 5 'ark/turret/machine-gun/fire-{0:D2}.wav'
# 霰弹枪 shotgun
Add-Range 'shotgun_shot'  'gun_shotgun_shot_{0:D2}.wav'           1 4 'weapon/shotgun/fire-{0:D2}.wav'
Add-Range 'cock'          'gun_shotgun_cock_{0:D2}.wav'            1 3 'weapon/shotgun/pump-{0:D2}.wav'
$pairs.Add([pscustomobject]@{ G = 'load'; Src = 'gun_shotgun_load_bullet_01.wav'; Tgt = 'weapon/shotgun/shell-load.wav' })
$pairs.Add([pscustomobject]@{ G = 'load'; Src = 'gun_shotgun_load_bullet_02.wav'; Tgt = 'weapon/shotgun/reload.wav' })
# 通用命中 impact
Add-Range 'flesh'         'bullet_impact_body_flesh_{0:D2}.wav'    1 6 'weapon/impact/flesh-{0:D2}.wav'
Add-Range 'concrete'      'bullet_impact_concrete_brick_{0:D2}.wav' 1 4 'weapon/impact/concrete-{0:D2}.wav'
Add-Range 'metal_light'   'bullet_impact_metal_light_{0:D2}.wav'   1 5 'weapon/impact/metal-{0:D2}.wav'
Add-Range 'metal_heavy'   'bullet_impact_metal_heavy_{0:D2}.wav'   1 5 'weapon/impact/armor-{0:D2}.wav'
# 方舟核心命中 core hit
Add-Range 'metal_light'   'bullet_impact_metal_light_{0:D2}.wav'   6 3 'ark/core/hit-{0:D2}.wav'
$pairs.Add([pscustomobject]@{ G = 'metal_heavy'; Src = 'bullet_impact_metal_heavy_06.wav'; Tgt = 'ark/core/hit-04.wav' })
# 方舟装甲 armor（素材组缺 03 号，映射 01,02,04,05,06）
Add-Range 'metal_tin'     'metal_tin_impacts_hit_hard_01.wav' 0 1 'ark/armor/hit-01.wav'
Add-Range 'metal_tin'     'metal_tin_impacts_hit_hard_02.wav' 0 1 'ark/armor/hit-02.wav'
Add-Range 'metal_tin'     'metal_tin_impacts_hit_hard_04.wav' 0 1 'ark/armor/hit-03.wav'
Add-Range 'metal_tin'     'metal_tin_impacts_hit_hard_05.wav' 0 1 'ark/armor/hit-04.wav'
Add-Range 'metal_tin'     'metal_tin_impacts_hit_hard_06.wav' 0 1 'ark/armor/hit-05.wav'

# 4) 复制到目标
$missing = @()
$copied = 0
foreach ($p in $pairs) {
  $srcDir = Join-Path $extDir $p.G
  if (-not (Test-Path $srcDir)) { $missing += "$($p.G)/$($p.Src) (group not extracted)"; continue }
  $src = Get-ChildItem -Path $srcDir -Recurse -File -Filter $p.Src | Select-Object -First 1
  if ($null -eq $src) { $missing += "$($p.G)/$($p.Src)"; continue }
  $target = Join-Path $audioRoot ($p.Tgt -replace '/', '\')
  $targetDir = Split-Path $target -Parent
  if (-not (Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force | Out-Null }
  Copy-Item $src.FullName $target -Force
  $copied++
}

Write-Host "==== RESULT ===="
Write-Host "COPIED: $copied / $($pairs.Count)"
if ($failed.Count -gt 0) { Write-Host "ZIP_DOWNLOAD_FAILED: $($failed -join ', ')" }
if ($missing.Count -gt 0) { Write-Host "MISSING_CLIPS:"; $missing | ForEach-Object { Write-Host "  - $_" } }
$total = (Get-ChildItem $audioRoot -Recurse -File -Filter *.wav | Measure-Object).Count
Write-Host "TOTAL_WAV_IN_AUDIO_DIR: $total"
