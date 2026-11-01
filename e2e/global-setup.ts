import { config as loadDotEnv } from "dotenv"
import { seedE2EAccounts } from "./seed-accounts"
import { requireE2EDatabaseUrl } from "./database-guard"

export default async function globalSetup(): Promise<void> {
  loadDotEnv({ path: ".env.e2e" })
  process.env.DATABASE_URL = requireE2EDatabaseUrl()

  if (!process.env.E2E_TEST_PASSWORD) {
    throw new Error("E2E_TEST_PASSWORD belum diatur.")
  }

  await seedE2EAccounts()
}
