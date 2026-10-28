// server/middleware/rbac.ts — role-based access control di atas session
// yang sudah diverifikasi oleh @hono/auth-js verifyAuth() (dipasang blanket
// di server/app.ts, jadi middleware ini TIDAK perlu cek "apakah login" lagi
// — getSessionUser() sudah lempar 401 kalau somehow belum ada session).
//
// Diposisikan sesuai matriks organisasi.md §4.2 (6 lapis akses, bukan
// kumulatif 7 grup). Role enum: prisma/auth.prisma.
//
// Catatan ganti-ini: ROLE_GROUPS (model kumulatif) DILARANG untuk kode
// baru. Gunakan MARKU_ACCESS + requireModule / canAccess. ROLE_GROUPS
// dipertahankan lewat COMPATIBILITY supaya router yang sudah ada tetap
// jalan; yang baru sebaiknya pakai akses berbasis modul.
import type { MiddlewareHandler } from "hono"
import type { Role } from "@db"
import { ForbiddenError } from "../lib/errors"
import { getSessionUser } from "../lib/session"

// Urutan jenjang role (semakin ke kanan = lebih rendah, kecuali
// SUPER_ADMIN yang selalu ikut semua grup).
export const ROLE_ORDER: readonly Role[] = [
  "SUPER_ADMIN",
  "DIREKSI",
  "SENIOR_MANAGER",
  "MANAGER",
  "SUPERVISOR",
  "STAFF",
  "PELAKSANA",
] as const

export const ROLE_LEVEL: Record<Role, number> = {
  SUPER_ADMIN: 4,
  DIREKSI: 4,
  SENIOR_MANAGER: 3,
  MANAGER: 3,
  SUPERVISOR: 2,
  STAFF: 2,
  PELAKSANA: 1,
  USER: 0,
} satisfies Record<Role, number>

// Tingkatan akses level. Besar = lebih boleh.
export const ACCESS_LEVEL: Record<string, number> = {
  none: 0,
  read: 1,
  approve: 2,
  execute: 3,
  full: 4,
} as const

export type AccessLevel = keyof typeof ACCESS_LEVEL

// Matriks hak akses modul sesuai organisasi.md §4.2.
// Kunci: nama modul konsisten dengan modul router (mis. MASTER_DATA,
// PENGOLAHAN_DATA, PETA_GIS, PROGRESS_MONITORING, LAPORAN_DRD,
// TOOL_TUTUP_BULAN, TOOLS_SYNC).
export const MODULE_ACCESS: Record<string, Record<Role, AccessLevel>> = {
  MASTER_DATA: {
    SUPER_ADMIN: "full",
    DIREKSI: "read",
    SENIOR_MANAGER: "read",
    MANAGER: "read_write",
    SUPERVISOR: "full",
    STAFF: "full",
    PELAKSANA: "none",
    USER: "none",
  },
  PENGOLAHAN_DATA: {
    SUPER_ADMIN: "full",
    DIREKSI: "read",
    SENIOR_MANAGER: "read",
    MANAGER: "read_write",
    SUPERVISOR: "full",
    STAFF: "full",
    PELAKSANA: "none",
    USER: "none",
  },
  PETA_GIS: {
    SUPER_ADMIN: "full",
    DIREKSI: "read",
    SENIOR_MANAGER: "read",
    MANAGER: "read",
    SUPERVISOR: "read_write",
    STAFF: "read_write",
    PELAKSANA: "read",
    USER: "none",
  },
  PROGRESS_MONITORING: {
    SUPER_ADMIN: "full",
    DIREKSI: "read",
    SENIOR_MANAGER: "read",
    MANAGER: "read",
    SUPERVISOR: "read",
    STAFF: "read",
    PELAKSANA: "read",
    USER: "none",
  },
  LAPORAN_DRD: {
    SUPER_ADMIN: "full",
    DIREKSI: "read",
    SENIOR_MANAGER: "read",
    MANAGER: "read",
    SUPERVISOR: "read_write",
    STAFF: "read_write",
    PELAKSANA: "none",
    USER: "none",
  },
  TOOL_TUTUP_BULAN: {
    SUPER_ADMIN: "full",
    DIREKSI: "read",
    SENIOR_MANAGER: "approve",
    MANAGER: "execute",
    SUPERVISOR: "execute",
    STAFF: "execute",
    PELAKSANA: "none",
    USER: "none",
  },
  TOOLS_SYNC: {
    SUPER_ADMIN: "full",
    DIREKSI: "none",
    SENIOR_MANAGER: "none",
    MANAGER: "execute",
    SUPERVISOR: "execute",
    STAFF: "execute",
    PELAKSANA: "none",
    USER: "none",
  },
}

export function canAccess(module: string, role: Role): boolean {
  return MODULE_ACCESS[module]?.[role] !== undefined &&
    ACCESS_LEVEL[MODULE_ACCESS[module]![role] as string] > 0
}

// Tingkatan akses terbesar yang dimiliki peran terhadap modul.
export function getAccessLevel(module: string, role: Role): AccessLevel | null {
  return MODULE_ACCESS[module]?.[role] ?? "none"
}

// Middleware: akses `act` (read/write) ke `module` wajib dipenuhi.
// `act="read"` butuh level >= READ (1).
// `act="write"` butuh level >= EXECUTE (3) (karena write = posting/approve,
// bukan sekadar ubah field sederhana).
export function requireModuleAccess(
  module: string,
  act: "read" | "write" = "read",
): MiddlewareHandler {
  return async (c, next) => {
    const user = getSessionUser(c)
    const level = MODULE_ACCESS[module]?.[user.role]
    if (!level) {
      throw new ForbiddenError(`Akses ke modul "${module}" ditolak`)
    }
    const required = act === "read" ? ACCESS_LEVEL.read : ACCESS_LEVEL.execute
    if (ACCESS_LEVEL[level as string] < required) {
      throw new ForbiddenError(
        `Peran ${user.role} tidak cukup untuk "${act}" modul "${module}"`,
      )
    }
    await next()
  }
}

// Kompatibilitas: ROLE_GROUPS (model kumulatif) tetap dipertahankan agar
// router yang sudah menggunakan requireRole(...) tidak rusak.
export const ROLE_GROUPS = {
  ADMIN: ["SUPER_ADMIN"],
  SENIOR_UP: ["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER"],
  MANAGEMENT_UP: ["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER", "MANAGER"],
  SUPERVISOR_UP: [
    "SUPER_ADMIN",
    "DIREKSI",
    "SENIOR_MANAGER",
    "MANAGER",
    "SUPERVISOR",
  ],
  STAFF_UP: [
    "SUPER_ADMIN",
    "DIREKSI",
    "SENIOR_MANAGER",
    "MANAGER",
    "SUPERVISOR",
    "STAFF",
  ],
  LAPANGAN: [
    "SUPER_ADMIN",
    "DIREKSI",
    "SENIOR_MANAGER",
    "MANAGER",
    "SUPERVISOR",
    "STAFF",
    "PELAKSANA",
  ],
  ANY: [
    "SUPER_ADMIN",
    "DIREKSI",
    "SENIOR_MANAGER",
    "MANAGER",
    "SUPERVISOR",
    "STAFF",
    "PELAKSANA",
    "USER",
  ],
} as const satisfies Record<string, readonly Role[]>

export function requireRole(...roles: readonly Role[]): MiddlewareHandler {
  return async (c, next) => {
    const user = getSessionUser(c)
    if (!roles.includes(user.role)) {
      throw new ForbiddenError(
        `Aksi ini memerlukan salah satu role: ${roles.join(", ")}`,
      )
    }
    await next()
  }
}
