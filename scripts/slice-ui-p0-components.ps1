param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$sheetRoot = Join-Path $ProjectRoot 'docs\design\assets\ui-p0\source-sheets'
$outputRoot = Join-Path $ProjectRoot 'assets\bundle\gui\ui-p0\texture'

# Generated grids can place a few pixels from a neighboring cell across a grid line.
# These measured strips contain only isolated spill pixels; clearing them makes re-slicing stable.
$edgeCleanup = @{
    'common/02-panel-medium.png' = @{ Edge = 'left'; Size = 14 }
    'common/03-card-compact.png' = @{ Edge = 'left'; Size = 8 }
    'common/05-button-primary.png' = @{ Edge = 'top'; Size = 17 }
    'common/07-button-warning.png' = @{ Edge = 'top'; Size = 13 }
    'defense-hud/02-horde-wave-frame.png' = @{ Edge = 'left'; Size = 3 }
    'exploration-hud/02-shield-frame.png' = @{ Edge = 'left'; Size = 7 }
    'exploration-hud/14-elite-health-frame.png' = @{ Edge = 'right'; Size = 2 }
    'exploration-hud/16-offscreen-direction-marker.png' = @{ Edge = 'left'; Size = 11 }
    'touch-tutorial/02-joystick-thumb.png' = @{ Edge = 'left'; Size = 10 }
    'touch-tutorial/05-button-pressed.png' = @{ Edge = 'top'; Size = 5 }
    'touch-tutorial/07-cooldown-overlay.png' = @{ Edge = 'top'; Size = 2 }
    'touch-tutorial/15-alert-chevrons.png' = @{ Edge = 'right'; Size = 11 }
}

$groups = @(
    @{
        Folder = 'common'
        Sheet = '01-common-components.png'
        Names = @(
            'panel-large', 'panel-medium', 'card-compact', 'tooltip',
            'button-primary', 'button-secondary', 'button-warning', 'button-danger',
            'tab-inactive', 'tab-selected', 'slot-empty', 'slot-selected',
            'bar-status', 'bar-segmented', 'slider', 'toggle-pair'
        )
    },
    @{
        Folder = 'exploration-hud'
        Sheet = '02-exploration-hud.png'
        Names = @(
            'player-health-frame', 'shield-frame', 'injury-frame', 'pollution-frame',
            'day-timer-frame', 'target-health-frame', 'weapon-status-plate', 'backpack-capacity-plate',
            'minimap-bezel', 'objective-distance-plate', 'ark-distance-plate', 'pickup-notification-card',
            'enemy-health-frame', 'elite-health-frame', 'boss-health-frame', 'offscreen-direction-marker'
        )
    },
    @{
        Folder = 'touch-tutorial'
        Sheet = '03-touch-tutorial.png'
        Names = @(
            'joystick-base', 'joystick-thumb', 'action-button-large', 'action-button-medium',
            'button-pressed', 'button-disabled', 'cooldown-overlay', 'charge-progress-ring',
            'tutorial-tap-hand', 'tutorial-swipe-path', 'tutorial-drag-handle', 'tutorial-spotlight-brackets',
            'warning-triangle', 'critical-edge-corner', 'alert-chevrons', 'countdown-badge-plate'
        )
    },
    @{
        Folder = 'defense-hud'
        Sheet = '04-defense-hud.png'
        Names = @(
            'ark-core-frame', 'horde-wave-frame', 'threat-density-frame', 'damaged-module-row',
            'emergency-action-button', 'active-facility-button', 'remote-repair-plate', 'power-priority-selector',
            'module-durability-frame', 'module-damage-badge', 'repair-progress-ring', 'defense-breach-indicator',
            'incoming-wave-banner', 'respite-banner', 'boss-phase-emblem', 'ark-critical-edge-overlay'
        )
    }
)

foreach ($group in $groups) {
    $sheetPath = Join-Path $sheetRoot $group.Sheet
    $groupPath = Join-Path $outputRoot $group.Folder
    New-Item -ItemType Directory -Force -Path $groupPath | Out-Null

    $sheet = [System.Drawing.Bitmap]::FromFile($sheetPath)
    try {
        for ($index = 0; $index -lt 16; $index++) {
            $row = [math]::Floor($index / 4)
            $column = $index % 4
            $sourceX0 = [math]::Round($column * $sheet.Width / 4.0)
            $sourceY0 = [math]::Round($row * $sheet.Height / 4.0)
            $sourceX1 = [math]::Round(($column + 1) * $sheet.Width / 4.0)
            $sourceY1 = [math]::Round(($row + 1) * $sheet.Height / 4.0)
            $sourceRect = [System.Drawing.Rectangle]::FromLTRB($sourceX0, $sourceY0, $sourceX1, $sourceY1)
            $fileName = '{0:D2}-{1}.png' -f ($index + 1), $group.Names[$index]
            $cleanupKey = "$($group.Folder)/$fileName"

            $asset = [System.Drawing.Bitmap]::new(256, 256, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
            try {
                $graphics = [System.Drawing.Graphics]::FromImage($asset)
                try {
                    $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
                    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
                    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
                    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
                    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
                    $graphics.Clear([System.Drawing.Color]::Transparent)
                    $destinationRect = [System.Drawing.Rectangle]::new(0, 0, 256, 256)
                    $graphics.DrawImage($sheet, $destinationRect, $sourceRect, [System.Drawing.GraphicsUnit]::Pixel)

                    if ($edgeCleanup.ContainsKey($cleanupKey)) {
                        $rule = $edgeCleanup[$cleanupKey]
                        $size = [int]$rule.Size
                        $cleanupRect = switch ($rule.Edge) {
                            'left' { [System.Drawing.Rectangle]::new(0, 0, $size, 256) }
                            'right' { [System.Drawing.Rectangle]::new(256 - $size, 0, $size, 256) }
                            'top' { [System.Drawing.Rectangle]::new(0, 0, 256, $size) }
                            'bottom' { [System.Drawing.Rectangle]::new(0, 256 - $size, 256, $size) }
                        }
                        $transparentBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::Transparent)
                        try {
                            $graphics.FillRectangle($transparentBrush, $cleanupRect)
                        }
                        finally {
                            $transparentBrush.Dispose()
                        }
                    }
                }
                finally {
                    $graphics.Dispose()
                }

                $targetPath = Join-Path $groupPath $fileName
                $asset.Save($targetPath, [System.Drawing.Imaging.ImageFormat]::Png)
            }
            finally {
                $asset.Dispose()
            }
        }
    }
    finally {
        $sheet.Dispose()
    }
}

Write-Output "Sliced $($groups.Count * 16) UI assets into $outputRoot"
