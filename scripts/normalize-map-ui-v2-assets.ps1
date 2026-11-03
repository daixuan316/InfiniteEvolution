param([string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot))
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path $ProjectRoot 'docs/design/assets/map-ui-v2'
$cyan=[Drawing.Color]::FromArgb(255,39,220,232)
$yellow=[Drawing.Color]::FromArgb(255,255,210,64)
$magenta=[Drawing.Color]::FromArgb(255,234,66,167)
$gray=[Drawing.Color]::FromArgb(255,153,166,180)

function New-Canvas([int]$Width,[int]$Height) {
    return [Drawing.Bitmap]::new($Width,$Height,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
}
function New-Graphics([Drawing.Bitmap]$Bitmap) {
    $g=[Drawing.Graphics]::FromImage($Bitmap)
    $g.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceCopy
    $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
    $g.PixelOffsetMode=[Drawing.Drawing2D.PixelOffsetMode]::Half
    $g.SmoothingMode=[Drawing.Drawing2D.SmoothingMode]::None
    $g.Clear([Drawing.Color]::Transparent)
    return $g
}
function Save-Png([Drawing.Bitmap]$Bitmap,[string]$RelativePath) {
    $path=Join-Path $assetRoot $RelativePath
    New-Item -ItemType Directory -Force -Path (Split-Path $path) | Out-Null
    $Bitmap.Save($path,[Drawing.Imaging.ImageFormat]::Png)
}
function Get-CoverRect([Drawing.Rectangle]$Bounds,[double]$TargetAspect) {
    if ($Bounds.Width/[double]$Bounds.Height -gt $TargetAspect) {
        $w=[int][Math]::Round($Bounds.Height*$TargetAspect)
        return [Drawing.Rectangle]::new($Bounds.X+[int][Math]::Floor(($Bounds.Width-$w)/2),$Bounds.Y,$w,$Bounds.Height)
    }
    $h=[int][Math]::Round($Bounds.Width/$TargetAspect)
    return [Drawing.Rectangle]::new($Bounds.X,$Bounds.Y+[int][Math]::Floor(($Bounds.Height-$h)/2),$Bounds.Width,$h)
}
function Save-Region([Drawing.Bitmap]$Source,[Drawing.Rectangle]$SourceRect,[string]$OutputPath,[int]$OutputWidth,[int]$OutputHeight) {
    $b=New-Canvas $OutputWidth $OutputHeight
    $g=New-Graphics $b
    try {
        $g.DrawImage($Source,[Drawing.Rectangle]::new(0,0,$OutputWidth,$OutputHeight),$SourceRect,[Drawing.GraphicsUnit]::Pixel)
        Save-Png $b $OutputPath
    } finally { $g.Dispose(); $b.Dispose() }
}
function Stroke([Drawing.Graphics]$G,[Drawing.Color]$Color,[single]$Width,[scriptblock]$Draw) {
    $p=[Drawing.Pen]::new($Color,$Width)
    try { & $Draw $p } finally { $p.Dispose() }
}
function Fill([Drawing.Graphics]$G,[Drawing.Color]$Color,[scriptblock]$Draw) {
    $brush=[Drawing.SolidBrush]::new($Color)
    try { & $Draw $brush } finally { $brush.Dispose() }
}
function Points($Coordinates) {
    [Drawing.Point[]]$points=for($i=0;$i -lt $Coordinates.Count;$i+=2){[Drawing.Point]::new($Coordinates[$i],$Coordinates[$i+1])}
    return ,$points
}
function Draw-Icon([Drawing.Graphics]$G,[string]$Source,[int]$X,[int]$Y,[int]$Size) {
    $b=[Drawing.Bitmap]::FromFile((Join-Path $ProjectRoot $Source))
    try {
        $G.DrawImage($b,[Drawing.Rectangle]::new($X,$Y,$Size,$Size),[Drawing.Rectangle]::new(0,0,$b.Width,$b.Height),[Drawing.GraphicsUnit]::Pixel)
    } finally { $b.Dispose() }
}
function Draw-Lock([Drawing.Graphics]$G,[int]$X,[int]$Y,[Drawing.Color]$Color) {
    Stroke $G $Color 3 { param($p) $G.DrawArc($p,$X+5,$Y,14,20,180,180) }
    Fill $G $Color { param($b) $G.FillRectangle($b,$X,$Y+10,24,18) }
    Fill $G ([Drawing.Color]::FromArgb(255,17,25,39)) { param($b) $G.FillRectangle($b,$X+10,$Y+15,4,8) }
}
function Draw-Skull([Drawing.Graphics]$G,[int]$X,[int]$Y) {
    Fill $G $magenta { param($b) $G.FillEllipse($b,$X,$Y,28,28) }
    Fill $G ([Drawing.Color]::White) { param($b) $G.FillEllipse($b,$X+5,$Y+3,18,16); $G.FillRectangle($b,$X+9,$Y+16,10,7) }
    Fill $G ([Drawing.Color]::FromArgb(255,31,17,37)) { param($b) $G.FillRectangle($b,$X+8,$Y+9,4,5); $G.FillRectangle($b,$X+16,$Y+9,4,5); $G.FillRectangle($b,$X+13,$Y+18,2,6) }
}

$mapNames=@('01-hospital-day.png','02-police-station-day.png','03-factory-day.png')
$sources=@(Get-ChildItem (Join-Path $assetRoot 'source/*.png') | Sort-Object Name)
if($sources.Count -ne 10){throw "Expected ten source PNGs; found $($sources.Count)"}
for($i=0;$i -lt 10;$i++) {
    $b=[Drawing.Bitmap]::FromFile($sources[$i].FullName)
    try {
        $rect=Get-CoverRect ([Drawing.Rectangle]::new(0,0,$b.Width,$b.Height)) (1334.0/750.0)
        $target=if($i -lt 3){'maps/'+$mapNames[$i]}else{'mockups/'+('{0:D2}-' -f ($i-2))+$sources[$i].Name.Substring(3)}
        Save-Region $b $rect $target 1334 750
    } finally { $b.Dispose() }
}
# This explicit reuse manifest records the original paths; copies retain original filenames.
$copies=@{
    'location-thumbnails/square'=@('world-characters-monsters/location-thumbnails/square/01-hospital.png','world-characters-monsters/location-thumbnails/square/03-police-station.png','world-characters-monsters/location-thumbnails/square/04-factory.png')
    'location-thumbnails/wide'=@('world-characters-monsters/location-thumbnails/wide/01-hospital.png','world-characters-monsters/location-thumbnails/wide/03-police-station.png','world-characters-monsters/location-thumbnails/wide/04-factory.png')
    'interactables/hospital'=@('map-interactables/world-props/loot-resource/08-medical-cabinet.png','map-interactables/world-props/facility-event/03-purifier.png','map-interactables/world-props/facility-event/14-rescue-beacon.png','map-interactables/world-props/facility-event/16-extraction-beacon.png')
    'interactables/police-station'=@('map-interactables/world-props/loot-resource/02-armory-crate.png','map-interactables/world-props/facility-event/05-locked-door.png','map-interactables/world-props/facility-event/06-keycard-reader.png','map-interactables/world-props/loot-resource/07-weapon-case.png')
    'interactables/factory'=@('map-interactables/world-props/facility-event/01-power-junction.png','map-interactables/world-props/facility-event/02-generator.png','map-interactables/world-props/facility-event/12-crane-control.png','map-interactables/world-props/loot-resource/11-electronics-cache.png')
}
foreach($folder in $copies.Keys) {
    New-Item -ItemType Directory -Force (Join-Path $assetRoot $folder) | Out-Null
    foreach($source in $copies[$folder]){Copy-Item -LiteralPath (Join-Path $ProjectRoot ('docs/design/assets/'+$source)) -Destination (Join-Path $assetRoot $folder) -Force}
}
$iconRoot='docs/design/assets/ui-icons/icons/'
$locations=@('hospital','police-station','factory')
for($i=0;$i -lt 3;$i++) {
    foreach($state in @('default','selected','high-risk','locked')) {
        $b=New-Canvas 128 128; $g=New-Graphics $b
        try {
            Draw-Icon $g ($iconRoot+'map-actions/'+('{0:D2}-' -f ($i+1))+$locations[$i]+'.png') 23 23 82
            $g.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceOver
            $color=switch($state){'selected'{$yellow};'high-risk'{$magenta};'locked'{$gray};default{$cyan}}
            Stroke $g $color 4 { param($p) $g.DrawPolygon($p,(Points @(64,5,114,34,114,92,64,121,14,92,14,34))) }
            if($state -eq 'selected') {
                Stroke $g $color 2 { param($p) $g.DrawEllipse($p,20,20,88,88) }
                Fill $g $color { param($brush) $g.FillPolygon($brush,(Points @(51,113,77,113,64,126))) }
            }
            if($state -eq 'high-risk'){Draw-Skull $g 92 88}
            if($state -eq 'locked'){
                Fill $g ([Drawing.Color]::FromArgb(110,25,32,42)) {param($brush) $g.FillEllipse($brush,23,23,82,82)}
                Draw-Lock $g 94 88 $gray
            }
            Save-Png $b ('map-nodes/'+$locations[$i]+'-'+$state+'.png')
        } finally {$g.Dispose();$b.Dispose()}
    }
}
$markers=[ordered]@{
    'player'=''; 'ark'=$iconRoot+'map-actions/06-ark.png'; 'objective'=$iconRoot+'map-actions/07-objective-pin.png'
    'search'=$iconRoot+'map-actions/10-search.png'; 'indoor-entrance'=''; 'evacuation'=$iconRoot+'map-actions/16-evacuation.png'
    'rescue'=$iconRoot+'map-actions/11-rescue.png'; 'keycard'='docs/design/assets/map-interactables/ui-markers/facility-event/06-keycard-reader.png'
    'armory'='docs/design/assets/map-interactables/ui-markers/loot-resource/02-armory-crate.png'
    'power'=$iconRoot+'attributes-crafting/09-power.png'; 'crane'='docs/design/assets/map-interactables/ui-markers/facility-event/12-crane-control.png'
    'noise'=$iconRoot+'attributes-crafting/10-noise.png'; 'pollution'=$iconRoot+'enemies-status/08-contamination.png'
    'safe-route'=$iconRoot+'map-actions/08-safe-route.png'; 'high-risk-route'=$iconRoot+'map-actions/09-high-risk-route.png'
    'locked-area'='docs/design/assets/map-interactables/ui-markers/facility-event/05-locked-door.png'
}
foreach($name in $markers.Keys) {
    $b=New-Canvas 128 128; $g=New-Graphics $b
    try {
        if($markers[$name]){Draw-Icon $g $markers[$name] 24 24 80}
        $g.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceOver
        $color=if($name -in @('pollution','high-risk-route')){$magenta}elseif($name -in @('objective','noise','locked-area')){$yellow}else{$cyan}
        Stroke $g $color 4 {param($p) $g.DrawEllipse($p,7,7,114,114)}
        if($name -eq 'player'){Fill $g $cyan {param($brush) $g.FillPolygon($brush,(Points @(64,25,91,94,64,79,37,94)))}}
        if($name -eq 'indoor-entrance') {
            Stroke $g $cyan 6 {param($p) $g.DrawRectangle($p,47,29,40,72);$g.DrawLine($p,27,65,69,65);$g.DrawLines($p,(Points @(57,52,70,65,57,78)))}
        }
        if($name -eq 'high-risk-route'){Draw-Skull $g 92 88}
        if($name -eq 'locked-area'){Draw-Lock $g 94 88 $yellow}
        Save-Png $b ('markers/'+$name+'.png')
    } finally {$g.Dispose();$b.Dispose()}
}
foreach($kind in @('safe','recommended','high-risk')) {
    $b=New-Canvas 1024 128; $g=New-Graphics $b
    try {
        $g.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceOver
        $color=if($kind -eq 'safe'){$cyan}elseif($kind -eq 'recommended'){$yellow}else{$magenta}
        Stroke $g ([Drawing.Color]::FromArgb(55,$color.R,$color.G,$color.B)) 26 {param($p) $g.DrawLine($p,24,64,1000,64)}
        Stroke $g $color 6 {param($p) if($kind -ne 'safe'){$p.DashPattern=[single[]]@(6,3)};$g.DrawLine($p,24,64,1000,64)}
        for($x=96;$x -lt 1000;$x+=144) {
            if($kind -eq 'recommended'){Fill $g $color {param($brush) $g.FillPolygon($brush,(Points @($x,49,($x+23),64,$x,79)))}}
            if($kind -eq 'high-risk'){Stroke $g $color 4 {param($p) $g.DrawLines($p,(Points @($x,43,($x+18),64,$x,85)));$g.DrawLines($p,(Points @(($x+13),43,($x+31),64,($x+13),85)))}}
        }
        Save-Png $b ('route-overlays/'+$kind+'-route.png')
    } finally {$g.Dispose();$b.Dispose()}
}
foreach($kind in @('pollution','locked-area','high-noise')) {
    $b=New-Canvas 512 512; $g=New-Graphics $b
    try {
        # Low-alpha SourceOver layers preserve the fill at hatch crossings;
        # the full-pixel verification guards against opacity accumulation.
        $g.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceOver
        $color=if($kind -eq 'pollution'){$magenta}elseif($kind -eq 'locked-area'){$gray}else{$yellow}
        $low=[Drawing.Color]::FromArgb(24,$color.R,$color.G,$color.B)
        $edge=[Drawing.Color]::FromArgb(64,$color.R,$color.G,$color.B)
        if($kind -eq 'high-noise') {
            foreach($r in @(52,104,156,208)){Stroke $g $edge 4 {param($p) $g.DrawEllipse($p,256-$r,256-$r,2*$r,2*$r)}}
            Fill $g $low {param($brush) $g.FillEllipse($brush,238,238,36,36)}
        } else {
            $path=[Drawing.Drawing2D.GraphicsPath]::new()
            try {
                if($kind -eq 'pollution'){$path.AddClosedCurve([Drawing.Point[]](Points @(54,122,136,44,264,74,385,42,468,154,424,286,464,396,320,468,176,426,54,458,76,294)),[single]0.5)}
                else{$path.AddRectangle([Drawing.Rectangle]::new(40,40,432,432))}
                $g.SetClip($path)
                Fill $g ([Drawing.Color]::FromArgb(16,$color.R,$color.G,$color.B)) {param($brush) $g.FillRectangle($brush,0,0,512,512)}
                Stroke $g $low 3 {param($p) for($x=-512;$x -lt 1024;$x+=26){$g.DrawLine($p,$x,0,$x+512,512);if($kind -eq 'locked-area'){$g.DrawLine($p,$x,512,$x+512,0)}}}
                $g.ResetClip()
                Stroke $g $edge 4 {param($p) $g.DrawPath($p,$path)}
            } finally {$path.Dispose()}
        }
        Save-Png $b ('hazard-overlays/'+$kind+'.png')
    } finally {$g.Dispose();$b.Dispose()}
}
function Save-ContactSheet([string]$Name,[System.IO.FileInfo[]]$Files,[int]$Columns,[int]$CellWidth,[int]$CellHeight) {
    $rows=[int][Math]::Ceiling($Files.Count/[double]$Columns)
    $b=New-Canvas ($Columns*$CellWidth) ($rows*$CellHeight); $g=New-Graphics $b
    $font=[Drawing.Font]::new('Consolas',10,[Drawing.FontStyle]::Regular,[Drawing.GraphicsUnit]::Pixel)
    try {
        for($y=0;$y -lt $b.Height;$y+=16){for($x=0;$x -lt $b.Width;$x+=16){
            $c=if((($x/16+$y/16)%2) -eq 0){[Drawing.Color]::FromArgb(255,34,43,55)}else{[Drawing.Color]::FromArgb(255,46,57,70)}
            Fill $g $c {param($brush) $g.FillRectangle($brush,$x,$y,16,16)}
        }}
        for($i=0;$i -lt $Files.Count;$i++) {
            $source=[Drawing.Bitmap]::FromFile($Files[$i].FullName)
            try {
                $scale=[Math]::Min(($CellWidth-16)/[double]$source.Width,($CellHeight-36)/[double]$source.Height)
                $w=[int]($source.Width*$scale);$h=[int]($source.Height*$scale)
                $x=[int](($i%$Columns)*$CellWidth+($CellWidth-$w)/2);$y=[int]([Math]::Floor($i/$Columns)*$CellHeight+8)
                $g.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceOver
                $g.DrawImage($source,[Drawing.Rectangle]::new($x,$y,$w,$h),[Drawing.Rectangle]::new(0,0,$source.Width,$source.Height),[Drawing.GraphicsUnit]::Pixel)
                Fill $g ([Drawing.Color]::White) {param($brush) $g.DrawString($Files[$i].BaseName,$font,$brush,[single](($i%$Columns)*$CellWidth+6),[single]($y+$CellHeight-30))}
            } finally {$source.Dispose()}
        }
        Save-Png $b ('previews/'+$Name+'.png')
    } finally {$font.Dispose();$g.Dispose();$b.Dispose()}
}
Save-ContactSheet 'nodes' @(Get-ChildItem "$assetRoot/map-nodes/*.png" | Sort-Object Name) 4 210 180
Save-ContactSheet 'markers' @(Get-ChildItem "$assetRoot/markers/*.png" | Sort-Object Name) 4 210 180
Save-ContactSheet 'routes-hazards' @(@(Get-ChildItem "$assetRoot/route-overlays/*.png";Get-ChildItem "$assetRoot/hazard-overlays/*.png") | Sort-Object FullName) 3 360 300
Save-ContactSheet 'interactables' @(Get-ChildItem "$assetRoot/interactables" -Recurse -Filter '*.png' | Sort-Object FullName) 4 240 220
Save-ContactSheet 'maps' @(Get-ChildItem "$assetRoot/maps/*.png" | Sort-Object Name) 1 800 470
Save-ContactSheet 'mockups' @(Get-ChildItem "$assetRoot/mockups/*.png" | Sort-Object Name) 2 800 470
$counts=[ordered]@{maps=3;mockups=7;'location-thumbnails/square'=3;'location-thumbnails/wide'=3;'map-nodes'=12;markers=16;'route-overlays'=3;'hazard-overlays'=3;'interactables/hospital'=4;'interactables/police-station'=4;'interactables/factory'=4;previews=6}
foreach($group in $counts.Keys){$count=@(Get-ChildItem (Join-Path $assetRoot "$group/*.png")).Count;if($count -ne $counts[$group]){throw "Unexpected $group count: $count"};Write-Host "$group=$count"}
