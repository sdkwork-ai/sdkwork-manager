import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

test("workspace declares sdkwork-web-framework and sdkwork-database deps", () => {
  const cargo = readFileSync(path.join(root, "Cargo.toml"), "utf8");
  assert.match(cargo, /sdkwork-web-core/);
  assert.match(cargo, /sdkwork-web-axum/);
  assert.match(cargo, /sdkwork-database-config/);
  assert.match(cargo, /sdkwork-database-lifecycle/);
  assert.doesNotMatch(cargo, /sdkwork-discovery/);
});

test("tsconfig wires sdkwork drive paths", () => {
  const tsconfig = JSON.parse(readFileSync(path.join(root, "tsconfig.base.json"), "utf8"));
  assert.ok(tsconfig.compilerOptions.paths["sdkwork-drive-pc-core"]);
  assert.ok(tsconfig.compilerOptions.paths["sdkwork-drive-pc-commons"]);
});

test("component spec declares platform manager capability", () => {
  const spec = JSON.parse(readFileSync(path.join(root, "specs/component.spec.json"), "utf8"));
  assert.equal(spec.component.domain, "platform");
  assert.equal(spec.component.capability, "manager");
});

test("package scripts expose the shared SDKWork application lifecycle", () => {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  for (const script of [
    "dev",
    "dev:standalone",
    "dev:cloud",
    "start",
    "stop",
    "build",
    "test",
    "check",
    "verify",
    "clean",
  ]) {
    assert.ok(pkg.scripts[script], `missing script: ${script}`);
  }
  assert.equal(pkg.scripts.dev, "pnpm dev:standalone");
  assert.equal(pkg.scripts.start, "pnpm dev:standalone");
  assert.match(pkg.scripts["dev:standalone"], /sdkwork-app dev --deployment-profile standalone/);
  assert.match(pkg.scripts["dev:cloud"], /sdkwork-app dev --deployment-profile cloud/);
  assert.equal(pkg.scripts["_sdkwork:stop"], undefined);
});

test("vite config declares no @sdkwork package aliases", () => {
  const viteConfig = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/vite.config.ts"),
    "utf8",
  );
  // Package imports resolve through pnpm workspace links and package exports
  // maps (APP_PC_ARCHITECTURE_SPEC.md section 2.0.1); vite.config must not
  // restate the workspace dependency graph.
  assert.doesNotMatch(viteConfig, /["']@sdkwork\/[^"']+["']\s*:/);
  assert.doesNotMatch(viteConfig, /sdkwork-manager-app-sdk-generated-typescript/);
});

test("Manager Vite uses the IAM development credential-entry bootstrap only outside production", () => {
  const appPackage = JSON.parse(readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/package.json"),
    "utf8",
  ));
  const viteConfig = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/vite.config.ts"),
    "utf8",
  );
  const devRunner = readFileSync(
    path.join(root, "scripts/dev/manager-dev.mjs"),
    "utf8",
  );
  const baseEnvTemplate = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/.env.example"),
    "utf8",
  );
  const developmentEnvTemplate = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/.env.standalone.development.example"),
    "utf8",
  );
  const productionEnvTemplate = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/.env.standalone.production.example"),
    "utf8",
  );

  assert.equal(appPackage.scripts.dev, "pnpm dev:standalone");
  assert.match(appPackage.scripts["dev:standalone"], /sdkwork-app dev/);
  assert.match(devRunner, /mergeRepoDevBootstrapAccessTokenEnv/);
  assert.match(devRunner, /apps\/sdkwork-manager-pc\/agent\.app\.config\.json/);
  assert.match(devRunner, /@sdkwork\/app-topology\/network-access/);
  assert.match(devRunner, /waitForClient/);
  assert.match(devRunner, /application started successfully/);
  assert.doesNotMatch(devRunner, /sdkwork-api-manager-standalone-gateway/);
  assert.match(viteConfig, /sdkwork-iam-credential-entry\/src\/vite\.ts/);
  assert.match(viteConfig, /createSdkworkCredentialEntryBootstrapVitePlugin/);
  assert.match(viteConfig, /process\.env\.SDKWORK_ACCESS_TOKEN/);
  assert.doesNotMatch(viteConfig, /transformIndexHtml/);
  assert.doesNotMatch(viteConfig, /serializeCredentialEntryBootstrapForInlineScript/);
  assert.doesNotMatch(viteConfig, /globalThis\.process/);
  assert.doesNotMatch(viteConfig, /VITE_ACCESS_TOKEN/);
  assert.match(baseEnvTemplate, /^SDKWORK_ACCESS_TOKEN=$/mu);
  assert.match(developmentEnvTemplate, /^SDKWORK_ACCESS_TOKEN=$/mu);
  assert.doesNotMatch(productionEnvTemplate, /^SDKWORK_ACCESS_TOKEN=/mu);
});

