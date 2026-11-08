$ErrorActionPreference = 'Continue'
$out = 'E:\project\game\InfiniteEvolutionDoomsdaySurvival\NewProject\.codely-cli\tmp-anim'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$tasks = @(
    @{ name = 'player-idle';   done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6aee824948b6c43e2c5a8d4a/status?poll_token=6aee9e69.87fa2b759a7bd888ad4a95d6a255ee92d5aee996893cac18e9fe892e56e98c8b' },
    @{ name = 'player-attack'; done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6aee824948b6c43e2c5a8d6b/status?poll_token=6aee9e69.ca2409165caaba171bca0a9d70c3b9af008d1c9ac2e00d1e97b52199e81f2a47' },
    @{ name = 'walker-walk';   done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6aee8249b8928179a28c7ced/status?poll_token=6aee9e69.a2f855637b5c75321e8eae19f1a313d0add729119f1074c847e3089f117d8711' },
    @{ name = 'runner-walk';   done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6aee824936c91044df38b6ad/status?poll_token=6aee9e69.02449be323d2c740a546ba324cddf67055a20be9927f6cb6e44fd63fabf9c569' }
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
