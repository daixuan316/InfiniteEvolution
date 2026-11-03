param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assetRoot = Join-Path $ProjectRoot 'docs\design\assets\shelter-levels'
$sourceRoot = Join-Path $assetRoot 'source-sheets'

$uiStages = @(
    @{ Source = '01-ui-modified-transport.png'; Id = 'modified-transport' },
    @{ Source = '02-ui-armored-tracked-fortress.png'; Id = 'armored-tracked-fortress' },
    @{ Source = '03-ui-mobile-industrial-platform.png'; Id = 'mobile-industrial-platform' },
    @{ Source = '04-ui-biomechanical-ark.png'; Id = 'biomechanical-ark' },
    @{ Source = '05-ui-doomsday-mobile-citadel.png'; Id = 'doomsday-mobile-citadel' }
)

$arkBaseIds = @(
    'modified-transport',
    'armored-tracked-fortress',
    'mobile-industrial-platform',
    'biomechanical-ark',
    'doomsday-mobile-citadel'
)

$structuralUtilityIds = @(
    'core-reactor', 'generator', 'battery-bank', 'workshop',
    'storage', 'infirmary', 'purifier', 'radar',
    'research-lab', 'crew-quarters', 'command-console', 'drone-repair-dock',
    'crane', 'armor-panel', 'power-junction', 'hatch-ladder'
)

$defenseEvolutionIds = @(
    'machine-gun-turret', 'shotgun-turret', 'flame-turret', 'emp-turret',
    'missile-rack', 'heavy-cannon', 'drone-platform', 'electric-fence-node',
    'spike-barricade', 'shield-emitter', 'lure-beacon', 'regenerative-armor',
    'hunter-gland', 'sensory-organ', 'electric-sac', 'symbiosis-pod'
)

$overlayIds = @(
    'selected', 'placement-valid', 'placement-invalid', 'locked',
    'upgrade-ready', 'powered', 'unpowered', 'overloaded',
    'damaged', 'critical', 'offline', 'auto-repair',
    'parasite', 'bio-unstable', 'adjacency-bonus', 'range-sector'
)

function Initialize-OutputFolder {
    param([string]$Path)

    New-Item -ItemType Directory -Force -Path $Path | Out-Null
    Get-ChildItem -LiteralPath $Path -Filter '*.png' -File -ErrorAction SilentlyContinue |
        ForEach-Object { Remove-Item -LiteralPath $_.FullName }
}

function New-Graphics {
    param([System.Drawing.Bitmap]$Bitmap)

    $graphics = [System.Drawing.Graphics]::FromImage($Bitmap)
    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
    return $graphics
}