test("Manager delegates IAM application provisioning to the shared bootstrap framework", () => {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));

  assert.equal(pkg.devDependencies["@sdkwork/iam-application-bootstrap"], "workspace:*");
  assert.match(pkg.scripts["admin:bootstrap:app"], /sdkwork-iam\/scripts\/bootstrap\/bootstrap-app\.mjs/);
});

test("Manager standalone composes IAM through the dependency owner assembly", () => {
  const assemblyCargo = readFileSync(
    path.join(root, "crates/sdkwork-api-manager-assembly/Cargo.toml"),
    "utf8",
  );
  const assembly = readFileSync(
    path.join(root, "crates/sdkwork-api-manager-assembly/src/bootstrap.rs"),
    "utf8",
  );
  const standaloneCargo = readFileSync(
    path.join(root, "crates/sdkwork-api-manager-standalone-gateway/Cargo.toml"),
    "utf8",
  );
  const standalone = readFileSync(
    path.join(root, "crates/sdkwork-api-manager-standalone-gateway/src/main.rs"),
    "utf8",
  );
  const iamAssembly = readFileSync(
    path.join(root, "../sdkwork-iam/crates/sdkwork-api-iam-assembly/src/bootstrap.rs"),
    "utf8",
  );

  assert.doesNotMatch(assemblyCargo, /sdkwork_api_iam_assembly\.workspace = true/);
  assert.doesNotMatch(assembly, /sdkwork_api_iam_assembly/);
  assert.match(standaloneCargo, /sdkwork_api_iam_assembly\.workspace = true/);
  assert.match(standalone, /sdkwork_api_iam_assembly::assemble_owner_api_surfaces_with_pool/);
  assert.match(standalone, /ComposedApiAssembly::try_compose/);
  assert.match(standalone, /\.into_hosted\(framework\)/);
  assert.match(
    iamAssembly,
    /sdkwork_routes_iam_app_api::build_sdkwork_iam_app_api_business_router_with_initialized_pool/,
  );
  assert.match(
    iamAssembly,
    /sdkwork_routes_iam_backend_api::build_sdkwork_iam_backend_api_business_router_with_pool/,
  );
});

test("Manager standalone assembly mounts every backend-admin dependency behind its own ingress", () => {
  const cargo = readFileSync(
    path.join(root, "crates/sdkwork-api-manager-standalone-gateway/Cargo.toml"),
    "utf8",
  );
  const standalone = readFileSync(
    path.join(root, "crates/sdkwork-api-manager-standalone-gateway/src/main.rs"),
    "utf8",
  );
  const standaloneProfile = Object.fromEntries(
    readFileSync(path.join(root, "etc/topology/standalone.development.env"), "utf8")
      .split(/\r?\n/u)
      .filter((line) => line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );

  for (const dependency of ["drive", "order", "promotion", "payment", "membership"]) {
    assert.match(cargo, new RegExp(`sdkwork_api_${dependency}_assembly\\.workspace = true`));
    assert.match(
      standalone,
      new RegExp(`sdkwork_api_${dependency}_assembly::assemble_api_router`),
    );
  }
  assert.doesNotMatch(standalone, /\.router\s*[,)];/);
  assert.match(standalone, /ComposedApiAssembly::try_compose/);
  assert.match(standalone, /\.into_hosted\(framework\)/);
  // platform.api-gateway URL keys are cloud-only; standalone embeds dependency
  // APIs behind application.public-ingress (APP_RUNTIME_TOPOLOGY_SPEC section 7).
  assert.equal(standaloneProfile.SDKWORK_MANAGER_PLATFORM_API_GATEWAY_HTTP_URL, undefined);
  assert.equal(standaloneProfile.VITE_SDKWORK_MANAGER_PLATFORM_API_GATEWAY_HTTP_URL, undefined);
  assert.equal(
    standaloneProfile.SDKWORK_ENVIRONMENT,
    standaloneProfile.SDKWORK_MANAGER_ENVIRONMENT,
  );
  assert.equal(
    standaloneProfile.SDKWORK_CORS_ALLOWED_ORIGINS,
    standaloneProfile.SDKWORK_MANAGER_CORS_ALLOWED_ORIGINS,
  );
});

