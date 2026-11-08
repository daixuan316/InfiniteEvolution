$ErrorActionPreference = 'Continue'
$out = 'E:\project\game\InfiniteEvolutionDoomsdaySurvival\NewProject\.codely-cli\tmp-anim'
New-Item -ItemType Directory -Force -Path $out | Out-Null

$tasks = @(
    @{ name = 'player-walk';    done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6aef281348b6c43e2c086340/status?poll_token=6aef4433.3143874ea02ce3601b88c01cef0a9db06fca41ce2d3eb104b4431125bf2f8a1e' },
    @{ name = 'player-dodge';   done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6aef281348b6c43e2c08636b/status?poll_token=6aef4433.ca876abd241a52cb9600b51873a8d99b44e630b4813716b5fe6a620df58372ae' },
    @{ name = 'walker-attack';  done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6aef281336c91044dfc3f4d0/status?poll_token=6aef4433.5d6f9bae9411862de8f8d67f9edd1198d810872e887d69b6109a2254cb26df72' },
    @{ name = 'brute-attack';    done = $false; url = 'https://ai-generator.tuanjie.cn/api/task/6aef281348b6c43e2c086358/status?poll_token=6aef4433.53ea056ac7d1c72c53a467bc1930a0d0ab9138917367e5ff992a38e4f5918d1b' }
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