function Save-NormalizedUi {
    param(
        [string]$SourcePath,
        [string]$OutputPath
    )

    $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
    try {
        $targetWidth = 1334
        $targetHeight = 750
        $targetRatio = $targetWidth / [double]$targetHeight
        $sourceRatio = $source.Width / [double]$source.Height

        if ($sourceRatio -gt $targetRatio) {
            $cropHeight = $source.Height
            $cropWidth = [int][math]::Round($cropHeight * $targetRatio)
            $cropX = [int][math]::Floor(($source.Width - $cropWidth) / 2.0)
            $cropY = 0
        }
        else {
            $cropWidth = $source.Width
            $cropHeight = [int][math]::Round($cropWidth / $targetRatio)
            $cropX = 0
            $cropY = [int][math]::Floor(($source.Height - $cropHeight) / 2.0)
        }

        $sourceRect = [System.Drawing.Rectangle]::new($cropX, $cropY, $cropWidth, $cropHeight)
        $output = [System.Drawing.Bitmap]::new($targetWidth, $targetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        try {
            $graphics = New-Graphics -Bitmap $output
            try {
                $graphics.Clear([System.Drawing.Color]::Transparent)
                $destination = [System.Drawing.Rectangle]::new(0, 0, $targetWidth, $targetHeight)
                $graphics.DrawImage($source, $destination, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
            }
            finally {
                $graphics.Dispose()
            }
            $output.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        }
        finally {
            $output.Dispose()
        }
    }
    finally {
        $source.Dispose()
    }
}

function Export-GridCells {
    param(
        [string]$SourcePath,
        [int]$Columns,
        [int]$Rows,
        [string[]]$Ids,
        [string]$OutputFolder,
        [int]$TargetWidth,
        [int]$TargetHeight
    )

    $source = [System.Drawing.Bitmap]::FromFile($SourcePath)
    try {
        for ($index = 0; $index -lt $Ids.Count; $index++) {
            $row = [math]::Floor($index / $Columns)
            $column = $index % $Columns
            if ($row -ge $Rows) {
                throw "ID count exceeds the declared grid for $SourcePath"
            }

            $x0 = [int][math]::Round($column * $source.Width / [double]$Columns)
            $y0 = [int][math]::Round($row * $source.Height / [double]$Rows)
            $x1 = [int][math]::Round(($column + 1) * $source.Width / [double]$Columns)
            $y1 = [int][math]::Round(($row + 1) * $source.Height / [double]$Rows)
            $sourceRect = [System.Drawing.Rectangle]::FromLTRB($x0, $y0, $x1, $y1)

            $output = [System.Drawing.Bitmap]::new($TargetWidth, $TargetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            try {
                $graphics = New-Graphics -Bitmap $output
                try {
                    $graphics.Clear([System.Drawing.Color]::Transparent)
                    $destination = [System.Drawing.Rectangle]::new(0, 0, $TargetWidth, $TargetHeight)
                    $graphics.DrawImage($source, $destination, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
                }
                finally {
                    $graphics.Dispose()
                }

                $fileName = '{0:D2}-{1}.png' -f ($index + 1), $Ids[$index]
                $output.Save((Join-Path $OutputFolder $fileName), [System.Drawing.Imaging.ImageFormat]::Png)
            }
            finally {
                $output.Dispose()
            }
        }
    }
    finally {
        $source.Dispose()
    }
}

function Draw-Checkerboard {
    param(
        [System.Drawing.Graphics]$Graphics,
        [int]$Width,
        [int]$Height,
        [int]$CellSize = 16
    )

    $light = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 38, 52, 67))
    $dark = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(255, 27, 38, 52))
    try {
        for ($y = 0; $y -lt $Height; $y += $CellSize) {
            for ($x = 0; $x -lt $Width; $x += $CellSize) {
                $brush = if ((($x / $CellSize) + ($y / $CellSize)) % 2 -eq 0) { $light } else { $dark }
                $Graphics.FillRectangle($brush, $x, $y, [math]::Min($CellSize, $Width - $x), [math]::Min($CellSize, $Height - $y))
            }
        }
    }
    finally {
        $light.Dispose()
        $dark.Dispose()
    }
}

function New-ContactSheet {
    param(
        [System.IO.FileInfo[]]$Files,
        [string]$OutputPath,
        [int]$Columns,
        [int]$CellWidth,
        [int]$CellHeight
    )

    $rows = [int][math]::Ceiling($Files.Count / [double]$Columns)
    $sheetWidth = $Columns * $CellWidth
    $sheetHeight = $rows * $CellHeight
    $sheet = [System.Drawing.Bitmap]::new($sheetWidth, $sheetHeight, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        $graphics = New-Graphics -Bitmap $sheet
        try {
            Draw-Checkerboard -Graphics $graphics -Width $sheetWidth -Height $sheetHeight
            for ($index = 0; $index -lt $Files.Count; $index++) {
                $image = [System.Drawing.Bitmap]::FromFile($Files[$index].FullName)
                try {
                    $column = $index % $Columns
                    $row = [math]::Floor($index / $Columns)
                    $destination = [System.Drawing.Rectangle]::new($column * $CellWidth, $row * $CellHeight, $CellWidth, $CellHeight)
                    $sourceRect = [System.Drawing.Rectangle]::new(0, 0, $image.Width, $image.Height)
                    $graphics.DrawImage($image, $destination, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
                }
                finally {
                    $image.Dispose()
                }
            }
        }
        finally {
            $graphics.Dispose()
        }
        $sheet.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $sheet.Dispose()
    }
}

$uiFolder = Join-Path $assetRoot 'ui-mockups'
$arkFolder = Join-Path $assetRoot 'ark-bases'
$structuralFolder = Join-Path $assetRoot 'modules\structural-utility'
$defenseFolder = Join-Path $assetRoot 'modules\defense-evolution'
$overlayFolder = Join-Path $assetRoot 'overlays'
$previewFolder = Join-Path $assetRoot 'previews'

@($uiFolder, $arkFolder, $structuralFolder, $defenseFolder, $overlayFolder, $previewFolder) |
    ForEach-Object { Initialize-OutputFolder -Path $_ }

for ($index = 0; $index -lt $uiStages.Count; $index++) {
    $stage = $uiStages[$index]
    $fileName = '{0:D2}-{1}.png' -f ($index + 1), $stage.Id
    Save-NormalizedUi -SourcePath (Join-Path $sourceRoot $stage.Source) -OutputPath (Join-Path $uiFolder $fileName)
}

Export-GridCells -SourcePath (Join-Path $sourceRoot '06-ark-level-bases.png') -Columns 2 -Rows 3 -Ids $arkBaseIds -OutputFolder $arkFolder -TargetWidth 768 -TargetHeight 512
Export-GridCells -SourcePath (Join-Path $sourceRoot '07-structural-utility-modules.png') -Columns 4 -Rows 4 -Ids $structuralUtilityIds -OutputFolder $structuralFolder -TargetWidth 256 -TargetHeight 256
Export-GridCells -SourcePath (Join-Path $sourceRoot '08-defense-evolution-modules.png') -Columns 4 -Rows 4 -Ids $defenseEvolutionIds -OutputFolder $defenseFolder -TargetWidth 256 -TargetHeight 256
Export-GridCells -SourcePath (Join-Path $sourceRoot '09-interaction-state-overlays.png') -Columns 4 -Rows 4 -Ids $overlayIds -OutputFolder $overlayFolder -TargetWidth 256 -TargetHeight 256

$uiFiles = @(Get-ChildItem -LiteralPath $uiFolder -Filter '*.png' -File | Sort-Object Name)
$arkFiles = @(Get-ChildItem -LiteralPath $arkFolder -Filter '*.png' -File | Sort-Object Name)
$moduleFiles = @(
    Get-ChildItem -LiteralPath $structuralFolder -Filter '*.png' -File | Sort-Object Name
    Get-ChildItem -LiteralPath $defenseFolder -Filter '*.png' -File | Sort-Object Name
)
$overlayFiles = @(Get-ChildItem -LiteralPath $overlayFolder -Filter '*.png' -File | Sort-Object Name)

New-ContactSheet -Files $uiFiles -OutputPath (Join-Path $previewFolder 'ui-level-overview.png') -Columns 2 -CellWidth 667 -CellHeight 375
New-ContactSheet -Files $arkFiles -OutputPath (Join-Path $previewFolder 'ark-bases.png') -Columns 2 -CellWidth 384 -CellHeight 256
New-ContactSheet -Files $moduleFiles -OutputPath (Join-Path $previewFolder 'modules.png') -Columns 8 -CellWidth 128 -CellHeight 128
New-ContactSheet -Files $overlayFiles -OutputPath (Join-Path $previewFolder 'interaction-state-overlays.png') -Columns 4 -CellWidth 192 -CellHeight 192

Write-Output "Normalized 58 shelter-level deliverables into $assetRoot"