test("Manager cloud profiles consume platform API surfaces without owning the cloud gateway", () => {
  const topology = JSON.parse(readFileSync(
    path.join(root, "specs/topology.spec.json"),
    "utf8",
  ));
  const cloudDevelopment = topology.orchestration.profiles["cloud.development"];
  const cloudProduction = topology.orchestration.profiles["cloud.production"];

  assert.ok(cloudDevelopment.processes.every((process) => process.role === "client"));
  assert.deepEqual(cloudProduction.processes, []);
  assert.equal(topology.packaging.cloudConfigFiles, undefined);
  assert.ok(topology.packaging.targets.every(
    (target) => !target.id.includes("cloud-container-config-bundle"),
  ));
});

test("Manager browser has no Vite API proxy and IAM SDKs use application ingress", () => {
  const viteConfig = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/vite.config.ts"),
    "utf8",
  );
  const manifest = JSON.parse(readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/agent.app.config.json"),
    "utf8",
  ));
  const component = JSON.parse(readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/specs/component.spec.json"),
    "utf8",
  ));
  const standaloneEnv = readFileSync(
    path.join(root, "etc/topology/standalone.development.env"),
    "utf8",
  );
  const sdkWorkspaces = component.contracts.sdkDependencies.map(
    (dependency) => dependency.workspace,
  );

  assert.doesNotMatch(viteConfig, /server:\s*\{[^}]*proxy:/s);
  assert.doesNotMatch(viteConfig, /buildManagerViteDevProxy|viteDevProxy/);
  assert.equal(manifest.envBindings, undefined);
  assert.equal(manifest.metadata.deploymentConfig, "etc/sdkwork.deployment.config.json");
  assert.ok(sdkWorkspaces.includes("sdkwork-iam-app-sdk"));
  assert.ok(sdkWorkspaces.includes("sdkwork-iam-backend-sdk"));
  assert.match(
    standaloneEnv,
    /^VITE_SDKWORK_MANAGER_APPLICATION_PUBLIC_HTTP_URL=http:\/\/127\.0\.0\.1:18092$/mu,
  );
  // The standalone profile must not carry the cloud-only platform gateway key.
  assert.doesNotMatch(standaloneEnv, /VITE_SDKWORK_MANAGER_PLATFORM_API_GATEWAY_HTTP_URL/u);
});

test("Manager default IAM grants exclude payment development operations", () => {
  for (const manifestPath of [
    "agent.app.config.json",
    "apps/sdkwork-manager-pc/agent.app.config.json",
  ]) {
    const manifest = JSON.parse(readFileSync(path.join(root, manifestPath), "utf8"));
    const permissions = manifest.backend.accessTokenPermissionScope;
    assert.ok(Array.isArray(permissions));
    assert.ok(permissions.every((permission) => !permission.startsWith("commerce.payments.dev.")));
    assert.ok(permissions.every((permission) => !permission.startsWith("commerce.payments.certificates.")));
  }
});

test("Payment development workspace is guarded by the production build constant", () => {
  const paymentContribution = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-payment/src/index.tsx"),
    "utf8",
  );

  assert.match(paymentContribution, /!import\.meta\.env\.PROD/);
  assert.match(paymentContribution, /environment !== "production"/);
  assert.match(paymentContribution, /import\("@sdkwork\/payment-pc-admin-devconfig"\)/);
});

