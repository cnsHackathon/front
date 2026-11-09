$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $nodePath = (Get-Command node -ErrorAction SilentlyContinue).Source
    $major = if ($nodePath) { & $nodePath -p 'process.versions.node.split(".")[0]' } else { 0 }
    if ([int]$major -lt 18) {
        $nodePath = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
    }
    if (!(Test-Path -LiteralPath $nodePath)) { throw 'Node.js 18 or newer is required.' }
    if (!(Test-Path -LiteralPath 'node_modules/vite/bin/vite.js')) {
        npm.cmd install --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    & $nodePath 'node_modules/vite/bin/vite.js' --host localhost
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
