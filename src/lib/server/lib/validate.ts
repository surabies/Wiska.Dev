// server/lib/validate.ts — pembungkus @hono/zod-validator.
//
// WAJIB dipakai menggantikan zValidator polos di SELURUH modul. Alasannya:
// zValidator bawaan MENANGKAP ZodError sendiri dan langsung mengembalikan
// response 400 berisi dump ZodError mentah — tidak pernah sampai ke
// app.onError, jadi envelope error kita ({success:false,error:{code,...}})
// terlewat total dan client menerima dua format error berbeda. Hook di sini
// melempar ValidationError kita sendiri supaya konsisten lewat errorHandler
// sebagai 422 + details {path, message} yang rapi.
import { zValidator } from "@hono/zod-validator"
import type { ValidationTargets } from "hono"
import type { ZodType } from "zod"
import { ValidationError, formatZodIssues } from "./errors"

export function validate<
  T extends ZodType,
  Target extends keyof ValidationTargets,
>(target: Target, schema: T) {
  return zValidator(target, schema, (result) => {
    if (!result.success) {
      throw new ValidationError(formatZodIssues(result.error.issues))
    }
  })
}
