param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sourceRoot = Join-Path $ProjectRoot 'docs\design\assets\loot-chests\source-sheets'
$previewRoot = Join-Path $ProjectRoot 'docs\design\assets\loot-chests\previews'
$runtimeRoot = Join-Path $ProjectRoot 'assets\bundle\gui\loot-chests'

$lootIds = @(
    'supply-crate', 'armory-crate', 'bio-crate', 'heavy-safe',
    'airdrop-crate', 'hidden-cache', 'weapon-case', 'medical-cabinet',
    'scrap-pile', 'alloy-stack', 'electronics-cache', 'energy-cell-crate',
    'fuel-drum', 'ration-box', 'blueprint-tube', 'mutation-pod'
)

$states = @('closed', 'opening', 'opened')
$effectIds = @(
    'interaction-gold-ring', 'technology-cyan-ring', 'pollution-magenta-ring',
    'rare-white-gold-star', 'opening-radial-flash', 'diamond-particles',
    'reward-upward-trail', 'completed-soft-glow'
)

function New-TransparentBitmap([int]$Width, [int]$Height) {
    return [System.Drawing.Bitmap]::new(
        $Width,
        $Height,
        [System.Drawing.Imaging.PixelFormat]::Format32bppArgb
    )
}

function Copy-Cell(
    [System.Drawing.Bitmap]$Sheet,
    [int]$Columns,
    [int]$Rows,
    [int]$Index,
    [int]$OutputWidth,
    [int]$OutputHeight
) {
    $row = [math]::Floor($Index / $Columns)
    $column = $Index % $Columns
    $x0 = [int][math]::Round($column * $Sheet.Width / [double]$Columns)
    $y0 = [int][math]::Round($row * $Sheet.Height / [double]$Rows)
    $x1 = [int][math]::Round(($column + 1) * $Sheet.Width / [double]$Columns)
    $y1 = [int][math]::Round(($row + 1) * $Sheet.Height / [double]$Rows)
    $sourceRect = [System.Drawing.Rectangle]::FromLTRB($x0, $y0, $x1, $y1)

    $output = New-TransparentBitmap $OutputWidth $OutputHeight
    $graphics = [System.Drawing.Graphics]::FromImage($output)
    try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
        $graphics.Clear([System.Drawing.Color]::Transparent)
        $destination = [System.Drawing.Rectangle]::new(0, 0, $OutputWidth, $OutputHeight)
        $graphics.DrawImage($Sheet, $destination, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
    }
    finally {
        $graphics.Dispose()
    }
    return $output
}

function Assert-UsableAlpha([System.Drawing.Bitmap]$Bitmap, [string]$Path) {
    $hasTransparent = $false
    $hasVisible = $false
    for ($y = 0; $y -lt $Bitmap.Height; $y += 2) {
        for ($x = 0; $x -lt $Bitmap.Width; $x += 2) {
            $alpha = $Bitmap.GetPixel($x, $y).A
            if ($alpha -lt 255) { $hasTransparent = $true }
            if ($alpha -gt 0) { $hasVisible = $true }
            if ($hasTransparent -and $hasVisible) { return }
        }
    }
    if (-not $hasTransparent) { throw "Output has no transparent pixels: $Path" }
    throw "Output has no visible pixels: $Path"
}

