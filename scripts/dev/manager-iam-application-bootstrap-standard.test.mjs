import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  resolveManagerProfileEnv,
  resolveManagerRuntimeEnv,
} from "./manager-profile-env.mjs";
import { parseClientBind } from "./manager-dev.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const managerIamMenuPermissions = [
  "iam.users.read",
  "iam.tenants.read",
  "iam.organizations.read",
  "iam.roles.read",
  "iam.permissions.read",
  "iam.oauth.read",
  "iam.account_binding_policy.read",
  "iam.audit_events.read",
];

test("Manager standalone provisions IAM through its owner assembly before hosting routes", () => {
  const cargo = readFileSync(
    path.join(root, "crates/sdkwork-api-manager-standalone-gateway/Cargo.toml"),
    "utf8",
  );
  const main = readFileSync(
    path.join(root, "crates/sdkwork-api-manager-standalone-gateway/src/main.rs"),
    "utf8",
  );
  const appPackage = JSON.parse(readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/package.json"),
    "utf8",
  ));
  const devRunner = readFileSync(
    path.join(root, "scripts/dev/manager-dev.mjs"),
    "utf8",
  );
  const startRunner = readFileSync(
    path.join(root, "scripts/dev/manager-start.mjs"),
    "utf8",
  );
  assert.match(cargo, /sdkwork_api_manager_assembly\.workspace = true/);
  assert.match(cargo, /sdkwork_api_iam_assembly\.workspace = true/);
  assert.doesNotMatch(cargo, /sdkwork_iam_database_host\.workspace = true/);
  const bootstrapCallIndex = main.indexOf(
    "sdkwork_api_iam_assembly::assemble_owner_api_surfaces_with_pool",
  );
  const routeAssemblyIndex = main.indexOf("ComposedApiAssembly::try_compose");
  assert.ok(bootstrapCallIndex >= 0, "startup must invoke the IAM owner assembly");
  assert.ok(routeAssemblyIndex >= 0, "startup must compose complete owner contributions");
  assert.ok(
    bootstrapCallIndex < routeAssemblyIndex,
    "IAM application provisioning must finish before routes are hosted",
  );
  assert.match(main, /assemble_api_runtime_from_env/);
  assert.match(main, /\.into_hosted\(framework\)/);
  assert.doesNotMatch(main, /fetch\(|axios\.|INSERT\s+INTO/i);
  assert.equal(appPackage.scripts.dev, "pnpm dev:standalone");
  assert.match(appPackage.scripts["dev:standalone"], /sdkwork-app dev/);
  assert.match(appPackage.scripts["install:bootstrap"], /manager-bootstrap\.mjs/);
  const rootPackage = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  const topology = JSON.parse(readFileSync(
    path.join(root, "specs/topology.spec.json"),
    "utf8",
  ));
  const standaloneProcesses = topology.orchestration.profiles["standalone.development"].processes;
  assert.equal(rootPackage.scripts.start, "pnpm dev:standalone");
  assert.match(rootPackage.scripts["_sdkwork:gateway:standalone"], /manager-start\.mjs/);
  assert.match(rootPackage.scripts["_sdkwork:client:browser"], /manager-dev\.mjs/);
  assert.ok(standaloneProcesses.some(
    (process) => process.role === "api-standalone-gateway"
      && process.script === "_sdkwork:gateway:standalone",
  ));
  assert.ok(standaloneProcesses.some(
    (process) => process.role === "client"
      && process.script === "_sdkwork:client:browser",
  ));
  assert.match(devRunner, /resolveManagerRuntimeEnv/);
  assert.match(startRunner, /resolveManagerRuntimeEnv/);
  assert.doesNotMatch(startRunner, /portproxy/);
  assert.match(startRunner, /sdkwork-api-manager-standalone-gateway/);
  assert.match(devRunner, /@sdkwork\/app-topology\/network-access/);
  assert.match(devRunner, /application started successfully/);
  assert.doesNotMatch(devRunner, /sdkwork-api-manager-standalone-gateway/);
});

