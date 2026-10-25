import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("Manager workflow packages the standalone server instead of skipping it", () => {
  const workflow = JSON.parse(readFileSync(path.join(root, "agent.workflow.json"), "utf8"));
  const rootPackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const lifecycleRunner = readFileSync(
    path.join(root, "scripts/release/manager-release-lifecycle.mjs"),
    "utf8",
  );
  const packageScript = workflow.lifecycle.package.map((step) => step.run).join("\n");
  assert.ok(workflow.lifecycle.package.every((step) => step.shell === "node"));
  assert.match(packageScript, /runManagerReleasePhase\('package'\)/);
  assert.match(lifecycleRunner, /"cargo", \[/);
  assert.match(lifecycleRunner, /runPnpm\("_sdkwork:release:package:standalone"\)/);
  assert.match(lifecycleRunner, /runPnpm\("_sdkwork:release:validate:standalone"\)/);
  assert.doesNotMatch(packageScript, /pnpm release:(?:package|validate)(?:\s|$)/);
  assert.match(rootPackage.scripts["release:package:standalone"], /sdkwork-app release:package --deployment-profile standalone/);
  assert.match(rootPackage.scripts["release:package:cloud"], /sdkwork-app release:package --deployment-profile cloud/);
  for (const forbiddenScript of [
    "gateway:package:cloud",
    "gateway:validate:cloud",
    "gateway:sbom:cloud",
    "gateway:sbom:cloud:validate",
  ]) {
    assert.equal(rootPackage.scripts[forbiddenScript], undefined);
  }
  assert.ok(workflow.dependencies.some((dependency) => dependency.id === "sdkwork-specs"));
});

test("Manager release scripts require binary, web, config, checksum, and SBOM evidence", () => {
  const packager = readFileSync(path.join(root, "scripts/release/package-manager-server.mjs"), "utf8");
  const validator = readFileSync(path.join(root, "scripts/release/validate-manager-release.mjs"), "utf8");
  for (const marker of ["bin", "web", "standalone.production.env", "SHA-256", "CycloneDX"]) {
    assert.match(packager, new RegExp(marker.replace(".", "\\.")));
  }
  assert.match(validator, /web\/pc\/index\.html/);
  assert.match(validator, /release SBOM is missing/);
});

test("Manager cloud browser target generates and validates its own SBOM evidence", () => {
  const workflow = JSON.parse(readFileSync(path.join(root, "agent.workflow.json"), "utf8"));
  const sbomScript = workflow.lifecycle.sbom.map((step) => step.run).join("\n");
  const validateScript = workflow.lifecycle.validate.map((step) => step.run).join("\n");
  const cloudTarget = workflow.targets.find(
    (target) => target.deploymentProfile === "cloud" && target.runtimeTarget === "browser",
  );
  const cloudSbom = readFileSync(path.join(root, "scripts/release/browser-release-sbom.mjs"), "utf8");
  const lifecycleRunner = readFileSync(
    path.join(root, "scripts/release/manager-release-lifecycle.mjs"),
    "utf8",
  );
  assert.match(sbomScript, /runManagerReleasePhase\('sbom'\)/);
  assert.match(validateScript, /runManagerReleasePhase\('validate'\)/);
  assert.match(lifecycleRunner, /runPnpm\("_sdkwork:release:validate:cloud"\)/);
  assert.match(cloudSbom, /SHA-256/);
  assert.ok(cloudTarget.outputGlobs.some((glob) => glob.includes("sdkwork-manager-pc/dist")));
  assert.ok(cloudTarget.outputGlobs.some((glob) => glob.endsWith(".sbom.json")));
});
