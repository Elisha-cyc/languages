const fs = require("fs");
const path = require("path");

const pkg = require("./package.json");
const have = new Set([
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.devDependencies || {}),
]);
const skip = new Set(["node_modules", "server", ".git", ".expo"]);
const missing = new Map();

function scan(file) {
  const text = fs.readFileSync(file, "utf8");
  for (const m of text.matchAll(/(?:from|require\()\s*['"]([^'"]+)['"]/g)) {
    const spec = m[1];
    if (spec.startsWith(".") || spec.startsWith("/")) continue;
    const parts = spec.split("/");
    const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
    if (!have.has(name)) {
      if (!missing.has(name)) missing.set(name, file);
    }
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|jsx)$/.test(entry.name)) scan(full);
  }
}

walk(".");

if (missing.size === 0) {
  console.log("Every imported package is in package.json.");
} else {
  for (const [name, file] of missing)
    console.log(`${name}   <- used in ${file}`);
  console.log(
    "\nInstall them with:\nnpx expo install " + [...missing.keys()].join(" "),
  );
}
