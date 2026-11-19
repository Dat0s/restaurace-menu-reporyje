#!/usr/bin/env bash
# Linux/Coolify counterpart of scripts/local-scrape.ps1. Works in a dedicated
# clone at $DATA_DIR/repo (persistent volume), runs scrapers/run-local.js
# (Kantýna + Svoboda only, with its day guard + live freshness check) and
# pushes "data: update menu (server)". Exit code = run-local.js exit code.
set -u

DATA_DIR="${DATA_DIR:-/data}"
REPO="$DATA_DIR/repo"
# Push access: DEPLOY_KEY (private key of a write-enabled repo deploy key,
# preferred) or GITHUB_TOKEN (fine-grained PAT). Neither ever lands in
# .git/config, so git error messages in the log can't leak it.
if [ -n "${DEPLOY_KEY:-}" ]; then
  KEYFILE="$(mktemp)"
  # Coolify may store the multi-line key with literal \n - expand those
  lit='\n'
  printf '%s\n' "${DEPLOY_KEY//"$lit"/$'\n'}" > "$KEYFILE"
  chmod 600 "$KEYFILE"
  trap 'rm -f "$KEYFILE"' EXIT
  export GIT_SSH_COMMAND="ssh -i $KEYFILE -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
  REMOTE="git@github.com:Dat0s/restaurace-menu-reporyje.git"
  CRED=""
elif [ -n "${GITHUB_TOKEN:-}" ]; then
  REMOTE="https://github.com/Dat0s/restaurace-menu-reporyje.git"
  CRED='!f() { echo username=x-access-token; echo "password=$GITHUB_TOKEN"; }; f'
else
  echo "ERROR: set DEPLOY_KEY or GITHUB_TOKEN"; exit 1
fi

log() { echo "$(date '+%Y-%m-%d %H:%M:%S') $*"; }

log "=== run started ==="
mkdir -p "$DATA_DIR"
if [ ! -d "$REPO/.git" ]; then
  log "cloning repo..."
  git -c credential.helper="$CRED" clone --quiet --depth 50 "$REMOTE" "$REPO" || { log "ERROR: clone failed"; exit 1; }
fi
cd "$REPO" || exit 1
git remote set-url origin "$REMOTE"
if [ -n "$CRED" ]; then git config credential.helper "$CRED"; else git config --unset credential.helper; fi
git config user.name "reporyje-menu-server"
git config user.email "${GIT_EMAIL:-reporyje-menu-server@users.noreply.github.com}"

git fetch --quiet origin master || { log "ERROR: git fetch failed"; exit 1; }
git reset --hard --quiet origin/master || { log "ERROR: git reset failed"; exit 1; }

# Reuse the image's node_modules while package-lock matches; otherwise npm ci
# in the clone (and make sure puppeteer's Chrome for the new version exists)
if cmp -s package-lock.json /app/package-lock.json; then
  rm -rf node_modules && ln -s /app/node_modules node_modules
else
  if [ ! -d node_modules ] || [ -L node_modules ] || ! cmp -s package-lock.json "$DATA_DIR/package-lock.json"; then
    log "npm ci (dependencies differ from image)..."
    rm -rf node_modules
    npm ci --no-audit --no-fund || { log "ERROR: npm ci failed"; exit 1; }
    npx puppeteer browsers install chrome >/dev/null || { log "ERROR: chrome install failed"; exit 1; }
    cp package-lock.json "$DATA_DIR/package-lock.json"
  fi
fi

node scrapers/run-local.js
scrape_exit=$?

if [ -n "$(git status --porcelain docs/menu-data.json)" ]; then
  git add docs/menu-data.json docs/index.html
  git commit --quiet -m "data: update menu (server)" || { log "ERROR: commit failed"; exit 1; }
  if git push --quiet origin HEAD:master; then
    log "pushed updated menu"
  else
    # CI may have pushed meanwhile - next run resets and retries
    log "push rejected (CI pushed meanwhile), will retry next run"
  fi
else
  log "no data changes"
fi

log "=== run finished (scrape exit $scrape_exit) ==="
exit $scrape_exit
