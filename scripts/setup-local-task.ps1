# One-time setup for local menu scraping (see scrapers/py/README.md).
#
#   .\scripts\setup-local-task.ps1 -FbCookies ~\Downloads\facebook.com_cookies.txt `
#                                  -IgCookies ~\Downloads\instagram.com_cookies.txt `
#                                  [-UpdateSecrets]
#
# - Filters the cookie exports to facebook.com / instagram.com lines ONLY
#   (browser extensions tend to export ALL domains incl. bank/work sessions),
#   stores them in %LOCALAPPDATA%\reporyje-menu\ and deletes the originals.
# - Clones the repo into %LOCALAPPDATA%\reporyje-menu\repo + npm ci.
# - Registers the "ReporyjeMenuScrape" scheduled task: Mon/Tue/Fri at
#   7,8,9,10,11 h (Wed/Thu skipped - weekly menus don't change midweek).
# Re-run anytime without -FbCookies/-IgCookies to just refresh repo + task.
param(
    [string]$FbCookies,
    [string]$IgCookies,
    [switch]$UpdateSecrets
)
$ErrorActionPreference = "Stop"

$base = Join-Path $env:LOCALAPPDATA "reporyje-menu"
$repo = Join-Path $base "repo"
$repoUrl = "https://github.com/Dat0s/restaurace-menu-reporyje.git"
New-Item -ItemType Directory -Force $base | Out-Null

function Save-FilteredCookies($src, $domainPattern, $dest, $secretName) {
    if (-not (Test-Path $src)) { throw "Cookie file not found: $src" }
    $first = Get-Content $src -TotalCount 1
    if ($first -match '^\s*[\[{]') {
        throw "$src looks like a JSON export - use the Netscape format ('Get cookies.txt LOCALLY' extension)"
    }
    $lines = @(Get-Content $src | Where-Object {
        $_ -and -not $_.StartsWith('#') -and (($_ -split "`t")[0] -match $domainPattern)
    })
    if ($lines.Count -eq 0) { throw "No cookies matching $domainPattern found in $src" }
    Set-Content $dest -Value (@("# Netscape HTTP Cookie File") + $lines) -Encoding utf8
    Write-Host "Saved $($lines.Count) cookies -> $dest"
    if ($UpdateSecrets) {
        Get-Content $dest -Raw | gh secret set $secretName --repo Dat0s/restaurace-menu-reporyje
        Write-Host "GitHub secret $secretName updated"
    }
    Remove-Item $src -Confirm:$false
    Write-Host "Deleted original export $src (full-browser dumps must not linger)"
}

if ($FbCookies) {
    Save-FilteredCookies $FbCookies '(^|\.)facebook\.com$' (Join-Path $base "fb_cookies.txt") "FB_COOKIES"
}
if ($IgCookies) {
    Save-FilteredCookies $IgCookies '(^|\.)instagram\.com$' (Join-Path $base "ig_cookies.txt") "IG_COOKIES"
}
foreach ($f in @("fb_cookies.txt", "ig_cookies.txt")) {
    if (-not (Test-Path (Join-Path $base $f))) {
        Write-Warning "$f missing in $base - Kantyna/Svoboda scraping will be limited until you provide it"
    }
}

if (-not (Test-Path $repo)) {
    Write-Host "Cloning repo into $repo ..."
    git clone --quiet $repoUrl $repo
}
Push-Location $repo
git fetch origin --quiet
git reset --hard origin/master --quiet
Write-Host "Installing npm dependencies (puppeteer download may take a while)..."
npm ci --no-audit --no-fund | Out-Null
Pop-Location

$scriptPath = Join-Path $repo "scripts\local-scrape.ps1"
$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`""
$triggers = 7..11 | ForEach-Object {
    New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday, Tuesday, Friday -At "$($_):00"
}
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
Register-ScheduledTask -TaskName "ReporyjeMenuScrape" -Action $action `
    -Trigger $triggers -Settings $settings -Force | Out-Null

Write-Host ""
Write-Host "Scheduled task 'ReporyjeMenuScrape' registered (Mon/Tue/Fri 7-11 h)."
Write-Host "Test it now with:  Start-ScheduledTask ReporyjeMenuScrape"
Write-Host "Log file:          $base\scrape.log"
