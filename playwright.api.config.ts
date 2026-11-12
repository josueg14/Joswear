import { defineConfig } from "@playwright/test";
if (
  !process.env.DATABASE_URL?.startsWith(
    "postgresql://joswear_test@127.0.0.1:55439/joswear_test?",
  )
)
  throw new Error("Solo base de pruebas local aislada");
export default defineConfig({
  testDir: "./tests/api",
  workers: 1,
  fullyParallel: false,
  timeout: 60000,
  use: {
    baseURL: "http://127.0.0.1:3101",
    extraHTTPHeaders: { origin: "http://127.0.0.1:3101" },
  },
  webServer: {
    command: "npm run dev -- --port 3101",
    url: "http://127.0.0.1:3101/api/health",
    timeout: 120000,
    reuseExistingServer: false,
    env: {
      DEMO_MODE: "false",
      APP_URL: "http://127.0.0.1:3101",
      EMAIL_MODE: "sandbox",
      MFA_ENCRYPTION_KEY: "d7".repeat(32),
    },
  },
});
