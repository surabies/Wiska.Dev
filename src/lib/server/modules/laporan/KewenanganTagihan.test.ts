import { describe, expect, it } from "vitest"
import { ForbiddenError } from "../../lib/Galat"
import { pastikanV3UntukTagihan } from "./KewenanganTagihan"

describe("pastikanV3UntukTagihan", () => {
  it.each(["SENIOR_MANAGER", "DIREKSI", "SUPER_ADMIN"])(
    "mengizinkan role V3 %s menetapkan Tagihan",
    (role) => expect(() => pastikanV3UntukTagihan(role)).not.toThrow()
  )

  it.each([
    ["SUPERVISOR", 1],
    ["MANAGER", 2],
    ["SENIOR_MANAGER", 1],
    ["DIREKSI", 2],
    ["SUPER_ADMIN", 1],
    ["STAFF", undefined],
    ["PELAKSANA", undefined],
  ] as const)("menolak penetapan oleh %s pada ring %s", (role, ring) => {
    expect(() => pastikanV3UntukTagihan(role, ring)).toThrow(ForbiddenError)
  })

  it("mengizinkan penetapan oleh role V3 pada ring V3", () => {
    expect(() => pastikanV3UntukTagihan("SENIOR_MANAGER", 3)).not.toThrow()
  })
})
