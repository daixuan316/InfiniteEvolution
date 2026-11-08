$ErrorActionPreference = 'Stop'

function Upload-Ref([string]$path, [string]$url) {
    $curlArgs = @('-sS', '--ssl-no-revoke', '-X', 'PUT', '-H', 'Content-Type: image/png', '-T', $path, '-o', 'NUL', '-w', '%{http_code}', $url)
    $code = & curl.exe @curlArgs
    "$([IO.Path]::GetFileName($path)) -> HTTP $code"
}

$base = 'E:\project\game\InfiniteEvolutionDoomsdaySurvival\NewProject\assets\bundle\gui\battle-hud\actors'

Upload-Ref "$base\player-fire.png" 'https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/mcp-upload/02f273a1b201e47a633e0fd63d523b48/player-fire.png?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261107T014019Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host'
Upload-Ref "$base\walker.png" 'https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/mcp-upload/4097161ac4c4eeb6b31d77547644a9fd/walker.png?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261107T014019Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host'
Upload-Ref "$base\runner.png" 'https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/mcp-upload/ae44d44ce4aba59f143f8354676b35b4/runner.png?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261107T014019Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host'
Upload-Ref "$base\brute.png" 'https://tuanjie-ai-prd.tos-cn-shanghai.volces.com/mcp-upload/dc4a7b439563782481e6560545e7cf28/brute.png?X-Tos-Algorithm=TOS4-HMAC-SHA256&X-Tos-Credential=REDACTED&X-Tos-Date=20261107T014019Z&X-Tos-Expires=3600&X-Tos-Signature=REDACTED&X-Tos-SignedHeaders=host'
