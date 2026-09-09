import { isBlank } from "@sdkwork/utils";

import {
  DEFAULT_LOCAL_APPLICATION_PUBLIC_HTTP_URL,
  DEFAULT_LOCAL_PLATFORM_API_GATEWAY_HTTP_URL,
  MANAGER_APP_API_SEGMENT,
  SDKWORK_APP_API_PREFIX,
  SDKWORK_BACKEND_API_PREFIX,
  VITE_SDKWORK_MANAGER_APPLICATION_PUBLIC_HTTP_URL,
  VITE_SDKWORK_MANAGER_DEPLOYMENT_PROFILE,
  VITE_SDKWORK_MANAGER_ENVIRONMENT,
  VITE_SDKWORK_MANAGER_PLATFORM_API_GATEWAY_HTTP_URL,
} from "./topologyEnvKeys";

export type ClientRuntimeEnv = Record<string, string | boolean | undefined> & {
  DEV?: boolean | "true" | "false";
};

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

type RuntimeImportMetaEnv = ClientRuntimeEnv;

function readRuntimeImportMetaEnv(
  env: ClientRuntimeEnv = typeof import.meta !== "undefined"
    ? (import.meta as ImportMeta & { env: ClientRuntimeEnv }).env
    : {},
): RuntimeImportMetaEnv {
  return env;
}

export function readSdkBaseUrlEnvValue(
  key: string,
  env: ClientRuntimeEnv = readRuntimeImportMetaEnv(),
): string | undefined {
  const value = env[key];
  return typeof value === "string" && !isBlank(value) ? value.trim() : undefined;
}

function stripSdkOwnedPathSuffix(pathname: string, suffixes: string[]): string {
  const normalizedPathname = pathname.replace(/\/+$/u, "");
  if (!normalizedPathname || normalizedPathname === "/") {
    return "";
  }

  for (const suffix of suffixes) {
    const normalizedSuffix = `/${suffix.replace(/^\/+|\/+$/gu, "")}`;
    if (normalizedPathname === normalizedSuffix) {
      return "";
    }
    if (normalizedPathname.endsWith(normalizedSuffix)) {
      return normalizedPathname.slice(0, -normalizedSuffix.length) || "";
    }
  }

  return normalizedPathname;
}

export function normalizeHttpSdkBaseUrl(
  value: string,
  sdkOwnedPathSuffixes: string[] = [SDKWORK_APP_API_PREFIX, SDKWORK_BACKEND_API_PREFIX],
): string {
  try {
    const parsedUrl = new URL(value);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return value;
    }
    const normalizedPathname = stripSdkOwnedPathSuffix(parsedUrl.pathname, sdkOwnedPathSuffixes);
    return `${parsedUrl.origin}${normalizedPathname}`;
  } catch {
    return value;
  }
}

/**
 * ENVIRONMENT_SPEC §6.3 protocol adaptation: the serving edge terminates HTTP
 * and HTTPS on the same API host, so a browser-resolved base origin MUST use
 * the page scheme — an http:// page targets the http:// origin (a TLS-less dev
 * edge closes https:// connections) and an https:// page targets https://
 * (mixed-content blocks). Server/native runtimes keep the authored scheme.
 */
function alignBrowserBaseUrlPageProtocol(value: string): string {
  if (typeof window === "undefined") {
    return value;
  }
  try {
    const parsedUrl = new URL(value);
    const pageProtocol = window.location.protocol;
    if (
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:")
      && (pageProtocol === "http:" || pageProtocol === "https:")
      && parsedUrl.protocol !== pageProtocol
    ) {
      parsedUrl.protocol = pageProtocol;
      return parsedUrl.toString().replace(/\/$/u, "");
    }
  } catch {
    // Keep the raw value for the existing downstream validation path.
  }
  return value;
}

