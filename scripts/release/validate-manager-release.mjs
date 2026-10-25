#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { createGunzip } from "node:zlib";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = path.join(repoRoot, "artifacts", "release", "release-packages.manifest.json");

async function sha256File(filePath) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

/**
 * 解析 USTAR tar 归档条目名列表，跨平台无外部 tar 依赖。
 * 仅读取 512 字节块头中的 name 字段，跳过文件内容块。
 */
async function readTarEntryNames(archivePath) {
  const chunks = [];
  await pipeline(
    createReadStream(archivePath),
    createGunzip(),
    async function* (source) {
      for await (const chunk of source) chunks.push(chunk);
    },
  );
  const buffer = Buffer.concat(chunks);
  const names = [];
  let offset = 0;
  while (offset + 512 <= buffer.length) {
    const name = buffer.subarray(offset, offset + 100).toString("utf8").replace(/\0+$/u, "");
    if (!name) break;
    const sizeOctal = buffer.subarray(offset + 124, offset + 136).toString("utf8").replace(/\0+$/u, "").trim();
    const size = sizeOctal ? parseInt(sizeOctal, 8) : 0;
    names.push(name.replace(/^\.\//u, ""));
    const contentBlocks = Math.ceil(size / 512);
    offset += 512 + contentBlocks * 512;
  }
  return names.filter(Boolean);
}

async function archiveEntries(archivePath) {
  return readTarEntryNames(archivePath);
}

assert.ok(existsSync(manifestPath), "release manifest is missing; run pnpm release:package");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
assert.equal(manifest.kind, "sdkwork.release.packages");
assert.equal(manifest.packages?.length, 1);
const released = manifest.packages[0];
const archivePath = path.resolve(repoRoot, released.path);
assert.ok(archivePath.startsWith(path.join(repoRoot, "artifacts", "release")));
assert.ok(existsSync(archivePath), `release archive is missing: ${released.path}`);
assert.equal(await sha256File(archivePath), released.checksum);
assert.ok(existsSync(path.resolve(repoRoot, released.sbomPath)), "release SBOM is missing");

const entries = await archiveEntries(archivePath);
for (const required of [
  "bin/manager-server",
  "web/pc/index.html",
  "etc/standalone.production.env",
  "etc/agent.app.config.json",
  "etc/topology.spec.json",
  "docs/LAUNCH_READINESS.md",
]) {
  assert.ok(entries.includes(required), `release archive is missing ${required}`);
}
for (const entry of entries) {
  assert.doesNotMatch(entry, /(?:^|\/)(?:\.env$|node_modules|target|\.git|.*\.pem|.*\.key)(?:\/|$)/u);
}
console.log(`[release:validate] ok (${released.path})`);
