import { ForbiddenError } from "../../lib/Galat"
import { ROLE_GROUPS } from "../../middleware/RBAC"

const ROLE_V3 = new Set<string>(ROLE_GROUPS.SENIOR_UP)

export function pastikanV3UntukTagihan(role: string, ring?: 1 | 2 | 3) {
  if ((ring !== undefined && ring !== 3) || !ROLE_V3.has(role)) {
    throw new ForbiddenError(
      "Hanya verifikator V3 yang boleh menetapkan pemakaian Tagihan."
    )
  }
}
