// server/modules/kesehatan/kesehatan.router.ts — pemeriksaan kesehatan data.
//
// GET  /kesehatan            laporan integritas (read-only)      STAFF_UP
// POST /kesehatan/perbaiki   perbaikan otomatis yang aman        SENIOR_UP
//
// Pemeriksaannya boleh dilihat siapa pun yang boleh melihat data; yang
// MENGUBAH data disamakan kewenangannya dengan closing, karena perbaikan
// massal menyentuh ribuan baris sekaligus.

import { Hono } from "hono"
import { requireRole, ROLE_GROUPS } from "../../middleware/rbac"
import { getSessionUser } from "../../lib/session"
import { auditMetaFromRequest } from "../../lib/audit"
import { ok } from "../../lib/response"
import { periksaKesehatan, perbaikiOtomatis } from "./kesehatan.service"

export const kesehatanRouter = new Hono()

kesehatanRouter.get("/", requireRole(...ROLE_GROUPS.STAFF_UP), async (c) => {
  return ok(c, await periksaKesehatan())
})

kesehatanRouter.post(
  "/perbaiki",
  requireRole(...ROLE_GROUPS.SENIOR_UP),
  async (c) => {
    const user = getSessionUser(c)
    return ok(
      c,
      await perbaikiOtomatis({
        olehUserId: user.id,
        jejak: auditMetaFromRequest(c.req.raw),
      }),
    )
  },
)
