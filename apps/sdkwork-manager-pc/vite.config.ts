import { resolveBrowserDistOutDir } from '../../../sdkwork-specs/tools/browser-dist-layout.mjs';
function resolveViteEnvironment(mode: string | undefined, processEnv = process.env) {
  const profileMatch = /^(standalone|cloud)\.(development|test|staging|production)$/u.exec(mode ?? '');
  return profileMatch?.[2]
    ?? (['development', 'test', 'staging', 'production'].includes(processEnv.SDKWORK_ENVIRONMENT ?? '')
      ? (processEnv.SDKWORK_ENVIRONMENT ?? 'production')
      : 'production');
}
import tailwindcss from "@tailwindcss/vite";
import { createSdkworkCredentialEntryBootstrapVitePlugin } from "../../../sdkwork-iam/apps/sdkwork-iam-common/packages/sdkwork-iam-credential-entry/src/vite.ts";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const appRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appRoot, "../..");
const workspaceRoot = path.resolve(repoRoot, "..");
const viteWorkspaceSourceRoots = [
  repoRoot,
  workspacePath("sdkwork-iam"),
  workspacePath("sdkwork-drive"),
  workspacePath("sdkwork-payment"),
  workspacePath("sdkwork-order"),
  workspacePath("sdkwork-promotion"),
  workspacePath("sdkwork-membership"),
  workspacePath("sdkwork-appbase"),
  workspacePath("sdkwork-ui"),
  workspacePath("sdkwork-sdk-commons"),
  workspacePath("sdkwork-utils"),
];

function workspacePath(...segments: string[]): string {
  return path.resolve(workspaceRoot, ...segments);
}

function resolveManagerManualChunk(id: string): string | undefined {
  const normalizedId = id.replaceAll("\\", "/");
  if (
    normalizedId.includes("/node_modules/react/")
    || normalizedId.includes("/node_modules/react-dom/")
    || normalizedId.includes("/node_modules/react-router/")
    || normalizedId.includes("/node_modules/react-router-dom/")
  ) {
    return "vendor-react";
  }
  if (
    normalizedId.includes("/node_modules/i18next/")
    || normalizedId.includes("/node_modules/react-i18next/")
    || normalizedId.includes("/node_modules/use-sync-external-store/")
  ) {
    return "vendor-i18n";
  }
  if (
    normalizedId.includes("/node_modules/@radix-ui/")
    || normalizedId.includes("/node_modules/lucide-react/")
    || normalizedId.includes("/node_modules/@tanstack/")
    || normalizedId.includes("/node_modules/react-hook-form/")
  ) {
    return "vendor-ui";
  }
  return undefined;
}

export default defineConfig(({ mode }) => {
  // IAM credential-entry operations receive this only during local development.
  // The canonical runner generates it from the application manifest before Vite starts.
  const credentialEntryBootstrapAccessToken = process.env.SDKWORK_ACCESS_TOKEN ?? "";
  return {
    plugins: [
      createSdkworkCredentialEntryBootstrapVitePlugin({
        accessToken: credentialEntryBootstrapAccessToken,
        environment: mode,
      }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      // Package imports resolve through pnpm workspace links and package
      // exports maps (APP_PC_ARCHITECTURE_SPEC section 2.0.1); no package
      // aliases are declared. Hook-bearing runtime dependencies are pinned to
      // one copy with resolve.dedupe so all pages share React's dispatcher.
      dedupe: ["react", "react-dom", "react-i18next", "i18next"],
    },
    build: {
      outDir: resolveBrowserDistOutDir(resolveViteEnvironment(mode, process.env)),
      rolldownOptions: {
        output: {
          manualChunks: resolveManagerManualChunk,
        },
      },
    },
    server: {
      // Auth and UI packages are linked from sibling workspaces. Keep Vite's
      // /@fs/ serving boundary explicit so their source can be transformed
      // without allowing arbitrary paths from the host filesystem.
      fs: {
        allow: viteWorkspaceSourceRoots,
      },
      port: 5190,
      strictPort: true,
      host: "127.0.0.1",
    },
  };
});
