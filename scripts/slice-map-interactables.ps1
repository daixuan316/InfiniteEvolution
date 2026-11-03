param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assetRoot = Join-Path $ProjectRoot 'docs\design\assets\map-interactables'
$sheetRoot = Join-Path $assetRoot 'source-sheets'

$lootResourceIds = @(
    'supply-crate', 'armory-crate', 'bio-crate', 'heavy-safe',
    'airdrop-crate', 'hidden-cache', 'weapon-case', 'medical-cabinet',
    'scrap-pile', 'alloy-stack', 'electronics-cache', 'energy-cell-crate',
    'fuel-drum', 'ration-box', 'blueprint-tube', 'mutation-pod'
)

$facilityEventIds = @(
    'power-junction', 'generator', 'purifier', 'repair-terminal',
    'locked-door', 'keycard-reader', 'breakable-barrier', 'movable-cart',
    'elevator-console', 'rail-switch', 'drainage-valve', 'crane-control',
    'radar-terminal', 'rescue-beacon', 'turret-socket', 'extraction-beacon'
)

$groups = @(
    @{ Sheet = '01-ui-loot-resource.png'; Folder = 'ui-markers\loot-resource'; Size = 128; Ids = $lootResourceIds },
    @{ Sheet = '02-ui-facility-event.png'; Folder = 'ui-markers\facility-event'; Size = 128; Ids = $facilityEventIds },
    @{ Sheet = '03-world-loot-resource.png'; Folder = 'world-props\loot-resource'; Size = 256; Ids = $lootResourceIds },
    @{ Sheet = '04-world-facility-event.png'; Folder = 'world-props\facility-event'; Size = 256; Ids = $facilityEventIds }
)

foreach ($group in $groups) {
    $sheetPath = Join-Path $sheetRoot $group.Sheet
    $outputFolder = Join-Path $assetRoot $group.Folder
    New-Item -ItemType Directory -Force -Path $outputFolder | Out-Null

    $sheet = [System.Drawing.Bitmap]::FromFile($sheetPath)
    try {
        if ($sheet.Width -ne $sheet.Height) {
            throw "Source sheet must be square: $sheetPath"
        }

        for ($index = 0; $index -lt 16; $index++) {
            $row = [math]::Floor($index / 4)
            $column = $index % 4
            $x0 = [int][math]::Round($column * $sheet.Width / 4.0)
            $y0 = [int][math]::Round($row * $sheet.Height / 4.0)
            $x1 = [int][math]::Round(($column + 1) * $sheet.Width / 4.0)
            $y1 = [int][math]::Round(($row + 1) * $sheet.Height / 4.0)
            $sourceRect = [System.Drawing.Rectangle]::FromLTRB($x0, $y0, $x1, $y1)

            $size = [int]$group.Size
            $output = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            try {
                $graphics = [System.Drawing.Graphics]::FromImage($output)
                try {
                    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
                    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
                    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
                    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
                    $graphics.Clear([System.Drawing.Color]::Transparent)
                    $destination = [System.Drawing.Rectangle]::new(0, 0, $size, $size)
                    $graphics.DrawImage($sheet, $destination, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
                }
                finally {
                    $graphics.Dispose()
                }

                $fileName = '{0:D2}-{1}.png' -f ($index + 1), $group.Ids[$index]
                $output.Save((Join-Path $outputFolder $fileName), [System.Drawing.Imaging.ImageFormat]::Png)
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

Write-Output "Sliced 64 map-interactable assets into $assetRoot"
