// src/lib/server/modules/laporan/LaporanHarianImpor.service.ts — impor cadangan
// lapangan (berkas backup ZIP/CSV aplikasi petugas → laporan).
// Dipakai halaman "Impor cadangan" dashboard.
//
// DUA PINTU TERPISAH, dan keduanya MENUNTUT periode disebut eksplisit.
//
// Versi sebelumnya satu pintu "lempar apa saja ke sini": periode dibaca dari
// nama berkas, jenis ditebak dari nama berkas, dan apa pun yang tidak cocok
// pola DILEWATI DIAM-DIAM. Itu keliru ke dua arah sekaligus. Sekantong foto
// periode lain masuk tanpa perlawanan ke periode yang kebetulan tertulis di
// namanya — tidak ada yang bisa menyanggah, karena tidak ada pernyataan niat
// untuk dibandingkan. Dan berkas yang salah nama lenyap tanpa jejak: admin
// melihat "0 gagal" lalu menyimpulkan semuanya masuk.
//
// Sekarang admin MENYATAKAN apa yang sedang ia impor — periode, dan untuk
// foto satu jenis — lalu tiap berkas diadu dengan pernyataan itu. Nama berkas
// tetap satu-satunya sumber pemetaan ke pelanggan (`periode_tipe_nomor.ext`,
// dibentuk aplikasi petugas), tapi ia kini harus SETUJU dengan formulirnya.
// Tidak cocok pola, atau cocok tapi beda periode/jenis = DILAPORKAN dengan
// alasan yang menyebut selisihnya. Tidak ada lagi berkas yang hilang diam.
//
// Urutan pemakaian: catatan (CSV) DULU, baru foto.
//  - catatan → MEMBUAT LaporanHarianPetugas lewat simpanLaporan() yang sama
//    dengan /batch (idempoten: P2002 → DUPLIKAT). Sumber angka stand/kondisi.
//  - foto/video → MELAMPIRKAN URL ke pembacaan yang SUDAH ADA pada
//    (nomorLangganan, periode). Belum ada induknya → TANPA_PENCATATAN, bukan
//    gagal: impor catatannya lebih dulu lalu ulangi.
import JSZip from "jszip"
import { prisma } from "@db"
import {
  BadRequestError,
  ConflictError,
  isPrismaKnownError,
} from "../../../lib/Galat"
import { simpanBerkas, BerkasTidakValidError } from "../../../lib/Penyimpanan"
import type { SessionUser } from "../../../lib/Sesi"
import {
  TIPE_FOTO,
  createSchema,
  imporFotoSchema,
  imporCatatanSchema,
  type JenisFoto,
  type TipeImpor,
} from "./LaporanHarian.schema"
import { simpanLaporan } from "./LaporanHarianSimpan.service"

export const IMPOR_MAKS_ZIP_BYTE = 80 * 1024 * 1024
export const IMPOR_MAKS_ENTRI = 5000

// Dikunci ke JenisFoto (bukan Record<string, …>): dengan kunci berhingga,
// pencarian FIELD_URL_FOTO[jenis] TOTAL — tidak bisa menghasilkan undefined
// yang diam-diam jadi nama kolom `undefined` saat dipakai sebagai computed
// property di updateMany.
export const FIELD_URL_FOTO: Record<
  JenisFoto,
  "fotoStandUrl" | "fotoSegelUrl" | "fotoRumahUrl" | "videoUrl"
> = {
  stand: "fotoStandUrl",
  segel: "fotoSegelUrl",
  rumah: "fotoRumahUrl",
  video: "videoUrl",
}
// `periode_tipe_nomor.ext` pada nama-dasar berkas (abaikan prefix folder ZIP).
export const POLA_FOTO =
  /(?:^|\/)(\d{6})_(stand|segel|rumah|video)_(\d{6,20})\.(jpe?g|png|webp|mp4)$/i

export type StatusImpor =
  "TERSIMPAN" | "DUPLIKAT" | "DILAMPIRKAN" | "TANPA_PENCATATAN" | "GAGAL"

export interface BarisHasil {
  index: number
  jenis: TipeImpor
  nomorLangganan: string
  periode: number
  status: StatusImpor
  id?: string
  pesan?: string
}

