"use server"

// features/dashboard/actions/anomali.ts — detail satu sambungan, diambil saat
// barisnya diklik.
//
// KENAPA SERVER ACTION, BUKAN fetch KE /api/v1/anomali/:id/riwayat:
// alasan yang sama seperti features/dashboard/lib/queries.ts — halaman ini
// dirender di server yang SAMA dengan API-nya, jadi perjalanan HTTP ke diri
// sendiri hanya menambah latensi, memaksa meneruskan cookie sesi manual, dan
// butuh URL absolut yang berbeda antara dev dan produksi. Endpoint HTTP-nya
// tetap ada dan tetap dipakai aplikasi petugas.
//
// KENAPA TIDAK IKUT DIMUAT DI SERVER SEJAK AWAL: detail berisi seluruh
// riwayat pembacaan + kunjungan per sambungan. Memuatnya untuk 300 baris
// sekaligus berarti ratusan query untuk satu baris yang akhirnya dibuka.
//
// CATATAN: setiap fungsi async yang di-export dari file "use server" menjadi
// endpoint yang bisa dipanggil dari browser — jadi hanya server action yang
// boleh di-export dari sini, dan masing-masing WAJIB memeriksa sesinya
// sendiri. Tidak ada middleware yang menjaganya.
import { auth } from "@/lib/auth"
import {
  daftarAnomali,
  riwayatSambungan,
  type OpsiDaftar,
} from "@server/modules/anomali"
import { SEMUA_KATEGORI, type KategoriAnomali } from "@/lib/domain/anomali"

export type RiwayatSambungan = NonNullable<Awaited<ReturnType<typeof riwayatSambungan>>>

export type HasilRiwayat =
  | { status: "ok"; data: RiwayatSambungan }
  | { status: "tidak-berwenang" }
  | { status: "tidak-ditemukan" }
  | { status: "galat"; pesan: string }

/// Penjaga yang SAMA untuk setiap action di berkas ini. Diekstrak supaya
/// menambah action baru tidak bisa diam-diam lupa memeriksanya.
async function berwenang(): Promise<boolean> {
  const session = await auth()
  // Sejajar dengan (dashboard)/layout.tsx: role USER adalah akun warga lewat
  // /daftar, bukan staf — data lapangan bukan miliknya.
  return session?.user != null && session.user.role !== "USER"
}

export interface FilterAnomali {
  q: string
  kategori: KategoriAnomali | "SEMUA"
  /// Satu kondisi catat saja ("DK", "TERHALANG", …) atau "" = semua kondisi
  /// dalam kategori terpilih. Kategori mengelompokkan menurut TINDAKAN, jadi
  /// satu kategori memuat beberapa kondisi — tanpa saringan ini, "tampilkan
  /// yang DK saja" tidak bisa dijawab layar ini sama sekali.
  kondisi: string
  hanyaPrioritas: boolean
  sembunyikanSudahDikunjungi: boolean
  kelurahan: string
  ambangBulan: number
  urutan: "paparan" | "rute"
  /// Berapa baris yang benar-benar dikirim ke browser. Penyaringnya berjalan
  /// di server atas SELURUH daftar, jadi ini murni soal berapa yang sanggup
  /// dirender — memilih satu kategori bisa berarti 4.000-an baris, dan
  /// menaruh semuanya di DOM membuat halaman tersendat tanpa ada yang
  /// membacanya. Jumlah seutuhnya tetap dilaporkan lewat `total`.
  batas: number
}

/// Sejajar dengan PILIHAN_UKURAN di toolbar-verifikasi.
const BATAS_MAKS = 5000

export type HasilDaftar =
  | {
      status: "ok"
      total: number
      prioritas: number
      perKategori: Record<KategoriAnomali, number>
      baris: Awaited<ReturnType<typeof daftarAnomali>>
    }
  | { status: "tidak-berwenang" }
  | { status: "galat"; pesan: string }

