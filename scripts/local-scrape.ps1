# Wrapper run by the "ReporyjeMenuScrape" scheduled task (7-11 h Mon/Tue/Fri).
# Works in the dedicated clone at %LOCALAPPDATA%\reporyje-menu\repo so it never
# collides with the development checkout. Logs to scrape.log next to it.
$ErrorActionPreference = "Stop"

$base = Join-Path $env:LOCALAPPDATA "reporyje-menu"
$repo = Join-Path $base "repo"
$log = Join-Path $base "scrape.log"

function Log($msg) {
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg" | Add-Content -Path $log -Encoding utf8
}

# Trim log when it grows past ~500 kB
if ((Test-Path $log) -and (Get-Item $log).Length -gt 500KB) {
    Get-Content $log -Tail 1000 | Set-Content $log -Encoding utf8
}

try {
    Log "=== run started ==="
    if (-not (Test-Path $repo)) { throw "Repo clone not found at $repo - run scripts/setup-local-task.ps1 first" }
    Set-Location $repo

    git fetch origin --quiet
    git reset --hard origin/master --quiet

    # npm ci only when node_modules is missing or package-lock.json changed
    $lockHashFile = Join-Path $base "package-lock.hash"
    $lockHash = (Get-FileHash package-lock.json -Algorithm SHA256).Hash
    $cachedHash = if (Test-Path $lockHashFile) { Get-Content $lockHashFile } else { "" }
    if (-not (Test-Path "node_modules") -or $cachedHash -ne $lockHash) {
        Log "npm ci (dependencies changed)..."
        npm ci --no-audit --no-fund 2>&1 | Select-Object -Last 2 | ForEach-Object { Log "  $_" }
        Set-Content $lockHashFile $lockHash
    }

    $output = node scrapers/run-local.js 2>&1
    $scrapeExit = $LASTEXITCODE
    $output | ForEach-Object { Log "  $_" }

    if (git status --porcelain docs/menu-data.json) {
        git add docs/menu-data.json docs/index.html
        git commit -m "data: update menu (local)" --quiet
        git push --quiet 2>&1 | ForEach-Object { Log "  $_" }
        if ($LASTEXITCODE -ne 0) {
            # CI may have pushed meanwhile - next hourly run starts from a clean
            # reset and retries, so just record the rejection
            Log "push rejected (CI pushed meanwhile), will retry next run"
        } else {
            Log "pushed updated menu"
        }
    } else {
        Log "no data changes"
    }

    Log "=== run finished (scrape exit $scrapeExit) ==="
    exit $scrapeExit
} catch {
    Log "ERROR: $_"
    exit 1
}
