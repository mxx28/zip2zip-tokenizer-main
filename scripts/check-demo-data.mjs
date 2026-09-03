import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const LARGE_FILE_BYTES = 95 * 1024 * 1024;
const RUNS_DIR = "public/demo-runs";
const INDEX_PATH = path.join(RUNS_DIR, "index.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function formatBytes(bytes) {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function isDirectory(relativePath) {
  return fs.existsSync(relativePath) && fs.statSync(relativePath).isDirectory();
}

let hasError = false;

if (!fs.existsSync(INDEX_PATH)) {
  console.error(`MISS ${INDEX_PATH}`);
  process.exit(1);
}

const index = readJson(INDEX_PATH);
const runs = Array.isArray(index.runs) ? index.runs : [];
const listedRunPaths = new Set();

for (const run of runs) {
  if (!run?.path) {
    hasError = true;
    console.error(`MISS ${INDEX_PATH}: run entry missing path`);
    continue;
  }

  const runPath = path.join(RUNS_DIR, run.path);
  listedRunPaths.add(run.path);

  if (!isDirectory(runPath)) {
    hasError = true;
    console.error(`MISS ${runPath}`);
    continue;
  }

  const manifestPath = path.join(runPath, "manifest.json");
  const validationPath = path.join(runPath, "validation.json");

  if (!fs.existsSync(manifestPath)) {
    hasError = true;
    console.error(`MISS ${manifestPath}`);
    continue;
  }

  if (!fs.existsSync(validationPath)) {
    hasError = true;
    console.error(`MISS ${validationPath}`);
  }

  const manifest = readJson(manifestPath);
  const models = Array.isArray(manifest.models) ? manifest.models : [];
  const examples = Array.isArray(manifest.examples) ? manifest.examples : [];
  const missing = [];
  const largeFiles = [];

  for (const model of models) {
    if (!model?.results_file) {
      missing.push(`${model?.slug ?? "unknown"}: missing results_file`);
      continue;
    }

    const resultPath = path.join(runPath, model.results_file);

    if (!fs.existsSync(resultPath)) {
      missing.push(`${model.slug ?? "unknown"}: ${model.results_file}`);
      continue;
    }

    const size = fs.statSync(resultPath).size;
    if (size >= LARGE_FILE_BYTES) {
      largeFiles.push({
        path: path.relative(ROOT, resultPath),
        size,
      });
    }
  }

  console.log(`OK   ${manifestPath} (${models.length} models, ${examples.length} examples)`);

  for (const entry of largeFiles) {
    console.log(`WARN ${entry.path} is ${formatBytes(entry.size)}`);
  }

  for (const entry of missing) {
    hasError = true;
    console.error(`MISS ${manifestPath}: ${entry}`);
  }
}

const unlistedRunDirs = fs
  .readdirSync(RUNS_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .filter((name) => !listedRunPaths.has(name));

for (const dir of unlistedRunDirs) {
  hasError = true;
  console.error(`EXTRA ${path.join(RUNS_DIR, dir)} is not listed in ${INDEX_PATH}`);
}

if (hasError) {
  process.exitCode = 1;
}