/// Daftar anomali dengan penyaring yang BENAR-BENAR diterapkan di server.
///
/// Sebelumnya halaman ini menyaring 300 baris pertama di browser sementara
/// penghitung kategorinya dihitung dari seluruh data — sehingga kategori
/// bertuliskan 1.200 hanya sanggup menampilkan 300, dan sambungan yang dicari
/// bisa saja tidak pernah ikut terkirim sejak awal.
export async function cariAnomaliAction(filter: FilterAnomali): Promise<HasilDaftar> {
  if (!(await berwenang())) return { status: "tidak-berwenang" }

  const opsi: OpsiDaftar = {
    ambangBulan: Number.isFinite(filter.ambangBulan) ? filter.ambangBulan : undefined,
    kategori: filter.kategori === "SEMUA" ? undefined : filter.kategori,
    kondisi: filter.kondisi || undefined,
    hanyaPrioritas: filter.hanyaPrioritas || undefined,
    sembunyikanSudahDikunjungi: filter.sembunyikanSudahDikunjungi || undefined,
    q: filter.q.trim() || undefined,
    kelurahan: filter.kelurahan.trim() || undefined,
    urutan: filter.urutan,
  }

  try {
    // Penghitung per kategori dihitung dari hasil TANPA saringan kategori
    // MAUPUN kondisi, supaya ubin di atas tetap menunjukkan sebaran
    // sesungguhnya alih-alih memperlihatkan nol untuk kategori yang sedang
    // tidak dipilih. (Kondisi ikut dilepas: ia saringan yang lebih sempit
    // lagi — menyaring "DK" akan membuat ubin TERKUNCI melaporkan jumlah DK
    // saja, dan dua angka yang berbeda arti tampil dengan bentuk yang sama.)
    const adaSaringanKategori = filter.kategori !== "SEMUA" || filter.kondisi !== ""
    const [baris, semua] = await Promise.all([
      daftarAnomali(opsi),
      adaSaringanKategori
        ? daftarAnomali({ ...opsi, kategori: undefined, kondisi: undefined })
        : Promise.resolve(null),
    ])
    const dasar = semua ?? baris
    const batas = Math.min(
      Math.max(Number.isFinite(filter.batas) ? filter.batas : 300, 1),
      BATAS_MAKS
    )

    return {
      status: "ok",
      // `total` = jumlah SEUTUHNYA yang cocok, bukan yang dikirim. Keduanya
      // dibedakan supaya layar bisa berkata jujur "300 dari 4.153" alih-alih
      // membiarkan orang mengira itulah seluruh isinya.
      total: baris.length,
      prioritas: dasar.filter((b) => b.prioritas).length,
      perKategori: Object.fromEntries(
        SEMUA_KATEGORI.map((k) => [k, dasar.filter((b) => b.kategori === k).length])
      ) as Record<KategoriAnomali, number>,
      baris: baris.slice(0, batas),
    }
  } catch (e) {
    console.error("[anomali] gagal memuat daftar", e)
    return { status: "galat", pesan: "Daftar gagal dimuat. Coba lagi." }
  }
}

export async function ambilRiwayatSambunganAction(pelangganId: string): Promise<HasilRiwayat> {
  if (!(await berwenang())) return { status: "tidak-berwenang" }

  if (typeof pelangganId !== "string" || pelangganId.length === 0) {
    return { status: "tidak-ditemukan" }
  }

  try {
    const data = await riwayatSambungan(pelangganId)
    if (!data) return { status: "tidak-ditemukan" }
    return { status: "ok", data }
  } catch (e) {
    // Pesan aslinya bisa memuat detail koneksi database; yang sampai ke
    // browser cukup yang bisa ditindaklanjuti pemakainya.
    console.error("[anomali] gagal memuat riwayat sambungan", e)
    return { status: "galat", pesan: "Riwayat gagal dimuat. Coba lagi." }
  }
}
