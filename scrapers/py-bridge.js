const { execFile } = require("child_process");
const path = require("path");

// Runs a Python scraper from scrapers/py/ and returns its parsed stdout JSON,
// or null on any failure (missing python, non-zero exit, invalid JSON).
function runPythonScraper(scriptName) {
  const script = path.join(__dirname, "py", scriptName);
  const candidates =
    process.platform === "win32" ? ["python", "py"] : ["python3", "python"];

  return new Promise((resolve) => {
    const tryNext = (i) => {
      if (i >= candidates.length) {
        console.log("  No python interpreter found");
        return resolve(null);
      }
      execFile(
        candidates[i],
        [script],
        { timeout: 120000, maxBuffer: 10 * 1024 * 1024 },
        (err, stdout, stderr) => {
          if (err) {
            if (err.code === "ENOENT") return tryNext(i + 1);
            console.log(
              `  Python scraper ${scriptName} failed:`,
              (stderr || err.message).trim().slice(0, 500),
            );
            return resolve(null);
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