export function resolveManagerApplicationBaseUrl(
  explicit?: string,
  env: ClientRuntimeEnv = readRuntimeImportMetaEnv(),
  browserHostname: string | undefined = typeof globalThis.location === "undefined"
    ? undefined
    : globalThis.location.hostname,
): string {
  const candidate =
    explicit ??
    readSdkBaseUrlEnvValue(VITE_SDKWORK_MANAGER_APPLICATION_PUBLIC_HTTP_URL, env) ??
    DEFAULT_LOCAL_APPLICATION_PUBLIC_HTTP_URL;
  if (isBlank(candidate)) {
    return DEFAULT_LOCAL_APPLICATION_PUBLIC_HTTP_URL;
  }
  const normalizedCandidate = normalizeHttpSdkBaseUrl(candidate.replace(/\/+$/u, ""));
  if (
    explicit
    || (env.DEV !== true && env.DEV !== "true")
    || resolveManagerDeploymentProfile(env) !== "standalone"
    || !browserHostname
    || LOOPBACK_HOSTNAMES.has(browserHostname.toLowerCase())
  ) {
    return alignBrowserBaseUrlPageProtocol(normalizedCandidate);
  }
  try {
    const parsed = new URL(normalizedCandidate);
    if (!LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
      return alignBrowserBaseUrlPageProtocol(normalizedCandidate);
    }
    parsed.hostname = browserHostname;
    return alignBrowserBaseUrlPageProtocol(normalizeHttpSdkBaseUrl(parsed.toString()));
  } catch {
    return alignBrowserBaseUrlPageProtocol(normalizedCandidate);
  }
}

export function resolvePlatformApiGatewayBaseUrl(
  explicit?: string,
  env: ClientRuntimeEnv = readRuntimeImportMetaEnv(),
): string {
  if (resolveManagerDeploymentProfile(env) === "standalone") {
    return resolveManagerApplicationBaseUrl(undefined, env);
  }
  const candidate =
    explicit ??
    readSdkBaseUrlEnvValue(VITE_SDKWORK_MANAGER_PLATFORM_API_GATEWAY_HTTP_URL, env) ??
    DEFAULT_LOCAL_PLATFORM_API_GATEWAY_HTTP_URL;
  if (isBlank(candidate)) {
    return DEFAULT_LOCAL_PLATFORM_API_GATEWAY_HTTP_URL;
  }
  return alignBrowserBaseUrlPageProtocol(normalizeHttpSdkBaseUrl(candidate.replace(/\/+$/u, "")));
}

function resolveManagerIamBaseUrl(
  explicit?: string,
  env: ClientRuntimeEnv = readRuntimeImportMetaEnv(),
): string {
  return resolveManagerApplicationBaseUrl(explicit, env);
}

export function resolveIamAppApiBaseUrl(
  explicit?: string,
  env: ClientRuntimeEnv = readRuntimeImportMetaEnv(),
): string {
  return resolveManagerIamBaseUrl(explicit, env);
}

export function resolveIamBackendApiBaseUrl(
  explicit?: string,
  env: ClientRuntimeEnv = readRuntimeImportMetaEnv(),
): string {
  return resolveManagerIamBaseUrl(explicit, env);
}

export function resolveManagerBackendApiBaseUrl(
  explicit?: string,
  env: ClientRuntimeEnv = readRuntimeImportMetaEnv(),
): string {
  return resolveManagerApplicationBaseUrl(explicit, env);
}

export function resolveManagerAppApiBaseUrl(
  explicit?: string,
  env: ClientRuntimeEnv = readRuntimeImportMetaEnv(),
): string {
  return resolveManagerApplicationBaseUrl(explicit, env);
}

export function resolveManagerApiBaseUrl(
  explicit?: string,
  env: ClientRuntimeEnv = readRuntimeImportMetaEnv(),
): string {
  return resolveManagerApplicationBaseUrl(explicit, env);
}

export type ClientPlatform = "pc" | "h5" | "flutter-web";

export type ManagerEnvironment = "development" | "test" | "staging" | "production";
export type ManagerDeploymentProfile = "standalone" | "cloud";

export function resolveManagerEnvironment(
  env: ClientRuntimeEnv = readRuntimeImportMetaEnv(),
): ManagerEnvironment {
  const value = readSdkBaseUrlEnvValue(VITE_SDKWORK_MANAGER_ENVIRONMENT, env)?.toLowerCase();
  if (value === "test" || value === "staging" || value === "production") {
    return value;
  }
  return "development";
}

export function resolveManagerDeploymentProfile(
  env: ClientRuntimeEnv = readRuntimeImportMetaEnv(),
): ManagerDeploymentProfile {
  return readSdkBaseUrlEnvValue(VITE_SDKWORK_MANAGER_DEPLOYMENT_PROFILE, env)?.toLowerCase()
    === "standalone"
    ? "standalone"
    : "cloud";
}

export function managerAppApiPathSegment(): string {
  return MANAGER_APP_API_SEGMENT;
}
