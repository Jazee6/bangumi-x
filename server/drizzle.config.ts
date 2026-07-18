import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./drizzle/d1",
  schema: "./src/db/schema/auth.ts",
  dialect: "sqlite",
});
