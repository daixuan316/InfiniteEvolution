param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$assetRoot = Join-Path $ProjectRoot 'docs\design\assets\world-characters-monsters'
$sourceRoot = Join-Path $assetRoot 'source'

function New-OutputBitmap {
    param([int]$Width, [int]$Height)
    return [System.Drawing.Bitmap]::new($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
}

function Save-Region {
    param(
        [System.Drawing.Bitmap]$Source,
        [System.Drawing.Rectangle]$SourceRect,
        [string]$OutputPath,
        [int]$OutputWidth,
        [int]$OutputHeight
    )

    $output = New-OutputBitmap -Width $OutputWidth -Height $OutputHeight
    try {
        $graphics = [System.Drawing.Graphics]::FromImage($output)
        try {
            $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighSpeed
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::None
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $destination = [System.Drawing.Rectangle]::new(0, 0, $OutputWidth, $OutputHeight)
            $graphics.DrawImage($Source, $destination, $SourceRect, [System.Drawing.GraphicsUnit]::Pixel)
        }
        finally {
            $graphics.Dispose()
        }

        $directory = Split-Path -Parent $OutputPath
        New-Item -ItemType Directory -Force -Path $directory | Out-Null
        $output.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    finally {
        $output.Dispose()
    }
}

function Get-CoverRect {
    param(
        [System.Drawing.Rectangle]$Bounds,
        [double]$TargetAspect
    )

    $sourceAspect = $Bounds.Width / [double]$Bounds.Height
    if ($sourceAspect -gt $TargetAspect) {
        $width = [int][math]::Round($Bounds.Height * $TargetAspect)
        $x = $Bounds.X + [int][math]::Floor(($Bounds.Width - $width) / 2)
        return [System.Drawing.Rectangle]::new($x, $Bounds.Y, $width, $Bounds.Height)
    }

    $height = [int][math]::Round($Bounds.Width / $TargetAspect)
    $y = $Bounds.Y + [int][math]::Floor(($Bounds.Height - $height) / 2)
    return [System.Drawing.Rectangle]::new($Bounds.X, $y, $Bounds.Width, $height)
}

function Get-GridRect {
    param(
        [System.Drawing.Bitmap]$Source,
        [int]$Columns,
        [int]$Rows,
        [int]$Index
    )

    $column = $Index % $Columns
    $row = [math]::Floor($Index / $Columns)
    $x0 = [int][math]::Round($column * $Source.Width / [double]$Columns)
    $y0 = [int][math]::Round($row * $Source.Height / [double]$Rows)
    $x1 = [int][math]::Round(($column + 1) * $Source.Width / [double]$Columns)
    $y1 = [int][math]::Round(($row + 1) * $Source.Height / [double]$Rows)
    return [System.Drawing.Rectangle]::FromLTRB($x0, $y0, $x1, $y1)
}

function Export-FullMap {
    param([string]$SourceName, [string]$OutputName)
    $sourcePath = Join-Path $sourceRoot $SourceName
    $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
    try {
        $bounds = [System.Drawing.Rectangle]::new(0, 0, $source.Width, $source.Height)
        $crop = Get-CoverRect -Bounds $bounds -TargetAspect (1334.0 / 750.0)
        Save-Region -Source $source -SourceRect $crop -OutputPath (Join-Path $assetRoot "maps\$OutputName") -OutputWidth 1334 -OutputHeight 750
    }
    finally {
        $source.Dispose()
    }
}

function Export-Grid {
    param(
        [string]$SourceName,
        [int]$Columns,
        [int]$Rows,
        [string]$OutputFolder,
        [string[]]$Names,
        [int]$OutputWidth = 256,
        [int]$OutputHeight = 256,
        [int]$StartIndex = 1
    )

    $sourcePath = Join-Path $sourceRoot $SourceName
    $source = [System.Drawing.Bitmap]::FromFile($sourcePath)
    try {
        for ($index = 0; $index -lt $Names.Count; $index++) {
            $cell = Get-GridRect -Source $source -Columns $Columns -Rows $Rows -Index $index
            $target = Join-Path $assetRoot ("$OutputFolder\{0:D2}-{1}.png" -f ($StartIndex + $index), $Names[$index])
            Save-Region -Source $source -SourceRect $cell -OutputPath $target -OutputWidth $OutputWidth -OutputHeight $OutputHeight
        }
    }
    finally {
        $source.Dispose()
    }
}

Export-FullMap -SourceName '01-grey-harbor-region-map.png' -OutputName '01-grey-harbor-region-map.png'
Export-FullMap -SourceName '04-hospital-district-day.png' -OutputName '02-hospital-district-day.png'
Export-FullMap -SourceName '05-ark-rooftop-night.png' -OutputName '03-ark-rooftop-night.png'

$locationNames = @('hospital', 'supermarket', 'police-station', 'factory', 'laboratory', 'subway')
Export-Grid -SourceName '06-location-thumbnails-3x2.png' -Columns 3 -Rows 2 -OutputFolder 'location-thumbnails\square' -Names $locationNames -OutputWidth 512 -OutputHeight 512

$locationSource = [System.Drawing.Bitmap]::FromFile((Join-Path $sourceRoot '06-location-thumbnails-3x2.png'))
try {
    for ($index = 0; $index -lt $locationNames.Count; $index++) {
        $cell = Get-GridRect -Source $locationSource -Columns 3 -Rows 2 -Index $index
        $crop = Get-CoverRect -Bounds $cell -TargetAspect (16.0 / 9.0)
        $target = Join-Path $assetRoot ("location-thumbnails\wide\{0:D2}-{1}.png" -f ($index + 1), $locationNames[$index])
        Save-Region -Source $locationSource -SourceRect $crop -OutputPath $target -OutputWidth 512 -OutputHeight 288
    }
}
finally {
    $locationSource.Dispose()
}

Export-Grid -SourceName '02-monsters-topdown-3x3.png' -Columns 3 -Rows 3 -OutputFolder 'monsters\topdown' -Names @('walker', 'runner', 'brute', 'spitter', 'screamer', 'climber', 'burrower', 'parasite', 'bomber')
Export-Grid -SourceName '07-bosses-topdown-3x2.png' -Columns 3 -Rows 2 -OutputFolder 'monsters\topdown' -Names @('boss-butcher-matriarch', 'boss-acid-rain-bladder', 'boss-subway-devourer', 'boss-hivemind-beacon', 'boss-prime-evolution', 'infected-nest') -StartIndex 10
Export-Grid -SourceName '08-monster-portraits-4x2.png' -Columns 4 -Rows 2 -OutputFolder 'monsters\portraits' -Names @('walker', 'runner', 'brute', 'spitter', 'screamer', 'elite', 'butcher-matriarch', 'infected-nest')
Export-Grid -SourceName '03-survivors-topdown-3x2.png' -Columns 3 -Rows 2 -OutputFolder 'characters\topdown' -Names @('engineer', 'doctor', 'scout', 'gunsmith', 'biologist', 'guard')
Export-Grid -SourceName '09-survivor-portraits-3x2.png' -Columns 3 -Rows 2 -OutputFolder 'characters\portraits' -Names @('engineer', 'doctor', 'scout', 'gunsmith', 'biologist', 'guard')
Export-Grid -SourceName '10-protagonist-poses-2x2.png' -Columns 2 -Rows 2 -OutputFolder 'characters\topdown' -Names @('player-idle', 'player-fire', 'player-dodge', 'player-interact') -StartIndex 7

Write-Output "Normalized world, character, and monster assets under $assetRoot"
