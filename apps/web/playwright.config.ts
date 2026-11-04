import { randomBytes } from "node:crypto"
import { config as loadDotEnv } from "dotenv"
import { defineConfig, devices } from "@playwright/test"
import { requireE2EDatabaseUrl } from "./e2e/database-guard"

loadDotEnv({ path: ".env.e2e" })
if (process.env.E2E_DATABASE_URL) {
  process.env.DATABASE_URL = requireE2EDatabaseUrl()
}
process.env.AUTH_SECRET ??= randomBytes(32).toString("base64url")

const baseURL = "http://127.0.0.1:3107"
const webServerEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => entry[1] !== undefined,
  ),
)

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  workers: 1,
  globalSetup: "./e2e/global-setup.ts",
  reporter: "list",
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm dev -- --hostname 127.0.0.1 --port 3107",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: webServerEnv,
  },
})
