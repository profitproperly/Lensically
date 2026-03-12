"use strict";

const fs = require("node:fs");
const path = require("node:path");

const nextDir = path.join(process.cwd(), ".next");
const requiredDirs = [
  nextDir,
  path.join(nextDir, "static"),
  path.join(nextDir, "static", "chunks"),
  path.join(nextDir, "static", "css"),
];

for (const dirPath of requiredDirs) {
  fs.mkdirSync(dirPath, { recursive: true });
}
