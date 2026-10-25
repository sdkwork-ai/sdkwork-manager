#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  cpSync,
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const releaseRoot = path.join(repoRoot, "artifacts", "release");
const targetId = "linux-x64-standalone-server-tar-gz";

async function sha256File(filePath) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(filePath), hash);
  return hash.digest("hex");
}

function requirePath(filePath, instruction) {
  if (!existsSync(filePath)) {
    throw new Error(`${path.relative(repoRoot, filePath)} is missing; ${instruction}`);
  }
}

function copyReleaseInputs(stageRoot, binaryPath) {
  const webRoot = path.join(repoRoot, "apps", "sdkwork-manager-pc", "dist");
  const productionProfile = path.join(repoRoot, "etc", "deployments", "standalone.production.env");
  const appManifest = path.join(repoRoot, "agent.app.config.json");
  const topology = path.join(repoRoot, "specs", "topology.spec.json");
  requirePath(binaryPath, "run cargo build --release -p sdkwork-api-manager-standalone-gateway --bin manager-server");
  requirePath(path.join(webRoot, "index.html"), "run pnpm build");
  requirePath(productionProfile, "restore the standalone production profile");

  mkdirSync(path.join(stageRoot, "bin"), { recursive: true });
  cpSync(binaryPath, path.join(stageRoot, "bin", "manager-server"));
  cpSync(webRoot, path.join(stageRoot, "web", "pc"), { recursive: true });
  cpSync(productionProfile, path.join(stageRoot, "etc", "standalone.production.env"));
  cpSync(appManifest, path.join(stageRoot, "etc", "agent.app.config.json"));
  cpSync(topology, path.join(stageRoot, "etc", "topology.spec.json"));
  cpSync(
    path.join(repoRoot, "docs", "runbooks", "LAUNCH_READINESS.md"),
    path.join(stageRoot, "docs", "LAUNCH_READINESS.md"),
  );
}

function createArchive(stageRoot, archivePath) {
  mkdirSync(path.dirname(archivePath), { recursive: true });
  const result = spawnSync("tar", ["-czf", archivePath, "-C", stageRoot, "."], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`tar failed with exit code ${result.status}`);
}

function writeSbom(version, archiveRelativePath) {
  const output = path.join(releaseRoot, "sbom", `${targetId}.sbom.json`);
  mkdirSync(path.dirname(output), { recursive: true });
  const componentNames = [
    "sdkwork-manager",
    "sdkwork-iam",
    "sdkwork-drive",
    "sdkwork-payment",
    "sdkwork-order",
    "sdkwork-promotion",
    "sdkwork-membership",
  ];
  writeFileSync(output, `${JSON.stringify({
    bomFormat: "CycloneDX",
    specVersion: "1.6",
    version: 1,
    metadata: {
      component: { type: "application", name: "sdkwork-manager", version },
      properties: [
        { name: "sdkwork:targetId", value: targetId },
        { name: "sdkwork:artifact", value: archiveRelativePath },
        { name: "sdkwork:deploymentProfile", value: "standalone" },
        { name: "sdkwork:runtimeTarget", value: "server" },
      ],
    },
    components: componentNames.map((name) => ({ type: "application", name, version: "workspace" })),
  }, null, 2)}\n`);
  return path.relative(repoRoot, output).replaceAll("\\", "/");
}

async function main() {
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  const version = process.env.SDKWORK_PACKAGE_VERSION || packageJson.version || "0.0.0";
  const binaryPath = path.resolve(
    repoRoot,
    process.env.SDKWORK_MANAGER_RELEASE_BINARY || "target/release/manager-server",
  );
  const stageRoot = path.join(releaseRoot, ".manager-server-stage");
  const archivePath = path.join(releaseRoot, "linux", "x64", `sdkwork-manager-${version}.tar.gz`);
  rmSync(stageRoot, { recursive: true, force: true });
  rmSync(archivePath, { force: true });
  mkdirSync(stageRoot, { recursive: true });
  copyReleaseInputs(stageRoot, binaryPath);
  createArchive(stageRoot, archivePath);
  rmSync(stageRoot, { recursive: true, force: true });

  const archiveRelativePath = path.relative(repoRoot, archivePath).replaceAll("\\", "/");
  const checksum = await sha256File(archivePath);
  const checksumPath = `${archivePath}.sha256`;
  writeFileSync(checksumPath, `${checksum}  ${path.basename(archivePath)}\n`);
  const sbomPath = writeSbom(version, archiveRelativePath);
  const manifest = {
    schemaVersion: 1,
    kind: "sdkwork.release.packages",
    generatedAt: new Date().toISOString(),
    packages: [{
      id: targetId,
      path: archiveRelativePath,
      checksumAlgorithm: "SHA-256",
      checksum,
      sbomPath,
      enabled: true,
    }],
  };
  writeFileSync(
    path.join(releaseRoot, "release-packages.manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`[release:package] wrote ${archiveRelativePath}`);
}

await main();
