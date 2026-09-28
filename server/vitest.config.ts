import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-plugin";
import { defineProject } from "vitest/config";

export default defineProject(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
      miniflare: {
        cache: false,
        bindings: { TEST_MIGRATIONS: await readD1Migrations("drizzle") },
      },
    }),
  ],
  test: {
    include: ["src/**/*.test.ts"],
  },
}));