test("Manager standalone profile supplies the IAM and Manager CORS allowlists", () => {
  const profileEnv = resolveManagerProfileEnv({});

  assert.equal(profileEnv.SDKWORK_MANAGER_PROFILE_ID, "standalone.development");
  assert.equal(profileEnv.SDKWORK_ENVIRONMENT, "development");
  assert.equal(profileEnv.SDKWORK_MANAGER_APPLICATION_PUBLIC_INGRESS_BIND, "0.0.0.0:18092");
  assert.equal(profileEnv.SDKWORK_MANAGER_PC_DEV_BIND, "0.0.0.0:5190");
  assert.equal(profileEnv.SDKWORK_MANAGER_CORS_ALLOWED_ORIGINS, "http://127.0.0.1:5190");
  assert.equal(profileEnv.SDKWORK_CORS_ALLOWED_ORIGINS, "http://127.0.0.1:5190");
  assert.equal(profileEnv.SDKWORK_IAM_CORS_ALLOWED_ORIGINS, "http://127.0.0.1:5190");
  // platform.api-gateway URL keys are cloud-only; standalone dependency APIs
  // are embedded behind application.public-ingress (APP_RUNTIME_TOPOLOGY_SPEC section 7).
  assert.equal(profileEnv.SDKWORK_MANAGER_PLATFORM_API_GATEWAY_HTTP_URL, undefined);
  assert.equal(profileEnv.VITE_SDKWORK_MANAGER_PLATFORM_API_GATEWAY_HTTP_URL, undefined);
  assert.equal(profileEnv.SDKWORK_DATABASE_URL, undefined);
  assert.equal(profileEnv.SDKWORK_DATABASE_MAX_CONNECTIONS, undefined);
  assert.equal(profileEnv.SDKWORK_DATABASE_TEMPORARY_ANY_POOL_EXCEPTION, "true");
  assert.equal(profileEnv.SDKWORK_MANAGER_WSL_POSTGRES_PORTPROXY_ENABLED, "true");
});

test("Manager runtime environment preserves process overrides", () => {
  const runtimeEnv = resolveManagerRuntimeEnv({
    SDKWORK_DATABASE_HOST: "database.internal",
    SDKWORK_MANAGER_WSL_POSTGRES_PORTPROXY_ENABLED: "false",
  });

  assert.equal(runtimeEnv.SDKWORK_DATABASE_HOST, "database.internal");
  assert.equal(runtimeEnv.SDKWORK_MANAGER_WSL_POSTGRES_PORTPROXY_ENABLED, "false");
});

test("Manager PC development bind is explicit and validated", () => {
  assert.deepEqual(parseClientBind("0.0.0.0:5190"), {
    host: "0.0.0.0",
    port: 5190,
  });
  assert.throws(
    () => parseClientBind("0.0.0.0:not-a-port"),
    /Invalid SDKWORK_MANAGER_PC_DEV_BIND/,
  );
});

test("WSL PostgreSQL proxy lifecycle is declared through the topology framework", () => {
  const topology = JSON.parse(readFileSync(path.join(root, "specs/topology.spec.json"), "utf8"));
  const profile = topology.orchestration.profiles["standalone.development"];
  assert.deepEqual(profile.managedResources, [{
    id: "manager-wsl-postgres-portproxy",
    driver: "windows-wsl-tcp-portproxy",
    enabledEnv: "SDKWORK_MANAGER_WSL_POSTGRES_PORTPROXY_ENABLED",
    listenAddressEnv: "SDKWORK_DATABASE_HOST",
    listenAddress: "127.0.0.1",
    listenPortEnv: "SDKWORK_DATABASE_PORT",
    listenPort: 5432,
    distributionEnv: "SDKWORK_MANAGER_WSL_DISTRIBUTION",
    distribution: "Ubuntu-22.04",
  }]);
  assert.equal(
    profile.processes.find((process) => process.id === "manager-pc-browser").bindEnv,
    "SDKWORK_MANAGER_PC_DEV_BIND",
  );
});

test("Manager manifests use the PC runtime app id required by IAM login", () => {
  for (const manifestPath of [
    "agent.app.config.json",
    "apps/sdkwork-manager-pc/agent.app.config.json",
  ]) {
    const manifest = JSON.parse(readFileSync(path.join(root, manifestPath), "utf8"));
    assert.equal(manifest.backend.appId, "sdkwork-manager-pc");
    for (const permission of managerIamMenuPermissions) {
      assert.ok(
        manifest.backend.accessTokenPermissionScope.includes(permission),
        `${manifestPath} must request ${permission} for the registered IAM menu`,
      );
    }
  }
});
