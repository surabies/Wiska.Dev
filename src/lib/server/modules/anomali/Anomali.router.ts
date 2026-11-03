// server/modules/anomali/anomali.router.ts — API modul anomali.
//
// DUA JENIS PEMAKAI, SATU DAFTAR:
//   - staf kantor (STAFF_UP) memantau tren & memeriksa detail;
//   - penyelia anomali (PELAKSANA berjenis PENYELIA_ANOMALI) mengunduh
//     seluruh daftar lalu memilih sendiri mana yang didatangi.
//
// TIDAK ADA ENDPOINT PENUGASAN, dan itu disengaja — lihat catatan pada model
// KunjunganAnomali. Penyelia tidak menunggu dibagi alamat; ia menerima
// daftar utuh dan keberhasilannya diukur dari turunnya jumlah anomali.

import { Hono } from "hono"
import { validate } from "../../lib/Validasi"
import { requireRole, ROLE_GROUPS } from "../../middleware/RBAC"
import { getSessionUser } from "../../lib/Sesi"
import { ok, created } from "../../lib/Respons"
import { NotFoundError } from "../../lib/Galat"
import { daftarQuerySchema, kunjunganSchema } from "./Anomali.schema"
import {
  ambilDaftarAnomali,
  trenAnomali,
  riwayatSambungan,
  catatKunjunganAnomali,
  daftarKunjunganSaya,
} from "./Anomali.service"

export const anomaliRouter = new Hono()

/// Daftar lengkap. Dijaga LAPANGAN, bukan STAFF_UP: penyelia anomali adalah
/// PELAKSANA, dan endpoint inilah miliknya. Atasannya ikut tercakup grup itu.
anomaliRouter.get(
  "/",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("query", daftarQuerySchema),
  async (c) => {
    const q = c.req.valid("query")
    return ok(c, await ambilDaftarAnomali(q))
  }
)

anomaliRouter.get("/tren", requireRole(...ROLE_GROUPS.LAPANGAN), async (c) => {
  const jumlah = Number(c.req.query("periode") ?? 6)
  return ok(
    c,
    await trenAnomali(
      Number.isFinite(jumlah) ? Math.min(Math.max(jumlah, 2), 24) : 6
    )
  )
})

anomaliRouter.get(
  "/:pelangganId/riwayat",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  async (c) => {
    const hasil = await riwayatSambungan(c.req.param("pelangganId"))
    if (!hasil) throw new NotFoundError("Pelanggan")
    return ok(c, hasil)
  }
)

/// Merekam hasil kunjungan.
///
/// ANGKA METER TIDAK LANGSUNG JADI PEMBACAAN RESMI. Bila petugas berhasil
/// membaca meternya, angka itu masuk ANTREAN VERIFIKASI lewat
/// LaporanHarianPetugas — jalur yang sama dengan pencatatan biasa, dengan
/// ring V1->V2->V3 yang sudah ada. Alasannya sederhana: angka ini mengubah
/// tagihan, dan satu orang di lapangan tidak boleh mengubah tagihan tanpa
/// pemeriksaan kedua. Laporan mandiri warga pun sudah tunduk pada aturan
/// yang sama.
anomaliRouter.post(
  "/kunjungan",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  validate("json", kunjunganSchema),
  async (c) => {
    const b = c.req.valid("json")
    const user = getSessionUser(c)
    const hasil = await catatKunjunganAnomali(b, user.id)
    return created(c, hasil)
  }
)

/// Kunjungan yang SUDAH dilakukan penyelia ini — bukan daftar tugas, tapi
/// catatan kerjanya sendiri.
anomaliRouter.get(
  "/kunjungan/saya",
  requireRole(...ROLE_GROUPS.LAPANGAN),
  async (c) => {
    const user = getSessionUser(c)
    return ok(c, await daftarKunjunganSaya(user.id))
  }
)
