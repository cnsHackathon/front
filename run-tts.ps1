$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    $pythonPath = (Get-Command python -ErrorAction SilentlyContinue).Source
    $supported = $false
    if ($pythonPath) {
        & $pythonPath -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'
        $supported = $LASTEXITCODE -eq 0
    }
    if (!$supported) {
        $pythonPath = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
    }
    if (!(Test-Path -LiteralPath $pythonPath)) { throw 'Python 3.10 or newer is required for TTS.' }
    if (!(Test-Path -LiteralPath '.tts-runtime/supertonic-1.3.1.dist-info')) {
        & $pythonPath -m pip install --target .tts-runtime 'supertonic[serve]==1.3.1'
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
    $env:SUPERTONIC_CACHE_DIR = Join-Path $PSScriptRoot '.tts-model'
    $env:HF_HUB_DISABLE_IMPLICIT_TOKEN = '1'
    $env:HF_HUB_DISABLE_TELEMETRY = '1'
    $env:SUPERTONIC_INTRA_OP_THREADS = '4'
    & $pythonPath -c 'import sys; sys.path.insert(0, ".tts-runtime"); from supertonic.cli import main; main()' serve --host 127.0.0.1 --port 7788
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