test("Payment and Order mutation controls use exact IAM capability mappings", () => {
  const paymentContribution = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-payment/src/index.tsx"),
    "utf8",
  );
  const tradeContribution = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-trade/src/index.tsx"),
    "utf8",
  );
  for (const permission of [
    "commerce.payments.webhook_events.replay",
    "commerce.payments.reconciliation_runs.create",
    "commerce.payments.provider_accounts.create",
    "commerce.payments.provider_accounts.update",
    "commerce.payments.provider_accounts.test",
    "commerce.payments.provider_accounts.credentials.rotate",
    "commerce.payments.sub_merchants.create",
    "commerce.payments.sub_merchants.update",
    "commerce.payments.sub_merchants.delete",
    "commerce.payments.methods.create",
    "commerce.payments.methods.update",
    "commerce.payments.channels.create",
    "commerce.payments.route_rules.create",
    "commerce.payments.route_rules.update",
    "commerce.payments.route_rules.delete",
  ]) {
    assert.match(paymentContribution, new RegExp(permission.replaceAll(".", "\\.")));
  }
  assert.match(tradeContribution, /hasManagerPermission\("commerce\.orders\.manage"\)/);
  assert.doesNotMatch(
    tradeContribution,
    /getManagerPermissionScope\(\)\.includes\("commerce\.orders\.manage"\)/,
  );
});

test("Manager operation controls use wildcard-aware IAM permission checks", () => {
  for (const relativePath of [
    "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-customer/src/index.tsx",
    "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-marketing/src/index.tsx",
    "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-membership/src/index.tsx",
    "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-payment/src/index.tsx",
    "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-trade/src/index.tsx",
  ]) {
    const contribution = readFileSync(path.join(root, relativePath), "utf8");
    assert.doesNotMatch(contribution, /getManagerPermissionScope\(\)\.includes\(/);
  }

  const iamContribution = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-iam/src/index.tsx"),
    "utf8",
  );
  assert.match(iamContribution, /hasAdminScopePermission/);
  assert.doesNotMatch(iamContribution, /permissionScope\.includes\(/);
});

test("Manager IAM permission catalogs remain route-lazy", () => {
  const iamContribution = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-iam/src/index.tsx"),
    "utf8",
  );

  assert.match(iamContribution, /import\("@sdkwork\/iam-pc-admin-permission"\)/);
  assert.match(iamContribution, /import\("\.\/authorization\/IamCatalogWorkspace"\)/);
  assert.doesNotMatch(
    iamContribution,
    /from\s+["']@sdkwork\/iam-pc-admin-permission["']/,
  );
  assert.doesNotMatch(
    iamContribution,
    /from\s+["']\.\/authorization\/IamCatalogWorkspace["']/,
  );
});

test("Manager IAM OAuth operations remain route-lazy", () => {
  const iamContribution = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-iam/src/index.tsx"),
    "utf8",
  );

  assert.match(iamContribution, /import\("\.\/oauth\/IamOauthAccountWorkspace"\)/);
  assert.match(iamContribution, /import\("\.\/services\/oauthAccountController"\)/);
  assert.doesNotMatch(
    iamContribution,
    /from\s+["']\.\/oauth\/IamOauthAccountWorkspace["']/,
  );
  assert.doesNotMatch(
    iamContribution,
    /from\s+["']\.\/services\/oauthAccountController["']/,
  );
});

test("commercial modules declare sellable metadata without blocking Manager login", () => {
  const tierContracts = new Map([
    ["apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-iam/src/index.tsx", "standard"],
    ["apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-customer/src/index.tsx", "standard"],
    ["apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-trade/src/index.tsx", "standard"],
    ["apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-drive/src/index.tsx", "professional"],
    ["apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-marketing/src/index.tsx", "professional"],
    ["apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-membership/src/index.tsx", "professional"],
    ["apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-payment/src/index.tsx", "enterprise"],
  ]);
  for (const [relativePath, tier] of tierContracts) {
    const contribution = readFileSync(path.join(root, relativePath), "utf8");
    assert.match(contribution, new RegExp(`tier: "${tier}"`));
  }

  const shell = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-shell/src/index.tsx"),
    "utf8",
  );
  const main = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/src/main.tsx"),
    "utf8",
  );
  const adminSdk = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-admin-core/src/sdk/index.ts"),
    "utf8",
  );
  assert.match(adminSdk, /@sdkwork\/manager-backend-sdk/);
  assert.doesNotMatch(shell, /commercialEntitlement|entitlementState|loadCommercialEntitlementSnapshot/);
  assert.doesNotMatch(main, /loadManagerCommercialEntitlementSnapshot/);
  assert.doesNotMatch(adminSdk, /commercialEntitlements\.current\.retrieve/);
});

