// features/publik/lib/api.ts — klien untuk /api/public/*.
//
// SATU-SATUNYA tempat frontend publik memanggil backend. Tujuannya bukan
// kerapian semata: bentuk envelope respons ({success, data} / {success,
// error}) didefinisikan backend di server/lib/response.ts & errors.ts, dan
// kalau setiap komponen mem-parsing sendiri, satu perubahan di backend akan
// merusak banyak tempat diam-diam. Di sini kontrak itu diterjemahkan SEKALI
// menjadi "kembalikan data" atau "lempar ApiError".
//
// Dipanggil dari komponen client (fetch di browser), bukan server action,
// karena endpoint publik memang dirancang untuk dipanggil langsung dan
// rate limit-nya berbasis IP pemakai — kalau lewat server action, semua
// request akan terlihat berasal dari IP server.

export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details?: Array<{ path: string; message: string }>

  constructor(status: number, code: string, message: string, details?: Array<{ path: string; message: string }>) {
    super(message)
    this.code = code
    this.status = status
    this.details = details
  }
}

interface EnvelopeSukses<T> {
  success: true
  data: T
}
interface EnvelopeError {
  success: false
  error: { code: string; message: string; details?: Array<{ path: string; message: string }> }
}

async function tangani<T>(res: Response): Promise<T> {
  let body: EnvelopeSukses<T> | EnvelopeError
  try {
    body = await res.json()
  } catch {
    // Bukan JSON = kegagalan di luar dugaan (proxy/gateway down). Jangan
    // tampilkan HTML mentah ke pengguna.
    throw new ApiError(res.status, "NETWORK", "Gagal menghubungi server. Periksa koneksi Anda dan coba lagi.")
  }

  if (!res.ok || !body.success) {
    const err = (body as EnvelopeError).error
    throw new ApiError(res.status, err?.code ?? "UNKNOWN", err?.message ?? "Terjadi kesalahan.", err?.details)
  }

  return body.data
}

