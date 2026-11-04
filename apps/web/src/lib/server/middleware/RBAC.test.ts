import { describe, expect, it } from "vitest"
import { getAccessLevel, MODULE_ACCESS } from "./RBAC"

describe("akses Super Admin", () => {
  it("memberi akses full ke modul terdaftar dan modul baru", () => {
    const modules = [...Object.keys(MODULE_ACCESS), "MODUL_BARU"]

    for (const module of modules) {
      expect(getAccessLevel(module, "SUPER_ADMIN")).toBe("full")
    }
  })
})