test("commercial entitlement routes bind read, manage, and enforcement permissions", () => {
  const manifest = readFileSync(
    path.join(root, "crates/sdkwork-routes-manager-backend-api/src/http_route_manifest.rs"),
    "utf8",
  );
  for (const permission of [
    "manager.entitlements.read",
    "manager.entitlements.manage",
    "manager.entitlements.enforce",
  ]) {
    assert.match(manifest, new RegExp(`with_required_permission\\("${permission.replaceAll(".", "\\.")}\\"`));
  }
});

test("Manager Web Framework is the single CORS policy authority", () => {
  const gateway = readFileSync(
    path.join(root, "crates/sdkwork-api-manager-standalone-gateway/src/main.rs"),
    "utf8",
  );
  assert.doesNotMatch(gateway, /application_cors_layer_from_env|CorsLayer/);

  for (const relativePath of [
    "crates/sdkwork-routes-manager-app-api/src/web_bootstrap.rs",
    "crates/sdkwork-routes-manager-backend-api/src/web_bootstrap.rs",
  ]) {
    const bootstrap = readFileSync(path.join(root, relativePath), "utf8");
    assert.match(bootstrap, /application_security_policy_from_env/);
    assert.match(bootstrap, /with_security_policy\(security_policy\)/);
    assert.match(bootstrap, /environment,/);
  }
});

test("Manager Backend SDK publishes the Rust entitlement enforcement transport", () => {
  const familyRoot = path.join(root, "sdks/sdkwork-manager-backend-sdk");
  const manifest = JSON.parse(readFileSync(path.join(familyRoot, "sdk-manifest.json"), "utf8"));
  const rustLanguage = manifest.languages.find((entry) => entry.language === "rust");
  assert.equal(rustLanguage?.name, "sdkwork-manager-backend-sdk");
  assert.equal(
    rustLanguage?.generatedPath,
    "sdkwork-manager-backend-sdk-rust/generated/server-openapi",
  );

  const rustRoot = path.join(familyRoot, rustLanguage.generatedPath);
  const cargoManifest = readFileSync(path.join(rustRoot, "Cargo.toml"), "utf8");
  const managerApi = readFileSync(path.join(rustRoot, "src/api/manager.rs"), "utf8");
  const generator = readFileSync(path.join(root, "tools/manager_sdk_generate.mjs"), "utf8");
  assert.match(cargoManifest, /name = "sdkwork-manager-backend-sdk-generated-rust"/);
  assert.match(managerApi, /commercial_entitlements_verify/);
  assert.match(generator, /languages: \["typescript", "rust"\]/);
  assert.match(generator, /sdkgen failed for \$\{family\.familyName\} \(\$\{language\}\)/);
});

test("verify pipeline includes governance, complete frontend tests, production build, and gateway validation", () => {
  const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.match(pkg.scripts.check, /sdkwork-app check/);
  assert.match(pkg.scripts.verify, /sdkwork-app verify/);
  assert.match(pkg.scripts["_sdkwork:check"], /check:governance/);
  assert.match(pkg.scripts["_sdkwork:verify"], /test:node/);
  assert.match(pkg.scripts["_sdkwork:verify"], /test:vitest/);
  assert.match(pkg.scripts["_sdkwork:verify"], /pnpm build/);
  assert.match(pkg.scripts["_sdkwork:verify"], /api:assembly:validate/);
  assert.match(pkg.scripts["sdk:check"], /sdk:rust:check/);
});

test("launch readiness runbook documents IAM bootstrap via sdkwork-iam", () => {
  const runbook = readFileSync(path.join(root, "docs/runbooks/LAUNCH_READINESS.md"), "utf8");
  const docsIndex = readFileSync(path.join(root, "docs/INDEX.yaml"), "utf8");
  assert.match(runbook, /--appbase-root sdkwork-iam/);
  assert.match(runbook, /bootstrap-all-apps\.mjs --filter sdkwork-manager/);
  assert.match(docsIndex, /launchReadiness: docs\/runbooks\/LAUNCH_READINESS\.md/);
});

