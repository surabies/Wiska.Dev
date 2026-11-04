import { afterEach, describe, expect, it, vi } from "vitest"
import { requireE2EDatabaseUrl } from "./database-guard"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("guard database E2E", () => {
  it("menolak fallback ke database aplikasi", () => {
    vi.stubEnv("E2E_DATABASE_URL", "")
    vi.stubEnv(
      "DATABASE_URL",
      "postgresql://user:password@localhost:5432/wiska_dev",
    )

    expect(() => requireE2EDatabaseUrl()).toThrow("wajib diatur")
  })

  it("hanya menerima PostgreSQL dengan nama database khusus test", () => {
    vi.stubEnv("E2E_DATABASE_URL", "postgresql://user:password@localhost/wiska_e2e")
    expect(requireE2EDatabaseUrl()).toBe(
      "postgresql://user:password@localhost/wiska_e2e",
    )

    vi.stubEnv("E2E_DATABASE_URL", "postgresql://user:password@localhost/wiska_dev")
    expect(() => requireE2EDatabaseUrl()).toThrow('segmen "e2e" atau "test"')
  })
})
