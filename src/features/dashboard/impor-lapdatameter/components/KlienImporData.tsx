"use client"

// features/dashboard/components/impor/impor-data-client.tsx — IMPOR BERKAS
// SUMBER dengan pengiriman bertahap dan kemajuan yang terlihat.
//
// ALUR YANG DIJAGA: pilih berkas -> diurai & diperiksa di browser -> pengguna
// melihat ringkasannya (berapa baris, periode apa, apa yang ditolak) ->
// baru menekan Mulai. Tidak ada byte yang dikirim sebelum pengguna tahu apa
// yang akan dikirim.
//
// Pengiriman dipotong jadi batch. Tiap batch adalah permintaan tersendiri
// yang idempoten di server, sehingga: kemajuan bisa ditampilkan sungguhan
// (bukan spinner yang berputar tanpa arti), satu batch gagal tidak
// menghanguskan yang sudah masuk, dan tombol "Ulangi yang gagal" aman ditekan
// berkali-kali tanpa risiko data dobel.

import * as React from "react"
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  FileSpreadsheetIcon,
  Upload01Icon,
  Cancel01Icon,
  RotateLeft01Icon,
  UnavailableIcon,
  Folder01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Spinner } from "@/components/ui/spinner"
import { kirimJson, ApiError } from "@/features/dashboard/api/ApiDashboard"
import { usePeriodeKerja } from "@/features/dashboard/hooks/UsePeriodeKerja"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  uraiCsv,
  uraiExcel,
  petakanPencatatan,
  petakanPemutusan,
  type BarisPencatatan,
  type BarisPemutusan,
} from "../lib/ParserCSV"

/// UKURAN BATCH DITURUNKAN 1.000 → 250, dan ini perbaikan bug nyata.
///
/// Berkas 1.992 baris pernah masuk hanya 992: batch pertama (1.000 baris)
/// melampaui batas waktu fungsi serverless di deployment, permintaannya mati
/// di tengah jalan, sementara batch kedua (992 baris) lolos karena
/// fungsinya sudah panas. Yang tampil di layar hanya angka batch yang
/// menjawab — 1.000 baris sisanya lenyap tanpa satu baris keterangan.
///
/// 250 baris menyelesaikan satu batch jauh di bawah batas itu bahkan saat
/// fungsinya baru bangun. Ongkosnya: empat kali lebih banyak permintaan —
/// murah dibandingkan impor yang diam-diam separuh jalan. Batas server
/// (MAKS_BARIS_PER_BATCH = 1.000) sengaja TIDAK ikut diturunkan: ia pagar
/// atas, bukan ukuran kerja.
///
/// Pasangannya ada di app/api/[[...route]]/route.ts (`maxDuration`) —
/// keduanya perlu, karena batch kecil saja tidak menolong kalau batas
/// waktunya memang lebih pendek dari satu round-trip ke database.
const UKURAN_BATCH = 250

type Jenis = "pencatatan" | "pemutusan"

const JENIS_INFO: Record<
  Jenis,
  { judul: string; berkas: string; jelas: string; endpoint: string }
> = {
  pencatatan: {
    judul: "Pencatatan harian",
    berkas: "lapdatametertes.csv",
    jelas:
      "Setoran harian petugas. Masuk sebagai laporan PRA-VERIFIKASI — belum jadi angka resmi. Kenaikan jadi pembacaan resmi terjadi di verifikasi V3.",
    endpoint: "/impor/pencatatan",
  },
  pemutusan: {
    judul: "Pemutusan",
    berkas: "r-nomor.csv",
    jelas:
      "Catatan pemutusan sambungan (TSM / SPT). Sambungannya ditandai DICABUT di daftar catat periode itu — dengan begitu ia tidak ditagih bulan ini dan tidak ikut ke daftar catat bulan depan. Status PELANGGAN tidak diubah otomatis; itu keputusan yang perlu disetujui manusia lewat layar pemutusan.",
    endpoint: "/impor/pemutusan",
  },
}

