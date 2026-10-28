// server/lib/errors.ts — hierarki error aplikasi + handler tunggal yang
// memetakan semuanya (AppError, ZodError, Prisma known-request-error,
// HTTPException bawaan Hono) ke satu envelope error yang konsisten.
//
// KENAPA PENGECEKAN STRUKTURAL, BUKAN `instanceof`?
// Versi awal file ini memakai `err instanceof Prisma.PrismaClientKnownRequestError`
// dan `err instanceof ZodError`. TERBUKTI TIDAK JALAN: error P2002 (unique)
// dan P2003 (foreign key) lolos jadi 500 "INTERNAL_ERROR" alih-alih 409/400
// — seluruh pemetaan error Prisma diam-diam jadi dead code. Sebabnya sama
// dengan yang didokumentasikan di server/lib/spatial.ts: PrismaClient
// di-cache di globalThis (lib/prisma.ts) sementara HMR/bundling Next.js bisa
// memuat modul `@db` sebagai instance TERPISAH, sehingga
// class yang dipakai `instanceof` di sini bukan class yang sama dengan yang
// melempar error. Mengecek BENTUK error (properti `code` P#### / `issues`)
// tidak bergantung pada identitas class, jadi kebal masalah tersebut.
import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { ZodError, core } from "zod"
import type { ContentfulStatusCode } from "hono/utils/http-status"

export class AppError extends Error {
  readonly status: ContentfulStatusCode
  readonly code: string
  readonly details?: unknown

  constructor(
    status: ContentfulStatusCode,
    code: string,
    message: string,
    details?: unknown,
  ) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Permintaan tidak valid", details?: unknown) {
    super(400, "BAD_REQUEST", message, details)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Autentikasi diperlukan") {
    super(401, "UNAUTHORIZED", message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Anda tidak memiliki akses untuk aksi ini") {
    super(403, "FORBIDDEN", message)
  }
}

export class NotFoundError extends AppError {
  constructor(entitas = "Data", message?: string) {
    super(404, "NOT_FOUND", message ?? `${entitas} tidak ditemukan`)
  }
}

export class ConflictError extends AppError {
  constructor(
    message = "Data sudah ada / bentrok dengan data lain",
    details?: unknown,
  ) {
    super(409, "CONFLICT", message, details)
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown, message = "Input tidak valid") {
    super(422, "VALIDATION_ERROR", message, details)
  }
}

/** AppError dilempar lintas modul juga — pakai cek struktural dengan alasan
 * yang sama seperti di header file. */
function isAppError(err: unknown): err is AppError {
  return (
    err instanceof Error &&
    typeof (err as AppError).status === "number" &&
    typeof (err as AppError).code === "string"
  )
}

interface PrismaKnownError {
  code: string
  meta?: Record<string, unknown>
}

/** Diekspor untuk penanganan per-record di endpoint batch (P2002 = baris
 * duplikat, bukan kegagalan seluruh batch). */
export function isPrismaKnownError(err: unknown): err is PrismaKnownError {
  const code = (err as PrismaKnownError | null)?.code
  return (
    err instanceof Error && typeof code === "string" && /^P\d{4}$/.test(code)
  )
}

function isZodError(err: unknown): err is ZodError {
  return (
    err instanceof Error &&
    err.name === "ZodError" &&
    Array.isArray((err as ZodError).issues)
  )
}

export function formatZodIssues(issues: readonly core.$ZodIssue[]) {
  return issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }))
}

/// Prisma P2002 (unique) / P2003 (FK) / P2025 (record not found) adalah
/// kasus paling sering muncul lewat operasi CRUD normal — dipetakan ke
/// error envelope yang ramah, sisanya (P20xx lain) jatuh ke 500 generik
/// supaya detail internal tidak bocor ke client.
function mapPrismaError(err: PrismaKnownError): AppError {
  switch (err.code) {
    case "P2002": {
      const target = err.meta?.target
      const fields = Array.isArray(target)
        ? target.join(", ")
        : typeof target === "string"
          ? target
          : null
      return new ConflictError(
        fields
          ? `Nilai untuk (${fields}) sudah digunakan`
          : "Data sudah ada / bentrok dengan data lain",
      )
    }
    case "P2003":
      return new BadRequestError(
        "Referensi ke data lain tidak valid (foreign key tidak ditemukan)",
      )
    case "P2025":
      return new NotFoundError()
    default:
      return new AppError(
        500,
        "DATABASE_ERROR",
        "Terjadi kesalahan pada database",
      )
  }
}

function envelope(err: AppError) {
  return {
    success: false as const,
    error: { code: err.code, message: err.message, details: err.details },
  }
}

export async function errorHandler(err: Error, c: Context) {
  if (isAppError(err)) {
    return c.json(envelope(err), err.status)
  }

  if (isZodError(err)) {
    return c.json(
      envelope(new ValidationError(formatZodIssues(err.issues))),
      422,
    )
  }

  if (isPrismaKnownError(err)) {
    const mapped = mapPrismaError(err)
    // P20xx yang tidak dipetakan = bug/kondisi tak terduga -> tetap log
    // supaya tidak hilang diam-diam di balik pesan 500 generik.
    if (mapped.status === 500)
      console.error("[api] unmapped prisma error:", err)
    return c.json(envelope(mapped), mapped.status)
  }

  if (err instanceof HTTPException) {
    const res = err.getResponse()
    if (res.headers.get("content-type")?.includes("application/json"))
      return res
    const message =
      err.message || (await res.clone().text()) || "Terjadi kesalahan"
    return c.json(
      { success: false, error: { code: "HTTP_ERROR", message } },
      err.status,
    )
  }

  console.error("[api] unhandled error:", err)
  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "Terjadi kesalahan pada server",
      },
    },
    500,
  )
}
