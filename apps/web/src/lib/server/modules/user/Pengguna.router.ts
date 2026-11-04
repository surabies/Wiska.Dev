// server/modules/user/user.router.ts — manajemen akun internal.
import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, created, paginated } from "../../lib/Respons"
import {
  listQuerySchema,
  createSchema,
  updateSchema,
  updateRoleSchema,
  updateStatusSchema,
  passwordSchema,
} from "./Pengguna.schema"
import * as service from "./Pengguna.service"

export const userRouter = new Hono()

userRouter.get("/me", async (c) => {
  const requester = getSessionUser(c)
  const row = await service.getMe(requester.id)
  return ok(c, row)
})

userRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.MANAGEMENT_UP),
  validate("query", listQuerySchema),
  async (c) => {
    const query = c.req.valid("query")
    const { data, meta } = await service.listPengguna(query)
    return paginated(c, data, meta)
  }
)

userRouter.get("/:id", requireRole(...ROLE_GROUPS.MANAGEMENT_UP), async (c) => {
  const row = await service.getPenggunaById(c.req.param("id"))
  return ok(c, row)
})

userRouter.post(
  "/",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", createSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.createPengguna(
      c.req.valid("json"),
      requester,
      c.req.raw
    )
    return created(c, row)
  }
)

userRouter.patch(
  "/:id",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", updateSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.updatePengguna(
      c.req.param("id"),
      c.req.valid("json"),
      requester,
      c.req.raw
    )
    return ok(c, row)
  }
)

userRouter.patch(
  "/:id/role",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", updateRoleSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.updatePenggunaRole(
      c.req.param("id"),
      c.req.valid("json"),
      requester,
      c.req.raw
    )
    return ok(c, row)
  }
)

userRouter.patch(
  "/:id/status",
  requireRole(...ROLE_GROUPS.ADMIN),
  validate("json", updateStatusSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const row = await service.updatePenggunaStatus(
      c.req.param("id"),
      c.req.valid("json"),
      requester,
      c.req.raw
    )
    return ok(c, row)
  }
)

userRouter.patch(
  "/:id/password",
  validate("json", passwordSchema),
  async (c) => {
    const requester = getSessionUser(c)
    const result = await service.updatePenggunaPassword(
      c.req.param("id"),
      c.req.valid("json"),
      requester,
      c.req.raw
    )
    return ok(c, result)
  }
)