async function postJson<T>(path: string, payload: unknown): Promise<T> {
  const res = await fetch(`/api/public${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  return tangani<T>(res)
}

// ============================================================
// Tipe respons — cerminan persis apa yang dikembalikan
// server/modules/publik/publik.router.ts. Kalau backend berubah, ubah di
// sini juga; ini kontraknya.
// ============================================================

export interface TarifGolonganPublik {
  kodeAsli: string
  kategori: string
}

export interface TagihanPublik {
  periode: number
  pemakaianM3: number
  jmlHargaAir: number
  beaBeban: number
  beaAdmin: number
  airKotor: number
  lainLain: number
  denda: number
  totalTagihan: number
  status: "BELUM_BAYAR" | "SUDAH_BAYAR" | "JATUH_TEMPO" | "DIHAPUSKAN"
  tanggalJatuhTempo: string
  tanggalBayar: string | null
  standLalu: number | null
  standAkhir: number | null
}

export interface PelangganPublik {
  nomorLangganan: string
  nama: string
  alamat: string
  rt: string | null
  rw: string | null
  status: string
  tarifGolongan: TarifGolonganPublik | null
}

export interface HasilCekTagihan {
  pelanggan: PelangganPublik
  tagihan: TagihanPublik[]
  totalTunggakan: number
}

// Hanya nomorLangganan — cek-tagihan TIDAK lagi mensyaratkan nama, lihat
// catatan keputusan produk di server/modules/publik/verifikasi.ts.
export function cekTagihan(input: { nomorLangganan: string }) {
  return postJson<HasilCekTagihan>("/cek-tagihan", input)
}

export interface DetailLaporanBulanIni {
  periode: number
  standDilaporkan: number
  fotoUrl: string
  status: string
  alasanDitolak: string | null
  createdAt: string
  verifiedAt: string | null
  /// Ketiganya HANYA terisi setelah petugas memverifikasi (status DIGUNAKAN):
  /// pemakaianM3 = standAkhir - standLalu, dihitung server saat verifikasi
  /// (PembacaanMeter resmi), bukan ditebak dari standDilaporkan sendirian.
  standLalu: number | null
  standAkhir: number | null
  pemakaianM3: number | null
}

export interface PelangganPratinjau extends PelangganPublik {
  periodeBerjalan: number
  sudahLaporBulanIni: boolean
  statusLaporanBulanIni: string | null
  /// Boleh kirim (atau kirim ULANG) untuk periode berjalan. Laporan yang
  /// DITOLAK tidak mengunci bulan berjalan — warga justru diminta memotret
  /// ulang. Dihitung server; jangan disimpulkan sendiri dari status.
  bisaKirimUlang: boolean
  /// Alasan penolakan laporan terakhir, hanya terisi saat statusnya DITOLAK.
  alasanDitolak: string | null
  /// Detail lengkap laporan periode berjalan (foto, stand, pemakaian) — null
  /// bila belum ada laporan bulan ini. Dipakai tab "Cek laporan" di
  /// /lapor-meter; sengaja lewat endpoint yang SAMA dengan yang menggerbangi
  /// tab "Lapor meter" (lihat cariPelanggan di bawah), bukan endpoint kedua —
  /// supaya kedua tab berbagi satu kotak cari, bukan menyimpang perlahan.
  laporanBulanIni: DetailLaporanBulanIni | null
}

/// Lookup identitas SATU pelanggan lewat nomorLangganan lengkap (exact
/// match) — dipakai kartu pratinjau "ini pelanggan Anda?" di lapor-meter
/// sebelum sisa form (stand meter, foto, pelapor) ditampilkan.
export async function cariPelanggan(nomorLangganan: string) {
  const res = await fetch(`/api/public/pelanggan/${encodeURIComponent(nomorLangganan)}`)
  return tangani<PelangganPratinjau>(res)
}

export interface HasilPengaduan {
  nomorTiket: string
  targetSelesaiAt: string | null
  pesan: string
}

export interface InputPengaduan {
  klasifikasi: string
  jenis: string
  judul: string
  deskripsi: string
  pelapor: string
  kontakPelapor: string
  alamatKejadian?: string
  nomorLangganan?: string
  koordinat?: { lat: number; lng: number }
  foto?: File | null
  /// Klip video bukti opsional (maks 60 dtk, ≤50 MB). Divalidasi di
  /// PemilihVideo sebelum sampai sini.
  video?: File | null
  /// Kunci idempotensi (UUID v4). Dibuat SEKALI saat form dibuka lalu dikirim
  /// bersama; retry/tap-ganda dengan kunci sama memulangkan tiket yang sama,
  /// bukan tiket kembar. Lihat clientRequestId di publik.router.ts.
  clientRequestId?: string
}

/// multipart, bukan JSON — foto bukti ikut. JANGAN menyetel header
/// Content-Type sendiri: browser harus menuliskannya berikut `boundary`.
///
/// Koordinat dikirim sebagai dua field skalar `lat`/`lng`, bukan objek
/// bersarang — form-data tidak punya representasi wajar untuk objek, dan
/// backend memang membacanya begitu (lihat bacaBodyPengaduan di
/// server/modules/publik/publik.router.ts).
export function kirimPengaduan(input: InputPengaduan) {
  const form = new FormData()
  form.set("klasifikasi", input.klasifikasi)
  form.set("jenis", input.jenis)
  form.set("judul", input.judul)
  form.set("deskripsi", input.deskripsi)
  form.set("pelapor", input.pelapor)
  form.set("kontakPelapor", input.kontakPelapor)
  if (input.alamatKejadian) form.set("alamatKejadian", input.alamatKejadian)
  if (input.nomorLangganan) form.set("nomorLangganan", input.nomorLangganan)
  if (input.koordinat) {
    form.set("lat", String(input.koordinat.lat))
    form.set("lng", String(input.koordinat.lng))
  }
  if (input.clientRequestId) form.set("clientRequestId", input.clientRequestId)
  if (input.foto) form.set("foto", input.foto)
  if (input.video) form.set("video", input.video)

  return fetch("/api/public/pengaduan", { method: "POST", body: form }).then((res) =>
    tangani<HasilPengaduan>(res)
  )
}

/// Ringkasan SLA — dihitung server (server/modules/pengaduan/sla.ts), bukan
/// di sini. Aturan "terlambat" adalah kebijakan layanan; menyalinnya ke
/// browser berarti dua sumber kebenaran yang pasti menyimpang.
export interface SlaTiket {
  targetResponsAt: string | null
  targetSelesaiAt: string | null
  sisaMenit: number | null
  melanggar: boolean
  responsTerlambat: boolean
  terjeda: boolean
}

export interface EntriRiwayatTiket {
  aksi: string
  statusKe: string | null
  catatan: string | null
  olehNama: string
  fotoUrl: string | null
  createdAt: string
}

export interface StatusTiket {
  nomorTiket: string
  jenis: string
  judul: string
  deskripsi: string
  alamatKejadian: string | null
  status: string
  prioritas: string
  fotoUrl: string | null
  /// Klip video bukti dari pelapor (opsional).
  videoUrl: string | null
  createdAt: string
  ditanganiMulai: string | null
  selesaiAt: string | null
  catatanPenyelesaian: string | null
  /// Foto bukti hasil pekerjaan dari petugas + batas konfirmasi pelapor —
  /// keduanya dikirim backend di GET /pengaduan/:nomorTiket.
  fotoPenyelesaianUrl: string | null
  konfirmasiBatasAt: string | null
  targetResponsAt: string | null
  responsAt: string | null
  jedaMulaiAt: string | null
  ratingKepuasan: number | null
  komentarKepuasan: string | null
  jumlahDibukaKembali: number
  /// Nama saja — backend sengaja tidak mengirim kontak/email petugas.
  ditugaskanKe: { name: string | null } | null
  riwayat: EntriRiwayatTiket[]
  sla: SlaTiket
  /// Diputuskan server dari aturan alur, supaya UI tidak perlu menyalin
  /// matriks transisi (dan menyimpang darinya).
  bisaDinilai: boolean
  bisaDibukaKembali: boolean
  /// Chat dibuka selama tiket belum DITUTUP (dipakai app mobile; web saat ini
  /// menampilkan balasan petugas lewat linimasa).
  bisaChat: boolean
}

export async function lacakTiket(nomorTiket: string) {
  const res = await fetch(`/api/public/pengaduan/${encodeURIComponent(nomorTiket)}`)
  return tangani<StatusTiket>(res)
}

export function konfirmasiTiket(nomorTiket: string, input: { rating: number; komentar?: string }) {
  return postJson<{ pesan: string }>(`/pengaduan/${encodeURIComponent(nomorTiket)}/konfirmasi`, input)
}

export function bukaKembaliTiket(nomorTiket: string, input: { alasan: string }) {
  return postJson<{ pesan: string }>(`/pengaduan/${encodeURIComponent(nomorTiket)}/buka-kembali`, input)
}

export interface HasilLaporMeter {
  periode: number
  standDilaporkan: number
  status: string
  createdAt: string
  pesan: string
}

/// multipart, bukan JSON — membawa berkas foto. JANGAN menyetel header
/// Content-Type sendiri: browser harus menuliskannya berikut `boundary`.
export async function laporMeter(form: FormData) {
  const res = await fetch("/api/public/lapor-meter", { method: "POST", body: form })
  return tangani<HasilLaporMeter>(res)
}

