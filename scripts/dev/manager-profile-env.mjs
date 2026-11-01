import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const deploymentIndexPath = path.join(workspaceRoot, "etc", "sdkwork.deployment.config.json");
const localPostgresEnvPath = path.join(workspaceRoot, "config/host/postgres.env");

function parseEnvFile(filePath) {
  return Object.fromEntries(
    readFileSync(filePath, "utf8")
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
      }),
  );
}

export function resolveManagerProfileEnv(environment = process.env) {
  const deploymentIndex = JSON.parse(readFileSync(deploymentIndexPath, "utf8"));
  const inferredProfileId = [
    environment.SDKWORK_MANAGER_DEPLOYMENT_PROFILE,
    environment.SDKWORK_MANAGER_ENVIRONMENT,
  ].filter(Boolean).join(".");
  const profileId = environment.SDKWORK_MANAGER_PROFILE_ID
    || inferredProfileId
    || deploymentIndex.defaultProfile;
  const selectedProfileId = deploymentIndex.profiles[profileId]
    ? profileId
    : deploymentIndex.defaultProfile;
  const profile = deploymentIndex.profiles[selectedProfileId];
  if (!profile?.config) {
    throw new Error(`Manager deployment profile is not configured: ${selectedProfileId}`);
  }
  const profilePath = path.resolve(path.dirname(deploymentIndexPath), profile.config);
  if (!existsSync(profilePath)) {
    throw new Error(`Manager deployment profile file does not exist: ${profilePath}`);
  }
  return parseEnvFile(profilePath);
}

export function resolveManagerRuntimeEnv(environment = process.env) {
  const localPostgresEnv = existsSync(localPostgresEnvPath)
    ? parseEnvFile(localPostgresEnvPath)
    : {};
  return {
    ...resolveManagerProfileEnv(environment),
    ...localPostgresEnv,
    ...environment,
  };
}