interface Masalah {
  baris: number
  nomorLangganan: string
  status: "DIPERBARUI" | "DUPLIKAT" | "DILEWATI" | "GAGAL"
  pesan?: string
}

interface HasilBatch {
  diproses: number
  tersimpan: number
  /// Baris pemutusan yang sudah tercatat dari sumber lain lalu DILENGKAPI
  /// oleh r-nomor — bukan baris baru. Lihat StatusBaris di impor.router.ts.
  diperbarui: number
  duplikat: number
  dilewati: number
  gagal: number
  masalah: Masalah[]
}

interface Terurai {
  namaBerkas: string
  ukuranByte: number
  jenis: Jenis
  baris: (BarisPencatatan | BarisPemutusan)[]
  ditolak: { baris: number; alasan: string }[]
  periode: number[]
}

const angka = (n: number) => n.toLocaleString("id-ID")

function formatDurasi(ms: number): string {
  const d = Math.round(ms / 1000)
  if (d < 60) return `${d} detik`
  return `${Math.floor(d / 60)} menit ${d % 60} detik`
}

export function ImporDataClient() {
  /// Periode kerja dipakai untuk MEMPERINGATKAN, bukan menimpa: periode
  /// impor tetap dibaca dari berkasnya sendiri (kolom Periode/thbl), karena
  /// berkas itulah yang tahu bulan apa yang dicatat. Yang berguna adalah
  /// memberi tahu operator kalau keduanya tidak cocok — mengunggah berkas
  /// Februari saat sistem mengerjakan Januari nyaris selalu keliru.
  const { periodeKerja } = usePeriodeKerja()
  const [jenis, setJenis] = React.useState<Jenis>("pencatatan")
  const [terurai, setTerurai] = React.useState<Terurai | null>(null)
  const [galatUrai, setGalatUrai] = React.useState<string | null>(null)

  const [berjalan, setBerjalan] = React.useState(false)
  const [selesai, setSelesai] = React.useState(false)
  const [terkirim, setTerkirim] = React.useState(0)
  const [total, setTotal] = React.useState(0)
  const [mulaiPada, setMulaiPada] = React.useState<number | null>(null)
  const [berlalu, setBerlalu] = React.useState(0)
  const [galatKirim, setGalatKirim] = React.useState<string | null>(null)

  const [ringkas, setRingkas] = React.useState<HasilBatch>({
    diproses: 0,
    tersimpan: 0,
    diperbarui: 0,
    duplikat: 0,
    dilewati: 0,
    gagal: 0,
    masalah: [],
  })
  /// Batch yang permintaannya gagal seluruhnya (jaringan/timeout) — beda dari
  /// baris yang ditolak server. Inilah yang bisa diulang.
  const [batchGagal, setBatchGagal] = React.useState<number[]>([])
  /// Jumlah baris yang batch-nya gagal terkirim. WAJIB ditampilkan: tanpa
  /// angka ini ringkasan hanya menjumlahkan batch yang berhasil, dan sebuah
  /// impor yang kehilangan seribu baris terlihat persis seperti impor yang
  /// utuh — hanya angkanya lebih kecil, dan tidak ada yang menyebut kenapa.
  const [tidakTerkirim, setTidakTerkirim] = React.useState(0)

  const batalRef = React.useRef(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  // Jam berjalan — memberi tahu pengguna prosesnya hidup, bukan menggantung.
  React.useEffect(() => {
    if (!berjalan || mulaiPada === null) return
    const t = setInterval(() => setBerlalu(Date.now() - mulaiPada), 500)
    return () => clearInterval(t)
  }, [berjalan, mulaiPada])

  function reset() {
    setTerurai(null)
    setGalatUrai(null)
    setSelesai(false)
    setGalatKirim(null)
    setTerkirim(0)
    setTotal(0)
    setMulaiPada(null)
    setBerlalu(0)
    setBatchGagal([])
    setTidakTerkirim(0)
    setRingkas({
      diproses: 0,
      tersimpan: 0,
      diperbarui: 0,
      duplikat: 0,
      dilewati: 0,
      gagal: 0,
      masalah: [],
    })
    if (inputRef.current) inputRef.current.value = ""
  }

  async function pilihBerkas(file: File) {
    reset()
    try {
      const nama = file.name.toLowerCase()
      const excel = nama.endsWith(".xlsx") || nama.endsWith(".xls")
      const tabel = excel
        ? uraiExcel(await file.arrayBuffer())
        : uraiCsv(await file.text())
      const hasil =
        jenis === "pencatatan"
          ? petakanPencatatan(tabel)
          : petakanPemutusan(tabel)
      setTerurai({
        namaBerkas: file.name,
        ukuranByte: file.size,
        jenis,
        baris: hasil.baris,
        ditolak: hasil.ditolak,
        periode: hasil.periode,
      })
    } catch (e) {
      setGalatUrai(e instanceof Error ? e.message : "Berkas tidak bisa dibaca.")
    }
  }

  /// Mengirim satu potongan. Dipisah supaya "ulangi yang gagal" memakai
  /// jalur yang PERSIS SAMA dengan pengiriman pertama — bukan salinan yang
  /// bisa menyimpang diam-diam.
  async function kirimPotongan(
    potongan: Terurai["baris"],
    periodeBatch: number
  ) {
    const info = JENIS_INFO[jenis]
    const muatan =
      jenis === "pencatatan"
        ? { periode: periodeBatch, baris: potongan }
        : { baris: potongan }
    return kirimJson<HasilBatch>(info.endpoint, "POST", muatan)
  }

  function serapHasil(h: HasilBatch) {
    setRingkas((r) => ({
      diproses: r.diproses + h.diproses,
      tersimpan: r.tersimpan + h.tersimpan,
      diperbarui: r.diperbarui + h.diperbarui,
      duplikat: r.duplikat + h.duplikat,
      dilewati: r.dilewati + h.dilewati,
      gagal: r.gagal + h.gagal,
      // Daftar masalah dibatasi 500 di layar — melebihi itu tidak menolong
      // siapa pun dan membuat tabel berhenti bernapas.
      masalah:
        r.masalah.length >= 500
          ? r.masalah
          : [...r.masalah, ...h.masalah].slice(0, 500),
    }))
  }

  async function jalankan(indeksBatch?: number[]) {
    if (!terurai) return
    batalRef.current = false
    setBerjalan(true)
    setSelesai(false)
    setGalatKirim(null)
    setMulaiPada(Date.now())
    setBerlalu(0)

    const potongan: Terurai["baris"][] = []
    for (let i = 0; i < terurai.baris.length; i += UKURAN_BATCH) {
      potongan.push(terurai.baris.slice(i, i + UKURAN_BATCH))
    }
    const dijalankan = indeksBatch ?? potongan.map((_, i) => i)

    if (!indeksBatch) {
      setTotal(terurai.baris.length)
      setTerkirim(0)
      setRingkas({
        diproses: 0,
        tersimpan: 0,
        diperbarui: 0,
        duplikat: 0,
        dilewati: 0,
        gagal: 0,
        masalah: [],
      })
      setTidakTerkirim(0)
    } else {
      /// MENGULANG ITU MENGGANTI, BUKAN MENAMBAH. Baris batch yang diulang
      /// sudah pernah dihitung sekali di putaran sebelumnya: masuk `terkirim`
      /// (penambahnya tetap jalan walau batch-nya gagal) dan masuk
      /// `tidakTerkirim`. Kalau tidak dikurangi lebih dulu, pengulangan yang
      /// BERHASIL SEPENUHNYA tetap menyisakan kartu merah "Tidak terkirim
      /// 250" dan malah memicu alarm "Neraca baris tidak cocok" — persis
      /// kebalikan dari kabar yang sebenarnya. Pengguna yang baru saja
      /// menyelamatkan impornya akan mengira ia masih gagal.
      const barisDiulang = dijalankan.reduce(
        (n, i) => n + (potongan[i]?.length ?? 0),
        0
      )
      setTerkirim((t) => Math.max(0, t - barisDiulang))
      setTidakTerkirim((n) => Math.max(0, n - barisDiulang))
    }
    const gagalBaru: number[] = []
    // Baris yang batch-nya TIDAK PERNAH DIJAWAB server. Dihitung terpisah
    // dari `gagal` (baris yang ditolak server satu per satu): yang ini tidak
    // punya keterangan per baris sama sekali, karena permintaannya memang
    // mati sebelum server sempat melapor.
    let takTerkirim = 0

    for (const i of dijalankan) {
      if (batalRef.current) break
      const isi = potongan[i]
      if (!isi || isi.length === 0) continue
      const periodeBatch = (isi[0] as BarisPencatatan).periode
      try {
        const h = await kirimPotongan(isi, periodeBatch)
        serapHasil(h)
      } catch (e) {
        gagalBaru.push(i)
        takTerkirim += isi.length
        // Penolakan yang sifatnya menyeluruh (mis. periode sudah terkunci)
        // TIDAK ada gunanya diulang untuk batch berikutnya — hentikan dan
        // tampilkan alasannya apa adanya.
        if (e instanceof ApiError && e.status === 400) {
          setGalatKirim(e.message)
          setTerkirim((t) => t + isi.length)
          break
        }
        setGalatKirim(e instanceof Error ? e.message : "Gagal mengirim batch.")
      }
      setTerkirim((t) => t + isi.length)
    }

    setBatchGagal(gagalBaru)
    // Penguranganya sudah dilakukan di awal (lihat cabang `else` di atas),
    // jadi di sini cukup menambahkan yang gagal di putaran ini.
    setTidakTerkirim((n) => n + takTerkirim)
    setBerjalan(false)
    setSelesai(true)
  }

  const persen =
    total === 0 ? 0 : Math.min(100, Math.round((terkirim / total) * 100))
  /// Baris berkas yang tidak muncul di kolom mana pun: tidak dilaporkan
  /// server, dan tidak pula tercatat sebagai batch yang gagal terkirim.
  const belumTerhitung = total - ringkas.diproses - tidakTerkirim
  const kolomRingkas =
    (ringkas.diperbarui > 0 ? 1 : 0) + (tidakTerkirim > 0 ? 1 : 0) === 2
      ? "sm:grid-cols-6"
      : (ringkas.diperbarui > 0 ? 1 : 0) + (tidakTerkirim > 0 ? 1 : 0) === 1
        ? "sm:grid-cols-5"
        : "sm:grid-cols-4"
  /// "baris 251–1.000" — rentang di BERKAS, bukan nomor batch.
  const rentangBatchGagal = batchGagal
    .map((i) => {
      const mulai = i * UKURAN_BATCH + 2 // +1 header, +1 hitungan manusia
      const akhir = Math.min(
        (i + 1) * UKURAN_BATCH + 1,
        (terurai?.baris.length ?? 0) + 1
      )
      return `${angka(mulai)}–${angka(akhir)}`
    })
    .join(", ")
  const info = JENIS_INFO[jenis]
  const jumlahBatch = terurai
    ? Math.ceil(terurai.baris.length / UKURAN_BATCH)
    : 0

  return (
    <div className="flex flex-col gap-5">
      <Card className="border border-border/80 shadow-xs">
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <HugeiconsIcon
                icon={FileSpreadsheetIcon}
                strokeWidth={2}
                className="size-5 text-primary"
                aria-hidden
              />
              {info.judul}
              <Badge variant="outline" className="font-mono text-xs">
                {info.berkas}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-1.5 rounded-lg border bg-muted/40 p-1 text-xs">
              {(Object.keys(JENIS_INFO) as Jenis[]).map((j) => (
                <button
                  key={j}
                  type="button"
                  disabled={berjalan}
                  onClick={() => {
                    setJenis(j)
                    reset()
                  }}
                  className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                    jenis === j
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {JENIS_INFO[j].judul}
                </button>
              ))}
            </div>
          </div>
          <CardDescription className="text-xs sm:text-sm">
            {info.jelas}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={berjalan}
              onClick={() => inputRef.current?.click()}
              className="h-9 gap-2 text-xs sm:text-sm"
            >
              <HugeiconsIcon
                icon={Upload01Icon}
                strokeWidth={2}
                className="size-4"
                aria-hidden
              />
              {terurai ? "Ganti berkas" : "Pilih berkas CSV / Excel"}
            </Button>
            {terurai && (
              <span className="flex min-w-0 items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1 text-xs font-medium text-foreground">
                <HugeiconsIcon
                  icon={Folder01Icon}
                  strokeWidth={2}
                  className="size-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="truncate">{terurai.namaBerkas}</span>
                <span className="text-[11px] text-muted-foreground">
                  ({(terurai.ukuranByte / 1024).toFixed(1)} KB)
                </span>
              </span>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              className="sr-only"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void pilihBerkas(f)
              }}
            />
          </div>

          {galatUrai && (
            <Alert variant="destructive">
              <HugeiconsIcon
                icon={Alert02Icon}
                strokeWidth={2}
                className="size-4"
                aria-hidden
              />
              <AlertTitle>Berkas tidak dikenali</AlertTitle>
              <AlertDescription>{galatUrai}</AlertDescription>
            </Alert>
          )}

          {terurai && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-2.5 sm:grid-cols-4">
                <Ringkasan label="Berkas" nilai={terurai.namaBerkas} kecil />
                <Ringkasan
                  label="Baris siap kirim"
                  nilai={angka(terurai.baris.length)}
                />
                <Ringkasan
                  label="Periode"
                  nilai={
                    terurai.periode.length === 0
                      ? "—"
                      : terurai.periode.join(", ")
                  }
                />
                <Ringkasan
                  label="Jumlah batch"
                  nilai={`${jumlahBatch} × ${angka(UKURAN_BATCH)}`}
                />
              </div>

              {periodeKerja !== null &&
                terurai.periode.length === 1 &&
                terurai.periode[0] !== periodeKerja && (
                  <Alert variant="destructive">
                    <HugeiconsIcon
                      icon={Alert02Icon}
                      strokeWidth={2}
                      className="size-4"
                      aria-hidden
                    />
                    <AlertTitle>
                      Periode berkas berbeda dari periode kerja
                    </AlertTitle>
                    <AlertDescription>
                      Berkas ini berisi periode{" "}
                      <strong>{terurai.periode[0]}</strong>, sedangkan sistem
                      sedang mengerjakan <strong>{periodeKerja}</strong>. Impor
                      tetap bisa dijalankan, tapi pastikan ini memang disengaja
                      — berkas yang salah periode akan mendarat di bulan yang
                      tidak sedang dikerjakan siapa pun.
                    </AlertDescription>
                  </Alert>
                )}

              {terurai.periode.length > 1 && (
                <Alert>
                  <HugeiconsIcon
                    icon={Alert02Icon}
                    strokeWidth={2}
                    className="size-4"
                    aria-hidden
                  />
                  <AlertTitle>Berkas memuat lebih dari satu periode</AlertTitle>
                  <AlertDescription>
                    Ditemukan periode {terurai.periode.join(", ")}. Impor tetap
                    bisa dijalankan, tapi pastikan ini memang disengaja — satu
                    setoran lazimnya satu periode.
                  </AlertDescription>
                </Alert>
              )}

              {terurai.ditolak.length > 0 && (
                <Alert>
                  <HugeiconsIcon
                    icon={Alert02Icon}
                    strokeWidth={2}
                    className="size-4"
                    aria-hidden
                  />
                  <AlertTitle>
                    {angka(terurai.ditolak.length)} baris tidak bisa dibaca
                  </AlertTitle>
                  <AlertDescription>
                    Baris ini TIDAK akan dikirim. Contoh:{" "}
                    {terurai.ditolak
                      .slice(0, 3)
                      .map((d) => `baris ${d.baris} (${d.alasan})`)
                      .join("; ")}
                    {terurai.ditolak.length > 3 &&
                      ` … dan ${angka(terurai.ditolak.length - 3)} lainnya`}
                    .
                  </AlertDescription>
                </Alert>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  onClick={() => void jalankan()}
                  disabled={berjalan || terurai.baris.length === 0}
                  className="h-9 gap-2"
                >
                  {berjalan ? (
                    <Spinner className="size-4" />
                  ) : (
                    <HugeiconsIcon
                      icon={Upload01Icon}
                      strokeWidth={2}
                      className="size-4"
                      aria-hidden
                    />
                  )}
                  {berjalan
                    ? "Mengirim…"
                    : `Mulai impor ${angka(terurai.baris.length)} baris`}
                </Button>
                {berjalan && (
                  <Button
                    variant="outline"
                    className="h-9 gap-1.5"
                    onClick={() => {
                      batalRef.current = true
                    }}
                  >
                    <HugeiconsIcon
                      icon={UnavailableIcon}
                      strokeWidth={2}
                      className="size-4"
                      aria-hidden
                    />
                    Hentikan
                  </Button>
                )}
                {!berjalan && batchGagal.length > 0 && (
                  <Button
                    variant="secondary"
                    className="h-9 gap-1.5"
                    onClick={() => void jalankan(batchGagal)}
                  >
                    <HugeiconsIcon
                      icon={RotateLeft01Icon}
                      strokeWidth={2}
                      className="size-4"
                      aria-hidden
                    />
                    Ulangi {batchGagal.length} batch yang gagal
                  </Button>
                )}
                {!berjalan && (
                  <Button
                    variant="ghost"
                    className="h-9 gap-1.5"
                    onClick={reset}
                  >
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      strokeWidth={2}
                      className="size-4"
                      aria-hidden
                    />
                    Bersihkan
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {(berjalan || selesai) && (
        <Card className="border border-border/80 shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              {berjalan ? (
                <Spinner className="size-4" />
              ) : (
                <HugeiconsIcon
                  icon={CheckmarkCircle02Icon}
                  strokeWidth={2}
                  className="size-5 text-emerald-600 dark:text-emerald-400"
                  aria-hidden
                />
              )}
              {berjalan ? "Sedang mengirim" : "Impor selesai"}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              {angka(terkirim)} dari {angka(total)} baris •{" "}
              {formatDurasi(berlalu)}
              {berjalan && terkirim > 0 && total > terkirim
                ? ` • perkiraan sisa ${formatDurasi((berlalu / terkirim) * (total - terkirim))}`
                : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Progress value={persen} />
              <p className="text-right text-xs text-muted-foreground tabular-nums">
                {persen}%
              </p>
            </div>

            <div className={`grid gap-2.5 ${kolomRingkas}`}>
              <Ringkasan
                label="Tersimpan"
                nilai={angka(ringkas.tersimpan)}
                nada="hijau"
              />
              {ringkas.diperbarui > 0 && (
                <Ringkasan
                  label="Dilengkapi"
                  nilai={angka(ringkas.diperbarui)}
                  nada="hijau"
                />
              )}
              <Ringkasan
                label="Duplikat"
                nilai={angka(ringkas.duplikat)}
                nada="amber"
              />
              <Ringkasan
                label="Dilewati"
                nilai={angka(ringkas.dilewati)}
                nada="amber"
              />
              <Ringkasan
                label="Gagal"
                nilai={angka(ringkas.gagal)}
                nada={ringkas.gagal > 0 ? "merah" : undefined}
              />
              {tidakTerkirim > 0 && (
                <Ringkasan
                  label="Tidak terkirim"
                  nilai={angka(tidakTerkirim)}
                  nada="merah"
                />
              )}
            </div>

            {selesai && belumTerhitung !== 0 && (
              <Alert variant="destructive">
                <HugeiconsIcon
                  icon={Alert02Icon}
                  strokeWidth={2}
                  className="size-4"
                  aria-hidden
                />
                <AlertTitle>Neraca baris tidak cocok</AlertTitle>
                <AlertDescription>
                  Berkas berisi {angka(total)} baris siap kirim, tetapi yang
                  terlaporkan server {angka(ringkas.diproses)} baris
                  {tidakTerkirim > 0
                    ? ` dan ${angka(tidakTerkirim)} baris batch-nya gagal terkirim`
                    : ""}
                  . Selisih {angka(Math.abs(belumTerhitung))} baris belum
                  tercatat di mana pun — jalankan “Ulangi batch yang gagal” di
                  bawah. Mengulang aman: tiap baris dikunci pada nomor langganan
                  + periode, jadi yang sudah masuk tercatat sebagai duplikat,
                  bukan data dobel.
                </AlertDescription>
              </Alert>
            )}

            {galatKirim && (
              <Alert variant="destructive">
                <HugeiconsIcon
                  icon={Alert02Icon}
                  strokeWidth={2}
                  className="size-4"
                  aria-hidden
                />
                <AlertTitle>Pengiriman dihentikan</AlertTitle>
                <AlertDescription>{galatKirim}</AlertDescription>
              </Alert>
            )}

            {selesai && batchGagal.length > 0 && (
              <Alert variant="destructive">
                <HugeiconsIcon
                  icon={Alert02Icon}
                  strokeWidth={2}
                  className="size-4"
                  aria-hidden
                />
                <AlertTitle>
                  {batchGagal.length} batch tidak terkirim
                </AlertTitle>
                <AlertDescription>
                  Rentang baris berkas: {rentangBatchGagal}.{" "}
                  {galatKirim
                    ? `Sebab terakhir yang dilaporkan: ${galatKirim}`
                    : "Server tidak sempat menjawab — periksa juga log server, bukan hanya jaringan."}
                </AlertDescription>
              </Alert>
            )}

            {ringkas.masalah.length > 0 && (
              <div className="flex flex-col gap-2 pt-2">
                <p className="text-sm font-medium">
                  Baris yang perlu ditinjau ({angka(ringkas.masalah.length)}
                  {ringkas.masalah.length >= 500
                    ? "+, ditampilkan 500 pertama"
                    : ""}
                  )
                </p>
                <div className="max-h-96 overflow-auto rounded-md border">
                  <Table>
                    <TableHeader className="sticky top-0 bg-muted/60">
                      <TableRow>
                        <TableHead className="w-20">Baris</TableHead>
                        <TableHead className="w-36">No. langganan</TableHead>
                        <TableHead className="w-28">Status</TableHead>
                        <TableHead>Keterangan</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ringkas.masalah.map((m, i) => (
                        <TableRow key={`${m.baris}-${i}`}>
                          <TableCell className="font-mono text-xs tabular-nums">
                            {m.baris}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {m.nomorLangganan}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                m.status === "GAGAL"
                                  ? "destructive"
                                  : m.status === "DIPERBARUI"
                                    ? "default"
                                    : "secondary"
                              }
                            >
                              {m.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {m.pesan ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Ringkasan({
  label,
  nilai,
  nada,
  kecil,
}: {
  label: string
  nilai: string
  nada?: "hijau" | "amber" | "merah"
  kecil?: boolean
}) {
  const warna =
    nada === "hijau"
      ? "text-emerald-600 dark:text-emerald-400"
      : nada === "amber"
        ? "text-amber-600 dark:text-amber-400"
        : nada === "merah"
          ? "text-red-600 dark:text-red-400"
          : "text-foreground"
  return (
    <div className="rounded-lg border bg-card/60 p-3 shadow-2xs">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={`mt-0.5 font-semibold tabular-nums ${kecil ? "truncate text-sm" : "text-lg"} ${warna}`}
      >
        {nilai}
      </p>
    </div>
  )
}
