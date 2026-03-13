"use strict";

async function main() {
  const fs = await import("node:fs");
  const path = await import("node:path");

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
}

void main();
