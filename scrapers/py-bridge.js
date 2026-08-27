const { execFile } = require("child_process");
const path = require("path");

// Runs a Python scraper from scrapers/py/ and returns its parsed stdout JSON,
// or null on any failure (missing python, non-zero exit, invalid JSON).
function runPythonScraper(scriptName) {
  const script = path.join(__dirname, "py", scriptName);
  const candidates =
    process.platform === "win32" ? ["python", "py"] : ["python3", "python"];

  return new Promise((resolve) => {
    let lastError = null;
    const tryNext = (i) => {
      if (i >= candidates.length) {
        console.log(
          lastError
            ? `  Python scraper ${scriptName} failed: ${lastError}`
            : "  No python interpreter found",
        );
        return resolve(null);
      }
      execFile(
        candidates[i],
        [script],
        { timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            // A found interpreter can still fail for reasons other than
            // "doesn't exist" (e.g. missing pip packages when multiple
            // Pythons are installed and only one has requirements.txt
            // installed) - keep trying the remaining candidates instead of
            // giving up on the first one that merely exists.
            if (err.code !== "ENOENT") {
              lastError = (stderr || err.message).trim().slice(0, 500);
            }
            return tryNext(i + 1);
          }
          try {
            resolve(JSON.parse(stdout));
          } catch {
            console.log(`  Python scraper ${scriptName} returned invalid JSON`);
            resolve(null);
          }
        },
      );
    };
    tryNext(0);
  });
}

module.exports = { runPythonScraper };
