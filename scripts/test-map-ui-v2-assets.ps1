param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$pipeline = Join-Path $ProjectRoot 'scripts/normalize-map-ui-v2-assets.ps1'
if (!(Test-Path $pipeline)) { throw 'FAIL: normalization pipeline is missing' }
$root = Join-Path $ProjectRoot 'docs/design/assets/map-ui-v2'
$sourceHashes = @{}
Get-ChildItem "$root/source/*.png" | ForEach-Object { $sourceHashes[$_.Name] = (Get-FileHash $_.FullName).Hash }
. $pipeline -ProjectRoot $ProjectRoot
# Hand-derived fixtures catch off-center cover crops in both aspect branches.
$wide=Get-CoverRect ([Drawing.Rectangle]::new(10,20,400,200)) 1.0
$tall=Get-CoverRect ([Drawing.Rectangle]::new(10,20,200,400)) 1.0
if ($wide -ne [Drawing.Rectangle]::new(110,20,200,200) -or $tall -ne [Drawing.Rectangle]::new(10,120,200,200)) { throw 'FAIL centered cover rectangles' }
# Contract: missing outputs, incorrect sizes/alpha and nondeterministic exports must fail.
$groups = @(
    @('maps',3,1334,750), @('mockups',7,1334,750),
    @('map-nodes',12,128,128), @('markers',16,128,128),
    @('route-overlays',3,1024,128), @('hazard-overlays',3,512,512),
    @('location-thumbnails/square',3,0,0), @('location-thumbnails/wide',3,0,0),
    @('interactables/hospital',4,0,0), @('interactables/police-station',4,0,0), @('interactables/factory',4,0,0),
    @('previews',6,0,0)
)
foreach ($group in $groups) {
    $files = @(Get-ChildItem (Join-Path $root "$($group[0])/*.png"))
    if ($files.Count -ne $group[1]) { throw "FAIL: $($group[0]) expected $($group[1]), got $($files.Count)" }
    foreach ($file in $files) {
        $b = [System.Drawing.Bitmap]::FromFile($file.FullName)
        try {
            if ($group[2] -and ($b.Width -ne $group[2] -or $b.Height -ne $group[3])) { throw "FAIL dimensions: $file" }
            if ($group[0] -in @('map-nodes','markers','route-overlays','hazard-overlays')) {
                if ($b.PixelFormat -ne [System.Drawing.Imaging.PixelFormat]::Format32bppArgb) { throw "FAIL RGBA: $file" }
                if ($b.GetPixel(0,0).A -ne 0) { throw "FAIL transparent corner: $file" }
                $visible = $false
                $step=if($group[0] -eq 'hazard-overlays'){1}else{4}
                for ($y=0; $y -lt $b.Height; $y+=$step) { for ($x=0; $x -lt $b.Width; $x+=$step) {
                    $a=$b.GetPixel($x,$y).A
                    if ($a -gt 0) { $visible=$true }
                    if ($group[0] -eq 'hazard-overlays' -and $a -gt 114) { throw "FAIL hazard opacity: $file" }
                } }
                if (!$visible) { throw "FAIL blank layer: $file" }
            }
        } finally { $b.Dispose() }
    }
}
# Gathered files must be byte-for-byte copies of their audited original assets.
foreach ($folder in @('square','wide')) {
    Get-ChildItem "$root/location-thumbnails/$folder/*.png" | ForEach-Object {
        $original=Join-Path $ProjectRoot "docs/design/assets/world-characters-monsters/location-thumbnails/$folder/$($_.Name)"
        if ((Get-FileHash $original).Hash -ne (Get-FileHash $_.FullName).Hash) { throw "FAIL thumbnail copy: $_" }
    }
}
Get-ChildItem "$root/interactables" -Recurse -Filter '*.png' | ForEach-Object {
    $original=@(Get-ChildItem (Join-Path $ProjectRoot 'docs/design/assets/map-interactables/world-props') -Recurse -Filter $_.Name)
    if ($original.Count -ne 1 -or (Get-FileHash $original[0].FullName).Hash -ne (Get-FileHash $_.FullName).Hash) { throw "FAIL interactable copy: $_" }
}
$before=@{}
Get-ChildItem $root -Recurse -Filter '*.png' | ForEach-Object { $before[$_.FullName]=(Get-FileHash $_.FullName).Hash }
& $pipeline -ProjectRoot $ProjectRoot
foreach ($path in $before.Keys) { if ((Get-FileHash $path).Hash -ne $before[$path]) { throw "FAIL nondeterministic: $path" } }
Get-ChildItem "$root/source/*.png" | ForEach-Object { if ((Get-FileHash $_.FullName).Hash -ne $sourceHashes[$_.Name]) { throw "FAIL source modified: $_" } }
Write-Host 'PASS: centered crop, group counts, dimensions, RGBA, transparency, full hazard opacity scan, nonempty layers, exact copies, source integrity and repeatability'
