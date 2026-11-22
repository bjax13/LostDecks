const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "frontend", "dist", "index.html");
const target = path.join(root, "functions", "static", "spa-index.html");

if (!fs.existsSync(source)) {
  console.error(`Missing ${source}. Run npm run build:frontend first.`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`Synced production SPA shell to ${path.relative(root, target)}`);
