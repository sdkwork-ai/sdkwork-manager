import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const requiredUserManagementPermissions = [
  "iam.users.create",
  "iam.users.delete",
  "iam.users.read",
  "iam.users.update",
];

const requiredAccessControlPermissions = [
  "iam.permissions.create",
  "iam.permissions.delete",
  "iam.permissions.read",
  "iam.permissions.update",
  "iam.policies.create",
  "iam.policies.delete",
  "iam.policies.read",
  "iam.policies.update",
  "iam.roles.create",
  "iam.roles.delete",
  "iam.roles.read",
  "iam.roles.update",
];

describe("manager IAM foundation", () => {
  it("keeps repository and PC manifests aligned for user administration", () => {
    const manifests = [
      resolve(process.cwd(), "agent.app.config.json"),
      resolve(process.cwd(), "apps/sdkwork-manager-pc/agent.app.config.json"),
    ].map((file) => JSON.parse(readFileSync(file, "utf8")) as {
      backend: { accessTokenPermissionScope: string[] };
    });

    for (const manifest of manifests) {
      expect(manifest.backend.accessTokenPermissionScope).toEqual(
        expect.arrayContaining(requiredUserManagementPermissions),
      );
      expect(manifest.backend.accessTokenPermissionScope).toEqual(
        expect.arrayContaining(requiredAccessControlPermissions),
      );
    }
  });

  it("exposes the standard two-stage forgot-password route under manager auth", () => {
    const managerAuthRoutes = readFileSync(
      resolve(process.cwd(), "apps/sdkwork-manager-pc/packages/sdkwork-manager-pc-shell/src/auth/ManagerAuthRoutes.tsx"),
      "utf8",
    );
    const canonicalAuthRoutes = readFileSync(
      resolve(process.cwd(), "../sdkwork-iam/apps/sdkwork-iam-pc/packages/sdkwork-auth-pc-react/src/auth.ts"),
      "utf8",
    );

    expect(managerAuthRoutes).toContain('basePath="/auth"');
    expect(canonicalAuthRoutes).toContain('forgotPasswordRoutePath: resolveAuthRoutePath("forgot-password", routes)');
  });
});
