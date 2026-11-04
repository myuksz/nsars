import vinext from "vinext";
import { defineConfig, loadEnv } from "vite";
import hostingConfig from "./.openai/hosting.json";
import { sites } from "./build/sites-vite-plugin";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

const { d1, r2 } = hostingConfig;

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  vars: {
    NSARS_ADMIN_EMAIL: process.env.NSARS_ADMIN_EMAIL ?? "",
    NSARS_ADMIN_PASSWORD_SALT_HEX:
      process.env.NSARS_ADMIN_PASSWORD_SALT_HEX ?? "",
    NSARS_ADMIN_PASSWORD_HASH_HEX:
      process.env.NSARS_ADMIN_PASSWORD_HASH_HEX ?? "",
  },
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async ({ mode }) => {
  const localEnv = loadEnv(mode, process.cwd(), "");
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local", "localhost", "127.0.0.1"],
      ...(isCodexSeatbeltSandbox
        ? { watch: { useFsEvents: false, usePolling: true } }
        : {}),
    },
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        inspectorPort: false,
        config: {
          ...localBindingConfig,
          vars: {
            NSARS_ADMIN_EMAIL:
              localEnv.NSARS_ADMIN_EMAIL ??
              localBindingConfig.vars.NSARS_ADMIN_EMAIL,
            NSARS_ADMIN_PASSWORD_SALT_HEX:
              localEnv.NSARS_ADMIN_PASSWORD_SALT_HEX ??
              localBindingConfig.vars.NSARS_ADMIN_PASSWORD_SALT_HEX,
            NSARS_ADMIN_PASSWORD_HASH_HEX:
              localEnv.NSARS_ADMIN_PASSWORD_HASH_HEX ??
              localBindingConfig.vars.NSARS_ADMIN_PASSWORD_HASH_HEX,
          },
        },
      }),
    ],
  };
});
