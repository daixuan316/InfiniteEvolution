$ErrorActionPreference = 'Continue'
$out = 'E:\project\game\InfiniteEvolutionDoomsdaySurvival\NewProject\.codely-cli\tmp-anim'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$tasks = @(
    @{ name = 'brute-walk';      done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6aefd7b6c1a2ba575cbb6fca/status?poll_token=6aeff3d6.85da47f37f46ae51b6981e8eeb9e126d37feb6ca3d19a303abbc2af8a3e455c5' },
    @{ name = 'runner-attack';   done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6aefd7b6c1a2ba575cbb6fdd/status?poll_token=6aeff3d6.34a96aac94110a8a4d0935823c03fe5d08920736ba8e2836bf674b4f35fc3990' },
    @{ name = 'walker-ref-clean'; done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6aefd7b848b6c43e2c2941d4/status?poll_token=6aeff3d8.ddc4f4bbefde261e257916025644d177db9d2a736e413eb263f91ce0ec01f486' }
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
