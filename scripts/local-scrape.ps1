# Wrapper run by the "ReporyjeMenuScrape" scheduled task (7-11 h Mon/Tue/Fri).
# Works in the dedicated clone at %LOCALAPPDATA%\reporyje-menu\repo so it never
# collides with the development checkout. Logs to scrape.log next to it.
#
# Runs under Windows PowerShell 5.1: ErrorActionPreference must stay Continue,
# otherwise any native command writing to stderr (npm warnings, git progress)
# would abort the script. Failures are detected via $LASTEXITCODE instead.
$ErrorActionPreference = "Continue"

$base = Join-Path $env:LOCALAPPDATA "reporyje-menu"
$repo = Join-Path $base "repo"
$log = Join-Path $base "scrape.log"

function Log($msg) {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" | Add-Content -Path $log -Encoding utf8
}

# Runs a native command, logs its output, returns $true on exit code 0
function Run-Logged([string]$label, [scriptblock]$cmd) {
    & $cmd 2>&1 | ForEach-Object { Log "  [$label] $_" }
    if ($LASTEXITCODE -ne 0) {
        Log "ERROR: $label failed with exit code $LASTEXITCODE"
        return $false
    }
    return $true
}

# Trim log when it grows past ~500 kB
if ((Test-Path $log) -and (Get-Item $log).Length -gt 500KB) {
    Get-Content $log -Tail 1000 | Set-Content $log -Encoding utf8
}

Log "=== run started ==="
if (-not (Test-Path $repo)) {
    Log "ERROR: repo clone not found at $repo - run scripts/setup-local-task.ps1 first"
    exit 1
}
Set-Location $repo

if (-not (Run-Logged "git fetch" { git fetch origin --quiet })) { exit 1 }
if (-not (Run-Logged "git reset" { git reset --hard origin/master --quiet })) { exit 1 }

# npm ci only when node_modules is missing or package-lock.json changed
$lockHashFile = Join-Path $base "package-lock.hash"
$lockHash = (Get-FileHash package-lock.json -Algorithm SHA256).Hash
$cachedHash = if (Test-Path $lockHashFile) { Get-Content $lockHashFile } else { "" }
if (-not (Test-Path "node_modules") -or $cachedHash -ne $lockHash) {
    Log "npm ci (dependencies changed)..."
    if (-not (Run-Logged "npm ci" { npm ci --no-audit --no-fund })) { exit 1 }
    Set-Content $lockHashFile $lockHash
}

node scrapers/run-local.js 2>&1 | ForEach-Object { Log "  $_" }
$scrapeExit = $LASTEXITCODE

if (git status --porcelain docs/menu-data.json) {
    git add docs/menu-data.json docs/index.html 2>&1 | Out-Null
    if (-not (Run-Logged "git commit" { git commit -m "data: update menu (local)" --quiet })) { exit 1 }
    if (Run-Logged "git push" { git push --quiet }) {
        Log "pushed updated menu"
    } else {
        # CI may have pushed meanwhile - next hourly run starts from a clean
        # reset and retries, so just record the rejection
        Log "push rejected (CI pushed meanwhile), will retry next run"
    }
} else {
    Log "no data changes"
}

Log "=== run finished (scrape exit $scrapeExit) ==="
exit $scrapeExit
