import "server-only"

// features/akun/lib/queries.ts — bacaan langsung ke DB untuk portal akun
// warga (/akun), dipanggil dari server component. Sama seperti
// features/dashboard/lib/queries.ts: server component membaca Prisma
// LANGSUNG, bukan fetch("/api/v1/...") ke servernya sendiri (lihat
// CLAUDE.md "Dashboard" — HTTP ke diri sendiri cuma menambah hop + urusan
// forward cookie manual). GET /api/v1/pengaduan/saya tetap ada untuk
// pemanggil LUAR (aplikasi mobile) yang memang harus lewat HTTP.
//
// ringkasSla() diimpor dari server/modules/pengaduan/sla.ts (bukan ditulis
// ulang di sini) supaya aturan "terlambat" tetap SATU sumber kebenaran —
// modul itu memang fungsi murni tanpa akses DB, dirancang untuk dipakai
// ulang di luar router-nya sendiri (lihat komentar di kepala file itu).
import { prisma } from "@/lib/prisma"
import { ringkasSla } from "@/lib/domain/sla"

export interface TiketSaya {
  id: string
  nomorTiket: string
  jenis: string
  judul: string
  status: string
  prioritas: string
  createdAt: Date
  ditugaskanKe: { name: string | null } | null
  sla: ReturnType<typeof ringkasSla>
}

/// Tiket yang DIBUAT userId ini — ditandai lewat `olehId` pada entri
/// linimasa DIBUAT (lihat catatan di server/modules/publik/publik.router.ts:
/// POST /api/public/pengaduan menautkan otomatis saat pelapor kebetulan
/// sedang login). Tanpa kolom pelaporUserId baru — penanda yang sama dibaca
/// balik di sini.
export async function ambilTiketSaya(userId: string): Promise<TiketSaya[]> {
  const dibuatOleh = await prisma.riwayatPengaduan.findMany({
    where: { aksi: "DIBUAT", olehId: userId },
    select: { pengaduanId: true },
  })
  const ids = dibuatOleh.map((r) => r.pengaduanId)
  if (ids.length === 0) return []

  const rows = await prisma.pengaduan.findMany({
    where: { id: { in: ids } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      nomorTiket: true,
      jenis: true,
      judul: true,
      status: true,
      prioritas: true,
      createdAt: true,
      targetResponsAt: true,
      targetSelesaiAt: true,
      responsAt: true,
      jedaMulaiAt: true,
      selesaiAt: true,
      ditugaskanKe: { select: { name: true } },
    },
  })

  return rows.map((r) => ({ ...r, sla: ringkasSla(r) }))
}
