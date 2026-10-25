#!/usr/bin/env node

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { formatNetworkAccessLines } from "@sdkwork/app-topology/network-access";

import { mergeRepoDevBootstrapAccessTokenEnv } from "../../../sdkwork-iam/scripts/dev/create-dev-bootstrap-access-token-env.mjs";
import { resolveManagerRuntimeEnv } from "./manager-profile-env.mjs";

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const appRoot = path.join(workspaceRoot, "apps", "sdkwork-manager-pc");
const defaultClientBind = "0.0.0.0:5190";

export function parseClientBind(value = defaultClientBind) {
  const normalized = String(value ?? "").trim();
  const separator = normalized.lastIndexOf(":");
  const host = normalized.slice(0, separator).trim();
  const port = Number.parseInt(normalized.slice(separator + 1), 10);
  if (!host || !Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid SDKWORK_MANAGER_PC_DEV_BIND: ${normalized}`);
  }
  return { host, port };
}

async function waitForClient(origin, client) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (client.exitCode !== null) {
      throw new Error(`Manager PC client exited with code ${client.exitCode}`);
    }
    try {
      const response = await fetch(origin, { signal: AbortSignal.timeout(1_000) });
      if (response.status < 500) {
        return;
      }
    } catch {
      // Vite may still be compiling the initial dependency graph.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Manager PC client did not become ready at ${origin}`);
}

async function main() {
  const profileEnv = resolveManagerRuntimeEnv();
  const runtimeEnv = mergeRepoDevBootstrapAccessTokenEnv({
    env: profileEnv,
    manifestPath: "apps/sdkwork-manager-pc/agent.app.config.json",
    repoRoot: workspaceRoot,
  });
  const { host, port } = parseClientBind(runtimeEnv.SDKWORK_MANAGER_PC_DEV_BIND);
  const require = createRequire(path.join(appRoot, "package.json"));
  const vitePackageJson = require.resolve("vite/package.json");
  const viteExecutable = path.join(path.dirname(vitePackageJson), "bin", "vite.js");
  const client = spawn(
    process.execPath,
    [viteExecutable, "--host", host, "--port", String(port), "--strictPort"],
    {
      cwd: appRoot,
      env: runtimeEnv,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  const clientExit = new Promise((resolve, reject) => {
    client.once("error", reject);
    client.once("exit", (code) => resolve(code ?? 1));
  });
  const stopClient = () => {
    if (client.exitCode === null && !client.killed) {
      client.kill();
    }
  };
  process.once("SIGINT", stopClient);
  process.once("SIGTERM", stopClient);
  process.once("exit", stopClient);

  const localOrigin = `http://127.0.0.1:${port}`;
  await waitForClient(localOrigin, client);
  console.log("[sdkwork-manager] application started successfully");
  for (const line of formatNetworkAccessLines({
    host,
    port,
    prefix: "[sdkwork-manager] ",
    unavailableText: "no private IPv4 LAN address detected",
  })) {
    console.log(line);
  }

  const exitCode = await clientExit;
  process.exit(exitCode);
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
