// server/modules/publik/berkas.router.ts — melayani foto yang tersimpan di
// disk lokal (fallback pengembangan saat S3 belum dikonfigurasi).
//
// Saat S3_* diisi, `simpanBerkas()` mengembalikan URL S3 langsung dan route
// ini tidak pernah dipakai — karena itu ia menolak melayani apa pun di
// produksi (lihat di bawah).
import { Hono } from "hono"
import { stat, readFile } from "node:fs/promises"
import { NotFoundError } from "../../lib/errors"
import { cekRateLimit, ipKlien } from "../../lib/rate-limit"
import { pathLokalAman } from "../../lib/storage"

export const berkasRouter = new Hono()

const TIPE: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  // Video bukti (pengaduan) di fallback disk lokal. Di produksi video
  // dilayani Cloudinary langsung — route ini tetap khusus pengembangan.
  mp4: "video/mp4",
  webm: "video/webm",
}

berkasRouter.get("/:prefix/:namaFile", async (c) => {
  cekRateLimit(ipKlien(c), {
    nama: "berkas",
    maks: 120,
    jendelaMs: 5 * 60 * 1000,
  })

  // Di produksi berkas dilayani object storage, bukan proses Node ini.
  // Menolak di sini mencegah jalur pengembangan diam-diam terpakai di
  // produksi (dan menyembunyikan fakta bahwa storage belum dikonfigurasi).
  if (process.env.NODE_ENV === "production" && !process.env.S3_BUCKET) {
    throw new NotFoundError("Berkas")
  }

  const publicId = `${c.req.param("prefix")}/${c.req.param("namaFile")}`

  // pathLokalAman() menolak path di luar ./.uploads — tanpa ini, publicId
  // berisi "../" bisa membaca berkas apa pun di server (path traversal).
  const path = pathLokalAman(publicId)
  if (!path) throw new NotFoundError("Berkas")

  const ext = publicId.split(".").pop() ?? ""
  const contentType = TIPE[ext]
  // Hanya ekstensi gambar yang dikenali yang dilayani — mencegah berkas
  // lain (mis. .html) disajikan dari domain kita dan dieksekusi browser.
  if (!contentType) throw new NotFoundError("Berkas")

  try {
    await stat(path)
  } catch {
    throw new NotFoundError("Berkas")
  }

  const isi = await readFile(path)
  return c.body(new Uint8Array(isi), 200, {
    "Content-Type": contentType,
    // Nama file deterministik per (periode, nomorLangganan), dan constraint
    // unik pelangganId+periode mencegah laporan periode yang sama ditulis
    // dua kali -> isinya tidak berubah setelah ditulis, aman di-cache lama.
    // `private` karena ini foto meter milik pelanggan, jangan di-cache
    // proxy bersama.
    "Cache-Control": "private, max-age=31536000, immutable",
    // Pertahanan berlapis: paksa browser menghormati Content-Type kita.
    "X-Content-Type-Options": "nosniff",
  })
})
