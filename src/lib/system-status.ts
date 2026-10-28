// src/lib/system-status.ts
// Status sistem untuk footer, berdasarkan kondisi nyata database.
// Sesuaikan path impor `prisma` dengan proyekmu (mis. "@/lib/db").
import { prisma } from "@/lib/prisma"

export type SystemStatus = "normal" | "degraded" | "offline"

const DEGRADED_AFTER_MS = 800 // respons lambat = terganggu
const OFFLINE_AFTER_MS = 3000 // tidak merespons = tidak tersedia

export async function getSystemStatus(): Promise<SystemStatus> {
  const startedAt = performance.now()

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), OFFLINE_AFTER_MS),
      ),
    ])
  } catch {
    return "offline"
  }

  const elapsed = performance.now() - startedAt
  return elapsed > DEGRADED_AFTER_MS ? "degraded" : "normal"
}