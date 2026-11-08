$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

function Test-SheetStructure([string]$path) {
    $bmp = [System.Drawing.Bitmap]::FromFile($path)
    $cell = 256
    $report = @()
    for ($row = 0; $row -lt 4; $row++) {
        for ($col = 0; $col -lt 4; $col++) {
            $opaque = 0
            $total = 0
            for ($y = $row * $cell; $y -lt ($row + 1) * $cell; $y += 4) {
                for ($x = $col * $cell; $x -lt ($col + 1) * $cell; $x += 4) {
                    $total++
                    if ($bmp.GetPixel($x, $y).A -gt 16) { $opaque++ }
                }
            }
            $report += [pscustomobject]@{ Frame = $row * 4 + $col + 1; OpaqueRatio = [Math]::Round($opaque / $total, 3) }
        }
    }
    $bmp.Dispose()
    $empty = @($report | Where-Object { $_.OpaqueRatio -lt 0.02 })
    $overloaded = @($report | Where-Object { $_.OpaqueRatio -gt 0.95 })
    "== $([IO.Path]::GetFileName($path)) =="
    ($report | ForEach-Object { "frame {0,2}: opaque {1:P1}" -f $_.Frame, $_.OpaqueRatio }) -join ' | '
    "empty cells: $($empty.Count), overloaded cells: $($overloaded.Count)"
}

$dir = 'E:\project\game\InfiniteEvolutionDoomsdaySurvival\NewProject\.codely-cli\tmp-anim'
Test-SheetStructure "$dir\brute-walk.png"
Test-SheetStructure "$dir\runner-attack.png"