function Save-CheckedPng([System.Drawing.Bitmap]$Bitmap, [string]$Path) {
    $folder = Split-Path -Parent $Path
    New-Item -ItemType Directory -Force -Path $folder | Out-Null
    Assert-UsableAlpha $Bitmap $Path
    $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Read-SquareSheet([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { throw "Missing source sheet: $Path" }
    $sheet = [System.Drawing.Bitmap]::FromFile($Path)
    if ($sheet.Width -ne $sheet.Height) {
        $sheet.Dispose()
        throw "State source sheet must be square: $Path"
    }
    return $sheet
}

function Build-StatePreview([string]$Layer, [int]$CellSize) {
    $labelHeight = 24
    $preview = New-TransparentBitmap ($CellSize * 12) (($CellSize + $labelHeight) * 4)
    $graphics = [System.Drawing.Graphics]::FromImage($preview)
    try {
        $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
        $graphics.Clear([System.Drawing.Color]::FromArgb(255, 25, 29, 35))
        for ($stateIndex = 0; $stateIndex -lt $states.Count; $stateIndex++) {
            for ($index = 0; $index -lt $lootIds.Count; $index++) {
                $row = [math]::Floor($index / 4)
                $column = $index % 4
                $x = ($stateIndex * 4 + $column) * $CellSize
                $y = $row * ($CellSize + $labelHeight)
                $path = Join-Path $runtimeRoot "$Layer\$($lootIds[$index])\$($states[$stateIndex]).png"
                $image = [System.Drawing.Bitmap]::FromFile($path)
                try {
                    $graphics.DrawImage($image, $x, $y, $CellSize, $CellSize)
                }
                finally {
                    $image.Dispose()
                }
                $label = "$($index + 1)-$($states[$stateIndex])"
                $graphics.DrawString($label, [System.Drawing.SystemFonts]::DefaultFont, [System.Drawing.Brushes]::White, $x + 3, $y + $CellSize + 3)
            }
        }
    }
    finally {
        $graphics.Dispose()
    }
    return $preview
}

New-Item -ItemType Directory -Force -Path $previewRoot, $runtimeRoot | Out-Null

foreach ($layer in @('world', 'icons')) {
    $size = if ($layer -eq 'world') { 256 } else { 128 }
    foreach ($state in $states) {
        $sheetPath = Join-Path $sourceRoot "$layer-$state.png"
        $sheet = Read-SquareSheet $sheetPath
        try {
            for ($index = 0; $index -lt $lootIds.Count; $index++) {
                $output = Copy-Cell $sheet 4 4 $index $size $size
                try {
                    $outputPath = Join-Path $runtimeRoot "$layer\$($lootIds[$index])\$state.png"
                    Save-CheckedPng $output $outputPath
                }
                finally {
                    $output.Dispose()
                }
            }
        }
        finally {
            $sheet.Dispose()
        }
    }
}

$effectSheetPath = Join-Path $sourceRoot 'effects.png'
if (-not (Test-Path -LiteralPath $effectSheetPath)) { throw "Missing source sheet: $effectSheetPath" }
$effectSheet = [System.Drawing.Bitmap]::FromFile($effectSheetPath)
try {
    if ($effectSheet.Width -ne $effectSheet.Height * 2) {
        throw "Effects source sheet must use a 4:2 (2:1) grid: $effectSheetPath"
    }
    for ($index = 0; $index -lt $effectIds.Count; $index++) {
        $output = Copy-Cell $effectSheet 4 2 $index 256 256
        try {
            $outputPath = Join-Path $runtimeRoot "effects\$($effectIds[$index]).png"
            Save-CheckedPng $output $outputPath
        }
        finally {
            $output.Dispose()
        }
    }
}
finally {
    $effectSheet.Dispose()
}

$worldPreview = Build-StatePreview 'world' 192
try { $worldPreview.Save((Join-Path $previewRoot 'world-states.png'), [System.Drawing.Imaging.ImageFormat]::Png) }
finally { $worldPreview.Dispose() }

$iconPreview = Build-StatePreview 'icons' 112
try { $iconPreview.Save((Join-Path $previewRoot 'icon-states.png'), [System.Drawing.Imaging.ImageFormat]::Png) }
finally { $iconPreview.Dispose() }

$effectsPreview = New-TransparentBitmap 1024 512
$effectsGraphics = [System.Drawing.Graphics]::FromImage($effectsPreview)
try {
    $effectsGraphics.Clear([System.Drawing.Color]::FromArgb(255, 25, 29, 35))
    for ($index = 0; $index -lt $effectIds.Count; $index++) {
        $row = [math]::Floor($index / 4)
        $column = $index % 4
        $image = [System.Drawing.Bitmap]::FromFile((Join-Path $runtimeRoot "effects\$($effectIds[$index]).png"))
        try { $effectsGraphics.DrawImage($image, $column * 256, $row * 256, 256, 256) }
        finally { $image.Dispose() }
    }
}
finally {
    $effectsGraphics.Dispose()
}
try { $effectsPreview.Save((Join-Path $previewRoot 'effects.png'), [System.Drawing.Imaging.ImageFormat]::Png) }
finally { $effectsPreview.Dispose() }

$manifest = [ordered]@{
    schemaVersion = 1
    generatedAt = (Get-Date).ToString('yyyy-MM-dd')
    sourceTool = 'OpenAI built-in image generation and deterministic PowerShell slicing'
    ids = $lootIds
    states = $states
    effects = $effectIds
    formats = [ordered]@{
        world = [ordered]@{ width = 256; height = 256; colorMode = 'RGBA'; transparent = $true }
        icons = [ordered]@{ width = 128; height = 128; colorMode = 'RGBA'; transparent = $true }
        effects = [ordered]@{ width = 256; height = 256; colorMode = 'RGBA'; transparent = $true }
    }
    runtimeRoot = 'assets/bundle/gui/loot-chests'
    sourceRoot = 'docs/design/assets/loot-chests/source-sheets'
    ordering = 'row-major'
    provenance = [ordered]@{
        sourceType = 'ai-generated-and-derived'
        reviewStatus = 'internal-visual-validation'
        commercialReleaseReviewRequired = $true
    }
}

$manifest | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $runtimeRoot 'asset-manifest.json') -Encoding utf8
Write-Output "Sliced 96 loot state assets and 8 effects into $runtimeRoot"
