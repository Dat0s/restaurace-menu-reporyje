/**
 * Container entrypoint for the Coolify deployment (see Dockerfile).
 * Replaces the Windows "ReporyjeMenuScrape" scheduled task: every 20 min on
 * Mon/Tue/Fri 7–11 h Prague time it runs scripts/server-scrape.sh. Doing the
 * scheduling here (instead of Coolify scheduled tasks) keeps it independent of
 * the host's timezone.
 *
 * HTTP on :3000 — GET /health for Coolify; GET /?token=$RUN_TOKEN shows status
 * + recent log; POST /run?token=$RUN_TOKEN[&force=1] triggers a run (both
 * disabled without RUN_TOKEN). force=1 sets FORCE_SCRAPE (skips day guard + freshness check).
 */
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const SCRIPT = path.join(__dirname, "server-scrape.sh");
const INTERVAL_MS = 20 * 60 * 1000;
const RUN_DAYS = ["Mon", "Tue", "Fri"];
const MAX_LOG_LINES = 2000;

const logLines = [];
let running = false;
let lastRun = null; // { start, end, exit, forced }

function log(line) {
  const l = String(line);
  process.stdout.write(l + "\n");
  logLines.push(l);
  if (logLines.length > MAX_LOG_LINES) logLines.splice(0, logLines.length - MAX_LOG_LINES);
}

function pragueNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    weekday: "short",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return { day: get("weekday"), hour: Number(get("hour")) };
}

function inWindow() {
  const { day, hour } = pragueNow();
  return RUN_DAYS.includes(day) && hour >= 7 && hour < 11;
}

function runScrape(force = false) {
  if (running) return false;
  running = true;
  lastRun = { start: new Date().toISOString(), end: null, exit: null, forced: force };
  const env = { ...process.env };
  if (force) env.FORCE_SCRAPE = "1";
  const child = spawn("bash", [SCRIPT], { env });
  const pipe = (stream) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += d.toString("utf-8");
      const lines = buf.split("\n");
      buf = lines.pop();
      lines.forEach(log);
    });
    stream.on("end", () => buf && log(buf));
  };
  pipe(child.stdout);
  pipe(child.stderr);
  // Hard timeout so a hung Chrome can't block all later runs
  const killer = setTimeout(() => {
    log("ERROR: run exceeded 15 min, killing");
    child.kill("SIGKILL");
  }, 15 * 60 * 1000);
  child.on("close", (code) => {
    clearTimeout(killer);
    running = false;
    lastRun.end = new Date().toISOString();
    lastRun.exit = code;
  });
  return true;
}

function tick() {
  if (inWindow()) runScrape(false);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/health") {
      res.writeHead(200).end("ok");
      return;
    }
    if (!process.env.RUN_TOKEN || url.searchParams.get("token") !== process.env.RUN_TOKEN) {
      res.writeHead(403).end("forbidden");
      return;
    }
    if (url.pathname === "/run" && req.method === "POST") {
      const started = runScrape(url.searchParams.get("force") === "1");
      res.writeHead(started ? 202 : 409).end(started ? "started" : "already running");
      return;
    }
    if (url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
      res.end(
        `running: ${running}\nlastRun: ${JSON.stringify(lastRun)}\n` +
          `window now: ${inWindow()} (${JSON.stringify(pragueNow())})\n\n` +
          logLines.slice(-300).join("\n"),
      );
      return;
    }
    res.writeHead(404).end();
  })
  .listen(3000, () => log("scheduler listening on :3000"));

log(`scheduler started, window Mon/Tue/Fri 7–11 h Europe/Prague, every ${INTERVAL_MS / 60000} min`);
setTimeout(tick, 30 * 1000);
setInterval(tick, INTERVAL_MS);
