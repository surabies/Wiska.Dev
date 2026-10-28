// Load the project-root environment file for maintenance scripts.
import { config as loadEnv } from "dotenv"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const PROJECT_ROOT = fileURLToPath(
  new URL("../../../../", import.meta.url),
)
export const DATA_DIR = resolve(PROJECT_ROOT, "prisma", "data")

loadEnv({ path: resolve(PROJECT_ROOT, ".env") })
