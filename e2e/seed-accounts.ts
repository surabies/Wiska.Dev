import { config as loadDotEnv } from "dotenv"
import { hash } from "@node-rs/argon2"

loadDotEnv({ path: ".env.e2e" })

import { E2E_ACCOUNTS, E2E_PASSWORD_ENV } from "./accounts"
import { requireE2EDatabaseUrl } from "./database-guard"

export async function seedE2EAccounts(): Promise<void> {
  process.env.DATABASE_URL = requireE2EDatabaseUrl()
  const password = process.env[E2E_PASSWORD_ENV]
  if (!password || password.length < 16) {
    throw new Error(`${E2E_PASSWORD_ENV} wajib berisi minimal 16 karakter.`)
  }

  const passwordHash = await hash(password)
  const { prisma } = await import("../prisma/index")

  try {
    for (const account of E2E_ACCOUNTS) {
      const email = `${account.username}@example.test`
      const data = {
        name: `E2E ${account.role}`,
        username: account.username,
        email,
        passwordHash,
        role: account.role,
        status: "ACTIVE" as const,
      }

      await prisma.user.upsert({
        where: { email },
        create: data,
        update: data,
      })
    }
  } finally {
    await prisma.$disconnect()
  }
}

if (process.argv[1]?.endsWith("seed-accounts.ts")) {
  await seedE2EAccounts()
  console.info(`Seeded ${E2E_ACCOUNTS.length} role accounts in the E2E database.`)
}
