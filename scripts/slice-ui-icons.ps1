param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$iconRoot = Join-Path $ProjectRoot 'docs\design\assets\ui-icons'
$sheetRoot = Join-Path $iconRoot 'source-sheets'
$outputRoot = Join-Path $iconRoot 'icons'

$groups = @(
    @{
        Folder = 'hud-combat'
        Sheet = '01-hud-combat.png'
        Names = @('health', 'shield', 'injury', 'pollution', 'day-timer', 'minimap', 'ark-return', 'dodge', 'active-skill', 'grenade', 'interact', 'weapon-swap', 'emergency-power', 'repair-drone', 'lock-on', 'weak-point')
    },
    @{
        Folder = 'system-nav'
        Sheet = '02-system-nav.png'
        Names = @('map', 'layout', 'workshop', 'research', 'crew', 'storage', 'mission', 'codex', 'settings', 'pause', 'resume', 'save', 'exit', 'confirm', 'cancel', 'lock')
    },
    @{
        Folder = 'resources-items'
        Sheet = '03-resources-items.png'
        Names = @('scrap', 'alloy', 'electronics', 'energy-cell', 'fuel', 'food', 'medicine', 'blueprint', 'mutation-core', 'bio-organ', 'weapon', 'armor', 'helmet', 'boots', 'backpack', 'loot-crate')
    },
    @{
        Folder = 'enemies-status'
        Sheet = '04-enemies-status.png'
        Names = @('walker', 'runner', 'brute', 'spitter', 'elite', 'boss', 'nest', 'contamination', 'corrosion', 'power-outage', 'overload', 'module-damage', 'low-armor', 'morale', 'fatigue', 'rescue')
    },
    @{
        Folder = 'map-actions'
        Sheet = '05-map-actions.png'
        Names = @('hospital', 'police-station', 'factory', 'subway', 'supply-drop', 'ark', 'objective-pin', 'safe-route', 'high-risk-route', 'search', 'rescue', 'bounty', 'acid-rain', 'day-night', 'wave', 'evacuation')
    },
    @{
        Folder = 'attributes-crafting'
        Sheet = '06-attributes-crafting.png'
        Names = @('damage', 'fire-rate', 'accuracy', 'range', 'armor', 'speed', 'critical', 'reload', 'power', 'noise', 'mechanical', 'biological', 'hybrid', 'upgrade', 'recycle', 'craft')
    }
)

foreach ($group in $groups) {
    $sheetPath = Join-Path $sheetRoot $group.Sheet
    $groupPath = Join-Path $outputRoot $group.Folder
    New-Item -ItemType Directory -Force -Path $groupPath | Out-Null

    $sheet = [System.Drawing.Bitmap]::FromFile($sheetPath)
    try {
        if ($sheet.Width -ne $sheet.Height) {
            throw "Source sheet must be square: $sheetPath"
        }

        for ($index = 0; $index -lt 16; $index++) {
            $row = [math]::Floor($index / 4)
            $column = $index % 4
            $sourceX0 = [math]::Round($column * $sheet.Width / 4.0)
            $sourceY0 = [math]::Round($row * $sheet.Height / 4.0)
            $sourceX1 = [math]::Round(($column + 1) * $sheet.Width / 4.0)
            $sourceY1 = [math]::Round(($row + 1) * $sheet.Height / 4.0)
            $sourceRect = [System.Drawing.Rectangle]::FromLTRB($sourceX0, $sourceY0, $sourceX1, $sourceY1)

            $icon = New-Object System.Drawing.Bitmap 128, 128, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            try {
                $graphics = [System.Drawing.Graphics]::FromImage($icon)
                try {
                    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
                    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
                    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
                    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
                    $graphics.Clear([System.Drawing.Color]::Transparent)
                    $destinationRect = New-Object System.Drawing.Rectangle 0, 0, 128, 128
                    $graphics.DrawImage($sheet, $destinationRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)
                }
                finally {
                    $graphics.Dispose()
                }

                $fileName = '{0:D2}-{1}.png' -f ($index + 1), $group.Names[$index]
                $targetPath = Join-Path $groupPath $fileName
                $icon.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
            }
            finally {
                $icon.Dispose()
            }
        }
    }
    finally {
        $sheet.Dispose()
    }
}

Write-Output "Sliced $($groups.Count * 16) icons into $outputRoot"