test("IAM login route renders one IAM surface inside the standard manager auth frame", () => {
  const authRoutes = readFileSync(
    path.join(
      root,
      "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-shell/src/auth/ManagerAuthRoutes.tsx",
    ),
    "utf8",
  );

  assert.match(authRoutes, /<SdkworkIamAuthRoutes/);
  assert.match(authRoutes, /<ManagerAuthShell>/);
  assert.match(authRoutes, /viewportMode="flow"/);
  assert.match(authRoutes, /authRuntime\.status !== "ready"/);
  assert.match(authRoutes, /manager-auth-routes !bg-transparent/);
});

test("manager IAM surface defines the complete branded auth token set", () => {
  const authStyles = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/src/index.css"),
    "utf8",
  );

  for (const token of [
    "--sdkwork-auth-primary-button-background-color",
    "--sdkwork-auth-action-button-text-color",
    "--sdkwork-auth-field-background-color",
    "--sdkwork-auth-tab-active-background-color",
    "--sdkwork-auth-tab-active-icon-color",
    "--sdkwork-auth-validation-message-color",
  ]) {
    assert.match(authStyles, new RegExp(token));
  }
});

test("Manager auth host keeps the CloudRouter PC geometry while using IAM-owned routes", () => {
  const authShell = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-shell/src/auth/ManagerAuthShell.tsx"),
    "utf8",
  );
  const authStyles = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/src/index.css"),
    "utf8",
  );

  assert.match(authShell, /sdkwork-manager-auth-host/);
  assert.match(authShell, /sdkwork-manager-auth-main/);
  assert.match(authShell, /sdkwork-manager-auth-active/);
  assert.match(authStyles, /height: 100dvh/);
  assert.match(authStyles, /position: fixed/);
  assert.match(authStyles, /overflow-y: auto/);
  assert.match(authStyles, /--manager-auth-brand:\s*#[0-9a-f]{6}/i);
  assert.match(
    authStyles,
    /--sdkwork-auth-primary-button-background-color:\s*var\(--manager-auth-brand\)/,
  );
  assert.match(authStyles, /\.sdkwork-manager-auth-main/);
  assert.match(authStyles, /letter-spacing: 0\.16em/);
  assert.match(
    authStyles,
    /\.sdkwork-manager-auth-host input\[data-sdk-ui="input"\]\.pl-10\s*\{[^}]*padding-left: 2\.5rem;/s,
  );
});

test("Manager Tailwind source closure includes the IAM auth layout utilities", () => {
  const authStyles = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/src/index.css"),
    "utf8",
  );
  const cssRoot = path.join(root, "apps/sdkwork-manager-pc/src");
  const sourceRoots = [...authStyles.matchAll(/@source\s+["']([^"']+)["']\s*;/g)]
    .map((match) => match[1]);

  assert.ok(
    sourceRoots.includes("../../../../sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src"),
    "the host must scan the IAM auth component source tree",
  );
  for (const sourceRoot of sourceRoots) {
    assert.ok(
      existsSync(path.resolve(cssRoot, sourceRoot)),
      `Tailwind source root must resolve from the Manager shell: ${sourceRoot}`,
    );
  }
});

test("session-expired login modal is scoped to protected manager routes", () => {
  const appShell = readFileSync(
    path.join(root, "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-shell/src/index.tsx"),
    "utf8",
  );

  const protectedAreaStart = appShell.indexOf("function ProtectedAdminArea");
  const appStart = appShell.indexOf("export function ManagerPcApp");
  assert.ok(protectedAreaStart >= 0, "protected area must own the session auth provider");
  assert.ok(appStart > protectedAreaStart, "protected area must be declared before the app route tree");
  assert.match(
    appShell.slice(protectedAreaStart, appStart),
    /<SdkworkSessionAuthBrowserRoot[\s\S]*<RequireOperatorSession>/,
  );
  assert.doesNotMatch(
    appShell.slice(appStart),
    /<SdkworkSessionAuthBrowserRoot/,
  );
});
