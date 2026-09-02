import { defineConfig } from "drizzle-kit";

export default defineConfig({
  out: "./migrations/mobile",
  schema: "./shared/mobile/schema.ts",
  dialect: "postgresql",
  strict: true,
  verbose: true,
});