/// Entri sumber terunifikasi: berasal dari file lepasan atau isi ZIP.
export interface EntriImpor {
  nama: string
  buffer: () => Promise<ArrayBuffer>
  teks: () => Promise<string>
}

/// Pengurai CSV RFC-4180 ringkas (tangani kutip, koma dalam kutip, CRLF).
export function uraiCsv(teks: string): string[][] {
  const rows: string[][] = []
  let field = ""
  let row: string[] = []
  let inQ = false
  for (let i = 0; i < teks.length; i++) {
    const ch = teks[i]
    if (inQ) {
      if (ch === '"') {
        if (teks[i + 1] === '"') {
          field += '"'
          i++
        } else inQ = false
      } else field += ch
      continue
    }
    if (ch === '"') inQ = true
    else if (ch === ",") {
      row.push(field)
      field = ""
    } else if (ch === "\r") {
      /* abaikan */
    } else if (ch === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else field += ch
  }
  if (field.length || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((r) => r.some((v) => v.trim() !== ""))
}

/// Kumpulkan entri sumber dari field `berkas`: berkas lepasan apa adanya, ZIP
/// di-flatten. Dipakai kedua pintu impor.
export async function kumpulkanEntri(form: FormData): Promise<EntriImpor[]> {
  const berkasMasuk = form
    .getAll("berkas")
    .filter((f): f is File => f instanceof File)
  if (berkasMasuk.length === 0)
    throw new BadRequestError(
      "Lampirkan minimal satu berkas di field `berkas`."
    )

  const entri: EntriImpor[] = []
  let totalByte = 0
  for (const f of berkasMasuk) {
    totalByte += f.size
    if (totalByte > IMPOR_MAKS_ZIP_BYTE)
      throw new BadRequestError("Total ukuran unggahan melebihi 80 MB.")
    const isZip =
      f.name.toLowerCase().endsWith(".zip") || f.type.includes("zip")
    if (!isZip) {
      entri.push({
        nama: f.name,
        buffer: () => f.arrayBuffer(),
        teks: () => f.text(),
      })
      continue
    }
    let zip: JSZip
    try {
      zip = await JSZip.loadAsync(await f.arrayBuffer())
    } catch {
      throw new BadRequestError(`Berkas "${f.name}" bukan ZIP yang valid.`)
    }
    for (const jalur of Object.keys(zip.files)) {
      const item = zip.files[jalur]
      // `item` dijaga eksplisit: JSZip.files bertipe indeks, jadi kunci hasil
      // Object.keys pun tetap bisa bertipe undefined bagi TS.
      if (!item || item.dir) continue
      // Sampah metadata (__MACOSX/, berkas titik) ikut terbawa saat admin
      // mem-ZIP lewat Finder. Itu bukan kiriman petugas, jadi ia dilewati
      // diam-diam — satu-satunya hal yang MASIH boleh dilewati diam-diam,
      // karena melaporkannya sebagai gagal justru menutupi kegagalan asli.
      const dasar = jalur.split("/").pop() ?? jalur
      if (jalur.startsWith("__MACOSX/") || dasar.startsWith(".")) continue
      entri.push({
        nama: jalur,
        buffer: () => item.async("arraybuffer"),
        teks: () => item.async("string"),
      })
    }
  }
  if (entri.length > IMPOR_MAKS_ENTRI)
    throw new BadRequestError(
      `Terlalu banyak berkas (maks ${IMPOR_MAKS_ENTRI}).`
    )
  return entri
}

export function ringkasImpor(hasil: BarisHasil[]) {
  const hitung = (s: StatusImpor) => hasil.filter((h) => h.status === s).length
  return {
    total: hasil.length,
    tersimpan: hitung("TERSIMPAN"),
    duplikat: hitung("DUPLIKAT"),
    dilampirkan: hitung("DILAMPIRKAN"),
    tanpaPencatatan: hitung("TANPA_PENCATATAN"),
    gagal: hitung("GAGAL"),
    hasil,
  }
}

// ── Pintu 1: FOTO / VIDEO ──────────────────────────────────────────────
// Satu jenis per unggahan. Admin memilih "foto stand periode 202607", lalu
// setiap berkas diadu dengan pernyataan itu sebelum menyentuh Cloudinary.
export async function imporFotoLaporanHarian(form: FormData) {
  const { periode, jenis } = imporFotoSchema.parse({
    periode: form.get("periode"),
    jenis: form.get("jenis"),
  })
  const entri = await kumpulkanEntri(form)

  const hasil: BarisHasil[] = []
  let idx = 0
  for (const e of entri) {
    const dasar = e.nama.split("/").pop() ?? e.nama
    const m = POLA_FOTO.exec(e.nama)
    if (!m) {
      hasil.push({
        index: idx++,
        jenis,
        nomorLangganan: "?",
        periode,
        status: "GAGAL",
        pesan: `"${dasar}" tidak mengikuti pola periode_tipe_nomor.ext — tidak ada nomor langganan yang bisa dipetakan.`,
      })
      continue
    }
    const periodeBerkas = Number(m[1])
    const jenisBerkas = TIPE_FOTO.find((t) => t === m[2]!.toLowerCase())
    const nomor = m[3]!
    const identitas = {
      index: idx++,
      jenis,
      nomorLangganan: nomor,
      periode: periodeBerkas,
    }

    // Nama berkas HARUS setuju dengan formulir. Inilah gunanya menyebut
    // periode & jenis di depan: sekantong foto yang tercampur dari periode
    // lain berhenti di sini, bukan menyelinap masuk ke periode yang kebetulan
    // tertulis di namanya.
    if (periodeBerkas !== periode) {
      hasil.push({
        ...identitas,
        status: "GAGAL",
        pesan: `Berkas ini periode ${periodeBerkas}, sedang mengimpor ${periode}.`,
      })
      continue
    }
    if (jenisBerkas !== jenis) {
      hasil.push({
        ...identitas,
        status: "GAGAL",
        pesan: `Berkas ini foto ${jenisBerkas}, sedang mengimpor ${jenis}.`,
      })
      continue
    }

    try {
      const buf = await e.buffer()
      const berkasFoto = new File(
        [buf],
        `${periode}_${jenis}_${nomor}.${jenis === "video" ? "mp4" : "jpg"}`,
        {
          type: jenis === "video" ? "video/mp4" : "image/jpeg",
        }
      )
      let url: string
      try {
        const simpan = await simpanBerkas(berkasFoto, {
          prefix: "laporan-harian",
          namaBerkas: `${periode}_${jenis}_${nomor}`,
          subFolder: `${periode}`,
          jenisMedia: jenis === "video" ? "video" : "foto",
        })
        url = simpan.url
      } catch (err) {
        if (err instanceof BerkasTidakValidError) {
          hasil.push({
            ...identitas,
            status: "GAGAL",
            pesan: "Berkas foto/video rusak atau tak dikenal.",
          })
          continue
        }
        throw err
      }
      // Lampirkan ke pembacaan yang ada — tanpa membuat baris baru.
      const upd = await prisma.laporanHarianPetugas.updateMany({
        where: { nomorLangganan: nomor, periode },
        data: { [FIELD_URL_FOTO[jenis]]: url },
      })
      hasil.push(
        upd.count > 0
          ? { ...identitas, status: "DILAMPIRKAN" }
          : {
              ...identitas,
              status: "TANPA_PENCATATAN",
              pesan:
                "Belum ada pencatatan periode ini — impor catatannya dulu.",
            }
      )
    } catch (err) {
      console.error("[impor/foto] gagal:", identitas, err)
      hasil.push({
        ...identitas,
        status: "GAGAL",
        pesan: "Terjadi kesalahan memproses berkas ini.",
      })
    }
  }

  return ringkasImpor(hasil)
}

// ── Pintu 2: CATATAN (CSV) ─────────────────────────────────────────────
// Sumber angka stand/kondisi; inilah yang MEMBUAT baris pembacaan, jadi ia
// harus diimpor lebih dulu sebelum fotonya punya induk untuk dilampiri.
export async function imporCatatanLaporanHarian(
  form: FormData,
  requester: SessionUser
) {
  const { periode } = imporCatatanSchema.parse({
    periode: form.get("periode"),
  })
  const entri = await kumpulkanEntri(form)

  const entriCsv = entri.filter((e) => /\.csv$/i.test(e.nama))
  if (entriCsv.length === 0) {
    throw new BadRequestError(
      "Tidak ada berkas CSV di unggahan ini. Catatan pencatatan diekspor aplikasi sebagai `<periode>_catatan.csv`."
    )
  }

  const pencatat = await prisma.pencatat.findUnique({
    where: { userId: requester.id },
    select: { id: true },
  })
  const pencatatIdDefault = pencatat?.id ?? null

  const hasil: BarisHasil[] = []
  let idx = 0
  for (const e of entriCsv) {
    let baris: string[][]
    try {
      baris = uraiCsv(await e.teks())
    } catch {
      hasil.push({
        index: idx++,
        jenis: "catatan",
        nomorLangganan: "?",
        periode,
        status: "GAGAL",
        pesan: `CSV "${e.nama}" gagal dibaca.`,
      })
      continue
    }
    const [barisHeader, ...isiCsv] = baris
    if (!barisHeader || isiCsv.length === 0) continue
    const header = barisHeader.map((h) => h.trim())

    for (const kolom of isiCsv) {
      const obj: Record<string, string> = {}
      header.forEach((h, i) => {
        const v = (kolom[i] ?? "").trim()
        if (v !== "") obj[h] = v
      })
      const nomorLangganan = obj.nomorLangganan ?? ""
      // Kolom periode boleh kosong — formulir yang menentukan. Tapi kalau
      // diisi, ia HARUS sama: satu CSV periode lain tidak boleh menumpang di
      // unggahan ini hanya karena admin salah pilih berkas.
      const periodeBaris = obj.periode ? Number(obj.periode) : periode
      const identitas = {
        index: idx++,
        jenis: "catatan" as const,
        nomorLangganan,
        periode: periodeBaris,
      }
      if (periodeBaris !== periode) {
        hasil.push({
          ...identitas,
          status: "GAGAL",
          pesan: `Baris ini periode ${periodeBaris}, sedang mengimpor ${periode}.`,
        })
        continue
      }

      // isSegel di CSV berupa teks "true"/"false"; createSchema mengharap
      // boolean asli (bukan z.coerce), jadi dikonversi sebelum validasi.
      const input: Record<string, unknown> = { ...obj, periode }
      if ("isSegel" in obj)
        input.isSegel = obj.isSegel === "true" || obj.isSegel === "1"
      // CSV aplikasi MEMBAWA pelangganId (kolomnya ada di backup.ts), tapi
      // CSV yang disusun tangan kerap tidak — maka nomorLangganan dipakai
      // sebagai cadangan supaya barisnya tetap tertaut ke pelanggan (snapshot
      // nama/alamat, jarak GPS, alur verifikasi) alih-alih jadi orphan.
      if (!input.pelangganId && nomorLangganan) {
        const p = await prisma.pelanggan.findFirst({
          where: { nomorLangganan, deletedAt: null },
          select: { id: true },
        })
        if (p) input.pelangganId = p.id
      }

      const parsed = createSchema.safeParse(input)
      if (!parsed.success) {
        hasil.push({
          ...identitas,
          status: "GAGAL",
          pesan: "Baris catatan tidak valid / stand tidak lengkap.",
        })
        continue
      }
      try {
        const row = await simpanLaporan(parsed.data, pencatatIdDefault)
        hasil.push({ ...identitas, status: "TERSIMPAN", id: row.id })
      } catch (err) {
        if (err instanceof ConflictError) {
          hasil.push({
            ...identitas,
            status: "DUPLIKAT",
            pesan: err.message,
          })
        } else if (isPrismaKnownError(err) && err.code === "P2002") {
          hasil.push({
            ...identitas,
            status: "DUPLIKAT",
            pesan: "Pembacaan periode ini sudah ada.",
          })
        } else if (isPrismaKnownError(err) && err.code === "P2003") {
          hasil.push({
            ...identitas,
            status: "GAGAL",
            pesan: "Referensi pelanggan/pencatat tidak valid.",
          })
        } else {
          console.error("[impor/catatan] gagal:", identitas, err)
          hasil.push({
            ...identitas,
            status: "GAGAL",
            pesan: "Terjadi kesalahan menyimpan baris ini.",
          })
        }
      }
    }
  }

  return ringkasImpor(hasil)
}
