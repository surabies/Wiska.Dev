"use client"

// features/publik/components/lapor-meter-form.tsx
//
// Alur: ketik nomor langganan (11 digit) -> pratinjau identitas dicari
// otomatis lewat GET /api/public/pelanggan/:nomorLangganan (lookup SATU
// pelanggan exact-match, bukan pencarian sebagian — lihat catatan di
// server/modules/publik/publik.router.ts). Begitu pelanggan ketemu, field
// stand meter/foto/pelapor baru ditampilkan. TIDAK ada field nama pelanggan
// di sini — lihat catatan keputusan produk di server/modules/publik/verifikasi.ts.
import * as React from "react"
import { CheckCircle2, AlertCircle, Upload, CalendarClock } from "@/components/ui/hugeicons-compat"
import { jendelaLaporMandiri } from "@/lib/domain/lapor-mandiri"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { cariPelanggan, laporMeter, ApiError, type PelangganPratinjau } from "../lib/api"
import { formatPeriode } from "../lib/format"
import { PemilihFoto } from "./pemilih-foto"
import { LaporMeterSukses, type HasilLaporanTampilan } from "./lapor-meter-sukses"
import { InputNomorLangganan } from "./input-nomor-langganan"
import { TombolUtama } from "./tombol-utama"

export function LaporMeterForm() {
  const [nomorLangganan, setNomorLangganan] = React.useState("")
  const [pratinjau, setPratinjau] = React.useState<PelangganPratinjau | null>(null)
  const [cariPending, setCariPending] = React.useState(false)
  const [cariError, setCariError] = React.useState<string | null>(null)
  const pencarianTerbaru = React.useRef(0)

  const [standInput, setStandInput] = React.useState("")
  const [fotoFile, setFotoFile] = React.useState<File | null>(null)
  const [fotoPreviewUrl, setFotoPreviewUrl] = React.useState<string | null>(null)
  const [namaPelapor, setNamaPelapor] = React.useState("")
  const [nomorPelapor, setNomorPelapor] = React.useState("")

  const [kirimError, setKirimError] = React.useState<string | null>(null)
  const [kirimPending, setKirimPending] = React.useState(false)
  const [hasil, setHasil] = React.useState<HasilLaporanTampilan | null>(null)

  React.useEffect(() => {
    return () => {
      if (fotoPreviewUrl) URL.revokeObjectURL(fotoPreviewUrl)
    }
  }, [fotoPreviewUrl])

  const cari = React.useCallback(async (nomor: string) => {
    const id = ++pencarianTerbaru.current
    setCariError(null)
    setPratinjau(null)
    setCariPending(true)
    try {
      const hasil = await cariPelanggan(nomor)
      if (id === pencarianTerbaru.current) setPratinjau(hasil)
    } catch (err) {
      if (id === pencarianTerbaru.current) setCariError(err instanceof ApiError ? err.message : "Gagal mencari nomor pelanggan.")
    } finally {
      if (id === pencarianTerbaru.current) setCariPending(false)
    }
  }, [])

  // Auto-cari begitu nomor genap 11 digit — dipicu langsung dari event
  // handler (bukan useEffect yang memantau state): mengikuti pola yang
  // sudah dipakai cek-tagihan-form.tsx, dan menghindari setState sinkron di
  // dalam efek (react-hooks/set-state-in-effect).
  function onNomorChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 11)
    setNomorLangganan(digits)
    if (digits.length === 11) {
      cari(digits)
    } else {
      pencarianTerbaru.current++ // batalkan pencarian yang sedang berjalan
      setPratinjau(null)
      setCariError(null)
      setCariPending(false)
    }
  }

  function pilihFoto(file: File, url: string) {
    setFotoFile(file)
    setFotoPreviewUrl((lama) => {
      if (lama) URL.revokeObjectURL(lama)
      return url
    })
  }

  function hapusFoto() {
    setFotoFile(null)
    setFotoPreviewUrl((lama) => {
      if (lama) URL.revokeObjectURL(lama)
      return null
    })
  }

  async function kirim() {
    if (!pratinjau) return
    if (!standInput || Number.isNaN(Number(standInput))) return setKirimError("Stand meter harus berupa angka.")
    if (!fotoFile || !fotoPreviewUrl) return setKirimError("Foto stand meter wajib dilampirkan sebagai bukti.")
    if (!namaPelapor.trim()) return setKirimError("Nama pelapor wajib diisi.")
    if (!nomorPelapor.trim()) return setKirimError("Nomor HP pelapor wajib diisi.")

    setKirimError(null)
    setKirimPending(true)
    try {
      const form = new FormData()
      form.set("nomorLangganan", pratinjau.nomorLangganan)
      form.set("standDilaporkan", standInput)
      form.set("foto", fotoFile)
      form.set("nomorPelapor", nomorPelapor.trim())
      form.set("namaPelapor", namaPelapor.trim())

      // Respons server DIPAKAI (bukan dibuang) untuk layar sukses di bawah:
      // status & createdAt di situ adalah konfirmasi SUNGGUHAN dari server,
      // bukan echo dari apa yang baru saja diketik warga sendiri — itulah
      // yang membuat layar sukses terasa seperti tanda terima asli.
      const respons = await laporMeter(form)
      setHasil({
        nomorLangganan: pratinjau.nomorLangganan,
        nama: pratinjau.nama,
        periodeLabel: formatPeriode(pratinjau.periodeBerjalan),
        stand: Number(standInput),
        fotoPreviewUrl,
        status: respons.status,
        createdAt: respons.createdAt,
        pesan: respons.pesan,
      })
    } catch (err) {
      setKirimError(err instanceof ApiError ? err.message : "Terjadi kesalahan. Coba lagi.")
    } finally {
      setKirimPending(false)
    }
  }

  function reset() {
    setNomorLangganan("")
    setPratinjau(null)
    setStandInput("")
    hapusFoto()
    setNamaPelapor("")
    setNomorPelapor("")
    setKirimError(null)
    setHasil(null)
  }

  if (hasil) return <LaporMeterSukses hasil={hasil} onReset={reset} />

  // Dihitung di sini, bukan diambil dari server, supaya pemberitahuannya
  // muncul SEKETIKA tanpa kedipan "memuat" — modul domainnya murni, jadi
  // hasilnya sama persis dengan yang dipakai server. Yang MENEGAKKAN aturan
  // tetap server (POST /publik/lapor-meter menolak duluan); ini hanya
  // menyelamatkan warga dari mengisi formulir dan mengunggah foto untuk
  // sesuatu yang pasti ditolak. Kalau jam perangkatnya meleset jauh, pesan
  // dari server yang muncul — kalimatnya sama.
  const jendela = jendelaLaporMandiri()

  // `bisaKirimUlang` dari server, BUKAN `!sudahLaporBulanIni`: laporan yang
  // DITOLAK tetap "sudah ada" tapi tidak mengunci bulan berjalan — lihat
  // GET /pelanggan/:nomorLangganan di server/modules/publik/publik.router.ts.
  const bisaLapor = jendela.boleh && !!pratinjau && pratinjau.bisaKirimUlang
  const perluKirimUlang = !!pratinjau?.sudahLaporBulanIni && pratinjau.bisaKirimUlang

  if (!jendela.boleh) {
    return (
      <div className="space-y-4">
        <Alert>
          <CalendarClock className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p className="font-medium text-foreground">
              Pelaporan meter mandiri sedang ditutup
            </p>
            <p>{jendela.pesan}</p>
          </AlertDescription>
        </Alert>
        <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Jadwal pelaporan</p>
          <p className="mt-1">
            Setiap bulan, tanggal <strong className="text-foreground">1 sampai 25</strong>. Di luar
            tanggal itu petugas sedang merampungkan pencatatan dan perhitungan rekening, sehingga
            laporan yang masuk tidak lagi bisa diperhitungkan untuk bulan berjalan.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Pengingat saat jendela HAMPIR tutup. Sengaja hanya muncul di lima hari
          terakhir: spanduk yang selalu ada akan berhenti dibaca. */}
      {jendela.sisaHari !== null && jendela.sisaHari <= 5 && (
        <Alert>
          <CalendarClock className="h-4 w-4" />
          <AlertDescription>{jendela.pesan}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-1.5">
        {/* Ketemu -> kotak nomor & tombol cari disembunyikan otomatis, sama
            seperti cek-laporan-meter-form.tsx — supaya kedua tab berperilaku
            identik begitu pelanggan ditemukan, bukan salah satu tetap
            menampilkan kotak cari dan yang lain tidak. */}
        {pratinjau ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
              {pratinjau.nama} · {pratinjau.nomorLangganan}
            </p>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              Ganti nomor
            </Button>
          </div>
        ) : (
          <InputNomorLangganan id="nomorLangganan" nomor={nomorLangganan} onNomorChange={onNomorChange} onCari={cari} pending={cariPending} />
        )}

        {pratinjau && (
          <div className="mt-4 space-y-2.5 rounded-lg border border-green-200 bg-green-100 px-3 py-3 dark:border-green-800 dark:bg-green-900/30">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              <p className="text-sm font-semibold">{pratinjau.nama}</p>
            </div>
            <div className="grid grid-cols-2 text-xs">
              <div>
                <p className="text-muted-foreground uppercase">Alamat</p>
                <p>{pratinjau.alamat}</p>
              </div>
              <div>
                <p className="text-muted-foreground uppercase">Gol. tarif</p>
                <p>{pratinjau.tarifGolongan?.kategori ?? "—"}</p>
              </div>
            </div>
          </div>
        )}

        {cariError && (
          <div className="mt-4 space-y-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-3 dark:border-red-900 dark:bg-red-900/20">
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-destructive" />
              <p className="text-sm font-semibold text-destructive">{cariError}</p>
            </div>
          </div>
        )}

        {/* Laporan lama yang DITOLAK: yang perlu warga lihat bukan "sudah
            lapor", melainkan APA yang salah dan bahwa mereka boleh — dan
            memang diminta — mengirim ulang. */}
        {pratinjau && perluKirimUlang && (
          <div className="mt-4 space-y-1 rounded-lg bg-amber-500/10 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
              Laporan periode {formatPeriode(pratinjau.periodeBerjalan)} ditolak petugas
              {pratinjau.alasanDitolak ? `: ${pratinjau.alasanDitolak}` : "."}
            </p>
            <p className="text-xs text-amber-700/90 dark:text-amber-400/90">
              Silakan perbaiki dan kirim ulang di bawah — foto baru Anda akan menggantikan foto sebelumnya.
            </p>
          </div>
        )}

        {pratinjau?.sudahLaporBulanIni && !perluKirimUlang && (
          <div className="mt-4 rounded-lg bg-amber-500/10 px-3 py-2.5">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
              Laporan periode {formatPeriode(pratinjau.periodeBerjalan)} sudah ada (status: {pratinjau.statusLaporanBulanIni}). Satu laporan per bulan.
            </p>
          </div>
        )}
      </div>

      {pratinjau && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="standDilaporkan">Angka stand meter (m³)</Label>
            <Input
              id="standDilaporkan"
              value={standInput}
              onChange={(e) => setStandInput(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
              placeholder="Contoh: 3955"
              className="h-10 rounded-xl font-mono"
            />
            <p className="text-xs text-muted-foreground">Isi sesuai angka hitam yang tertera di meter air, tanpa titik atau koma.</p>
          </div>

          <PemilihFoto
            previewUrl={fotoPreviewUrl}
            onPilih={pilihFoto}
            onHapus={hapusFoto}
            onError={setKirimError}
            label="Foto stand meter"
            deskripsi="Pastikan angka pada meter terlihat jelas dan tidak buram."
            disabled={kirimPending}
          />

          <div className="space-y-3">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Data pelapor</Label>
            <div className="space-y-1">
              <Input placeholder="Nama lengkap" value={namaPelapor} onChange={(e) => setNamaPelapor(e.target.value)} className="h-10 rounded-xl" />
              <p className="text-xs text-muted-foreground">Boleh berbeda dari nama pelanggan, mis. anggota keluarga.</p>
            </div>
            <div className="space-y-1">
              <Input
                placeholder="0812…"
                value={nomorPelapor}
                onChange={(e) => setNomorPelapor(e.target.value.replace(/\D/g, "").slice(0, 14))}
                inputMode="tel"
                className="h-10 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Nomor HP/WhatsApp aktif untuk dihubungi petugas bila diperlukan.</p>
            </div>
          </div>
        </>
      )}

      {kirimError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{kirimError}</AlertDescription>
        </Alert>
      )}

      {/* `nonaktif`: status "terkunci" (sudah lapor bulan ini / jendela
          tertutup) sengaja tampil datar tanpa cincin — lihat catatan di
          TombolUtama soal kenapa kilau tidak boleh menyiratkan tombol ini
          bisa ditekan padahal terkunci untuk alasan lain, bukan sekadar
          menunggu input. `kirimPending` BUKAN alasan itu (permintaan sedang
          berjalan, tombolnya akan bisa ditekan lagi) — cincinnya tetap ada,
          cuma isinya berubah jadi spinner. */}
      {pratinjau && (
        <TombolUtama onClick={kirim} disabled={kirimPending} nonaktif={!bisaLapor} className="h-12 w-full">
          {kirimPending ? <Spinner className="size-4" /> : <Upload />}
          {kirimPending ? "Mengirim…" : perluKirimUlang ? "Kirim ulang laporan" : "Kirim laporan"}
        </TombolUtama>
      )}
    </div>
  )
}
