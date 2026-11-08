$ErrorActionPreference = 'Continue'
$out = 'E:\project\game\InfiniteEvolutionDoomsdaySurvival\NewProject\.codely-cli\tmp-anim'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$tasks = @(
    @{ name = 'walker-walk';   done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6af05b6db8928179a2f71c28/status?poll_token=6af0778d.69b8cf132967c9b9b8dff1760eca382ca15229d0153b0111390609f20772b175' },
    @{ name = 'walker-attack'; done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6af05b6db8928179a2f71c2d/status?poll_token=6af0778d.6c42a40345b3a44425d9851c339cc051d3592a6e8cfe4ed170b02b86900bb9af' }
)

$timer = [Diagnostics.Stopwatch]::StartNew()
$budget = 1800
$delay = 10

while ($timer.Elapsed.TotalSeconds -lt $budget) {
    $pending = @($tasks | Where-Object { -not $_.done })
    if ($pending.Count -eq 0) { break }
    foreach ($t in $pending) {
        $response = @(curl.exe -s --ssl-no-revoke --connect-timeout 10 --max-time 20 -w "`n%{http_code}" -- $t.url)
        $rc = $LASTEXITCODE
        if ($rc -eq 0 -and $response.Count -gt 0) {
            $code = [string]$response[-1]
            $body = ''
            if ($response.Count -gt 1) { $body = $response[0..($response.Count-2)] -join "`n" }
            if ($code -eq '200') {
                $status = $null
                try { $status = ($body | ConvertFrom-Json -ErrorAction Stop).status } catch {}
                if ($status -in @('completed','failed','cancelled')) {
                    $t.done = $true
                    Set-Content -Path (Join-Path $out "$($t.name).json") -Value $body -Encoding UTF8
                }
            }
        }
    }
    $pending = @($tasks | Where-Object { -not $_.done })
    if ($pending.Count -gt 0) { Start-Sleep -Seconds $delay }
}

foreach ($t in $tasks) {
    if ($t.done) { "$($t.name): terminal (json saved)" } else { "$($t.name): STILL_PENDING" }
}
