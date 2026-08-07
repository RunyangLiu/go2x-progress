import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(scriptDir, "..");
const progressPath = path.join(rootDir, "progress", "progress.json");
const docsProgressPath = path.join(rootDir, "docs", "progress.json");
const architecturePath = path.join(rootDir, "docs", "architecture.html");
const validStatuses = new Set(["done", "doing", "blocked", "planned"]);
const errors = [];

for (const filePath of [progressPath, docsProgressPath, architecturePath]) {
  if (!fs.existsSync(filePath)) errors.push(`Missing required artifact: ${filePath}`);
}

if (fs.existsSync(progressPath)) {
  const progress = JSON.parse(fs.readFileSync(progressPath, "utf8"));
  const ids = new Set();

  if (progress.schemaVersion !== 1) errors.push("Unsupported progress schema version");
  if (!Array.isArray(progress.items) || progress.items.length === 0) errors.push("Progress items are empty");

  for (const item of progress.items || []) {
    if (!item.id || ids.has(item.id)) errors.push(`Duplicate or missing item id: ${item.id}`);
    ids.add(item.id);
    if (!validStatuses.has(item.status)) errors.push(`Invalid status for ${item.id}: ${item.status}`);
    if (!item.title || !item.summary || !item.nextStep) errors.push(`Incomplete item: ${item.id}`);
  }

  const counts = Object.values(progress.metrics?.counts || {}).reduce((sum, value) => sum + value, 0);
  if (counts !== progress.items.length) errors.push("Progress metrics do not match item count");
  if (progress.metrics?.completionPercent < 0 || progress.metrics?.completionPercent > 100) {
    errors.push("Completion percentage is outside 0..100");
  }
}

if (errors.length > 0) {
  console.error(JSON.stringify({ ok: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, checks: 7 }, null, 2));
