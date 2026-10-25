#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appManifest = JSON.parse(readFileSync(path.join(repoRoot, "agent.app.config.json"), "utf8"));
const version = process.env.SDKWORK_PACKAGE_VERSION
  || appManifest.release?.currentVersion
  || appManifest.release?.version
  || "0.0.0-dev";
const browserRoot = path.join(repoRoot, "apps", "sdkwork-manager-pc", "dist");
const sbomPath = path.join(
  repoRoot,
  "artifacts",
  "release",
  "sbom",
  "web-universal-cloud-browser-zip.sbom.json",
);

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function browserFiles(directory = browserRoot) {
  assert.ok(existsSync(path.join(browserRoot, "index.html")), "Manager browser release is missing index.html");
  return readdirSync(directory)
    .flatMap((name) => {
      const filePath = path.join(directory, name);
      return statSync(filePath).isDirectory() ? browserFiles(filePath) : [filePath];
    })
    .sort();
}

function components() {
  return browserFiles().map((filePath) => ({
    type: "file",
    name: path.relative(browserRoot, filePath).replaceAll("\\", "/"),
    hashes: [{ alg: "SHA-256", content: sha256(filePath) }],
  }));
}

function generate() {
  const sbom = {
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      component: {
        type: "application",
        name: "sdkwork-manager-pc-browser",
        version,
        properties: [
          { name: "sdkwork:deploymentProfile", value: "cloud" },
          { name: "sdkwork:runtimeTarget", value: "browser" },
        ],
      },
    },
    components: components(),
  };
  mkdirSync(path.dirname(sbomPath), { recursive: true });
  writeFileSync(sbomPath, `${JSON.stringify(sbom, null, 2)}\n`);
  console.log(`[release:sbom:browser] wrote ${path.relative(repoRoot, sbomPath)}`);
}

function validate() {
  assert.ok(existsSync(sbomPath), `Manager browser release SBOM is missing: ${path.relative(repoRoot, sbomPath)}`);
  const sbom = JSON.parse(readFileSync(sbomPath, "utf8"));
  assert.equal(sbom.bomFormat, "CycloneDX");
  assert.equal(sbom.specVersion, "1.6");
  assert.equal(sbom.metadata?.component?.name, "sdkwork-manager-pc-browser");
  assert.equal(sbom.metadata?.component?.version, version);
  const expected = components();
  assert.deepEqual(sbom.components, expected, "Manager browser release SBOM file hashes drifted");
  console.log(`[release:sbom:browser:validate] ok (${path.relative(repoRoot, sbomPath)})`);
}

const command = process.argv[2] || "generate";
if (command === "generate") generate();
else if (command === "validate") validate();
else throw new Error(`unsupported browser release SBOM command: ${command}`);
