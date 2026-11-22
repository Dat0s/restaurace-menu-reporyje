# Server-side replacement for the Windows "ReporyjeMenuScrape" task.
# Deployed on Coolify (coolify.vavo.cz). The container runs
# scripts/server-scheduler.js, which on Mon/Tue/Fri 7-11 h Prague time runs
# scripts/server-scrape.sh (fetch → scrape Kantýna+Svoboda → push).
#
# Required env: DEPLOY_KEY (write deploy key, private part) or GITHUB_TOKEN,
#               FB_COOKIES, IG_COOKIES (same format as the GitHub secrets)
# Optional env: RUN_TOKEN (enables POST /run?token=... manual trigger)
FROM node:24-bookworm-slim

ENV TZ=Europe/Prague \
    DEBIAN_FRONTEND=noninteractive \
    PUPPETEER_CACHE_DIR=/opt/puppeteer \
    DATA_DIR=/data

# git + python for the Python tier + shared libraries Chrome needs
RUN apt-get update && apt-get install -y --no-install-recommends \
      git openssh-client ca-certificates tzdata python3 python3-pip python3-venv \
      fonts-liberation libasound2 libatk-bridge2.0-0 libatk1.0-0 libcups2 \
      libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 libx11-xcb1 \
      libxcomposite1 libxdamage1 libxfixes3 libxkbcommon0 libxrandr2 \
      libxshmfence1 xdg-utils \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY scrapers/py/requirements.txt scrapers/py/requirements.txt
RUN python3 -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir -r scrapers/py/requirements.txt
# py-bridge.js looks for "python3" on PATH
ENV PATH=/opt/venv/bin:$PATH

COPY package.json package-lock.json ./
# Skip the postinstall download (it can leave a half-extracted folder) and
# install Chrome explicitly instead
RUN PUPPETEER_SKIP_DOWNLOAD=1 npm ci --no-audit --no-fund \
    && npx puppeteer browsers install chrome

COPY . .
RUN chmod +x scripts/server-scrape.sh

EXPOSE 3000
CMD ["node", "scripts/server-scheduler.js"]
