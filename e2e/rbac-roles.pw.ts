import { expect, test } from "@playwright/test"
import { E2E_ACCOUNTS, E2E_PASSWORD_ENV } from "./accounts"

const expectedAccess = {
  SUPER_ADMIN: { konfigurasi: 200, users: 200, admin: 200 },
  DIREKSI: { konfigurasi: 200, users: 200, admin: 403 },
  SENIOR_MANAGER: { konfigurasi: 200, users: 200, admin: 403 },
  MANAGER: { konfigurasi: 200, users: 200, admin: 403 },
  SUPERVISOR: { konfigurasi: 200, users: 403, admin: 403 },
  STAFF: { konfigurasi: 200, users: 403, admin: 403 },
  PELAKSANA: { konfigurasi: 403, users: 403, admin: 403 },
  USER: { konfigurasi: 403, users: 403, admin: 403 },
} as const

test.describe("RBAC melalui akun role (Playwright)", () => {
  for (const account of E2E_ACCOUNTS) {
    test(`${account.role} mendapat akses sesuai matriks`, async ({ page }) => {
      const password = process.env[E2E_PASSWORD_ENV]
      if (!password) throw new Error(`${E2E_PASSWORD_ENV} belum diatur.`)

      await page.goto("/login")
      await page.getByLabel("Email atau username").fill(account.username)
      await page.getByLabel("Password").fill(password)
      await page.getByRole("button", { name: "Masuk" }).click()

      await expect
        .poll(
          async () => {
            const response = await page.request.get("/api/auth/session")
            if (!response.ok()) return null
            const session = (await response.json()) as {
              user?: { role?: string }
            }
            return session.user?.role ?? null
          },
          { timeout: 20_000 },
        )
        .toBe(account.role)

      const akses = expectedAccess[account.role]
      const [konfigurasi, users, admin] = await Promise.all([
        page.request.get("/api/v1/konfigurasi"),
        page.request.get("/api/v1/users"),
        page.request.get("/api/v1/konfigurasi/lapor-mandiri/jendela"),
      ])

      expect(konfigurasi.status(), "akses konfigurasi").toBe(akses.konfigurasi)
      expect(users.status(), "akses daftar pengguna").toBe(akses.users)
      expect(admin.status(), "akses pengaturan administrator").toBe(akses.admin)
    })
  }
})
