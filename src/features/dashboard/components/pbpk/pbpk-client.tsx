"use client"

// Impor PBPK (Pasang Baru / Pasang Kembali) — pintu masuk sambungan baru ke
// siklus penagihan.
//
// Perilakunya terbukti di enam periode (prisma/PEMETAAN-DATA.md bagian 8):
// PBPK bulan N selalu sudah ada di daftar kerja bulan N dengan stand nol dan
// belum berpetugas, lalu MASUK(N→N+1) = PBPK(N) secara persis. Jadi impor ini
// membuat baris Pelanggan + Meter DAN memasukkannya ke daftar catat periode
// yang dipilih dengan status TIDAK_TERCATAT.
//
// PERIODE DIMINTA EKSPLISIT, tidak ditebak dari nama berkas: berkas nyata
// bernama macam-macam ("PBPK.csv", "PBPK202606-PW5.xlsx") dan isinya tidak
// punya kolom periode.
import * as React from "react"
import { AlertTriangle, CheckCircle2, FileUp, Info, Loader2, Upload } from "lucide-react"
import { kirimForm, ApiError } from "../../lib/api-client"
import { usePeriodeKerja } from "../../lib/periode-kerja"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const SENIOR_UP = new Set(["SUPER_ADMIN", "DIREKSI", "SENIOR_MANAGER"])

interface BarisPratinjau {
  nomorLangganan: string
  nama: string
  alamat: string
  rt: string | null
  rw: string | null
  kodeRute: string
  /// false = kode rutenya tidak dikenali data induk (mis. "99999", atau rute
  /// lama yang sudah digabung). Baris begini TIDAK akan masuk beban kerja
  /// siapa pun sampai dipetakan manual.
  ruteDikenal: boolean
  noUrutRute: number | null
  kodeGolongan: string | null
  golonganDikenal: boolean
  nomorMeter: string | null
  /// PB = Pasang Baru, PK = Pasang Kembali (pelanggan lama menyambung ulang).
  mutasian: string | null
  status: "BARU" | "SUDAH_ADA" | "METER_MENYUSUL"
}

interface Hasil {
  diterapkan: boolean
  periode: number
  ringkas: {
    totalBaris: number
    akanDibuat: number
    sudahAda: number
    tanpaRute: number
    tanpaGolongan: number
    sudahDiDaftarCatat: number
  }
  contoh: { nomorLangganan: string; jenis: "BARU" | "SUDAH_ADA" | "TANPA_RUTE"; keterangan: string }[]
  /// Seluruh baris berkas beserta nasibnya — ini yang dibaca tabel pratinjau.
  baris: BarisPratinjau[]
  galat: string[]
  ditulis: { pelangganDibuat: number; meterDibuat: number; daftarCatatDibuat: number }
}

const angka = (n: number) => n.toLocaleString("id-ID")

/// Bulan kalender — dipakai HANYA sebagai nilai awal sebelum periode kerja
/// diketahui. Closing kerap tertinggal jauh dari kalender (mis. sistem masih
/// mengerjakan Januari di bulan Juli), dan memakai bulan kalender apa adanya
/// membuat PBPK mendarat di periode yang belum dibuka — sambungannya lahir,
/// tapi tidak muncul di layar mana pun dan tidak ikut closing periode yang
/// sedang dikerjakan.
function periodeSekarang(): number {
  const d = new Date()
  return d.getFullYear() * 100 + (d.getMonth() + 1)
}

export function PbpkClient({ role }: { role: string }) {
  const bolehTerapkan = SENIOR_UP.has(role)
  const [berkas, setBerkas] = React.useState<File | null>(null)
  const [periode, setPeriode] = React.useState(String(periodeSekarang()))
  /// Periode kerja dari SATU sumber (lihat lib/periode-kerja.ts). Menimpa
  /// nilai kalender begitu diketahui.
  const { periodeKerja, siap: periodeSiap } = usePeriodeKerja()
  /// Penyesuaian saat render, BUKAN useEffect — pola resmi React untuk
  /// "menyetel state ketika nilai dari luar berubah". Versi useEffect-nya
  /// merender dulu dengan periode kalender yang keliru, baru menimpanya di
  /// render kedua, sehingga kolom periode sempat berkedip ke bulan yang salah.
  /// Cara ini React buang render pertamanya sebelum sempat tampil.
  const [periodeKerjaTerpakai, setPeriodeKerjaTerpakai] = React.useState<number | null>(null)
  if (periodeKerja !== null && periodeKerja !== periodeKerjaTerpakai) {
    setPeriodeKerjaTerpakai(periodeKerja)
    setPeriode(String(periodeKerja))
  }
  const [sibuk, setSibuk] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [hasil, setHasil] = React.useState<Hasil | null>(null)

  const periodeValid = /^\d{6}$/.test(periode) && Number(periode) % 100 >= 1 && Number(periode) % 100 <= 12

  async function jalankan(terapkan: boolean) {
    if (!berkas || !periodeValid) return
    setSibuk(true)
    setGalat(null)
    try {
      const form = new FormData()
      form.append("berkas", berkas)
      form.append("periode", periode)
      setHasil(await kirimForm<Hasil>(terapkan ? "/pelanggan/impor-pbpk" : "/pelanggan/impor-pbpk/pratinjau", form))
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal memproses berkas PBPK.")
    } finally {
      setSibuk(false)
    }
  }

  const r = hasil?.ringkas

  return (
    // Tanpa max-w: halaman ini memuat tabel pratinjau 11 kolom, dan
    // menguncinya di 3xl (768px) memaksa gulir mendatar padahal layar masih
    // lapang. Formulir unggahnya tetap sempit karena kontrolnya berlebar
    // tetap — yang dilepas hanya batas halamannya.
    <div className="w-full space-y-4">
      <div className="rounded-xl border bg-card p-5">
        <h3 className="text-base font-semibold">Unggah berkas PBPK</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Menerima <span className="font-mono">.csv</span> (pemisah titik koma) maupun{" "}
          <span className="font-mono">.xlsx</span>. Sambungan baru dibuat beserta meternya dan langsung masuk daftar
          catat periode yang dipilih — belum ditagih bulan ini, mulai ditagih bulan berikutnya.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="periode-pbpk">Periode daftar catat</Label>
            <Input
              autoComplete="off"
              id="periode-pbpk"
              inputMode="numeric"
              value={periode}
              onChange={(e) => setPeriode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="w-32 font-mono"
              placeholder="202606"
            />
          </div>
          <div className="grid min-w-56 flex-1 gap-1.5">
            <Label htmlFor="berkas-pbpk">Berkas</Label>
            <Input
              id="berkas-pbpk"
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              onChange={(e) => {
                setBerkas(e.target.files?.[0] ?? null)
                setHasil(null)
              }}
              className="cursor-pointer"
            />
          </div>
          <Button onClick={() => void jalankan(false)} disabled={!berkas || !periodeValid || sibuk || !periodeSiap}>
            {sibuk ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            {sibuk ? "Memeriksa…" : "Pratinjau"}
          </Button>
        </div>
        {!periodeValid && periode.length > 0 && (
          <p className="mt-2 text-xs text-amber-600">Format periode harus TTTTBB dengan bulan 01–12.</p>
        )}
        {galat && <p className="mt-3 text-sm text-destructive">{galat}</p>}
      </div>

      {hasil && r && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {hasil.diterapkan ? (
                <CheckCircle2 className="size-5 text-emerald-600" />
              ) : (
                <Info className="size-5 text-muted-foreground" />
              )}
              <h3 className="text-base font-semibold">
                {hasil.diterapkan ? "PBPK diterapkan" : "Pratinjau"} — periode {hasil.periode}
              </h3>
            </div>
            <Badge variant="secondary">{angka(r.totalBaris)} baris di berkas</Badge>
          </div>

          <div className="mt-4 grid gap-px overflow-hidden border border-border/70 bg-border/70 sm:grid-cols-2 xl:grid-cols-4">
            <Sel label="Sambungan baru" nilai={angka(r.akanDibuat)} />
            <Sel label="Sudah ada" nilai={angka(r.sudahAda)} keterangan="tidak ditimpa" />
            <Sel
              label="Rute tak dikenal"
              nilai={angka(r.tanpaRute)}
              keterangan="tetap dibuat, belum masuk beban kerja"
              perhatian={r.tanpaRute > 0}
            />
            <Sel
              label="Tanpa golongan tarif"
              nilai={angka(r.tanpaGolongan)}
              keterangan="tidak bisa ditagih sampai diisi"
              perhatian={r.tanpaGolongan > 0}
            />
          </div>

          {hasil.diterapkan && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge className="bg-emerald-600 hover:bg-emerald-600">
                Pelanggan {angka(hasil.ditulis.pelangganDibuat)}
              </Badge>
              <Badge className="bg-sky-600 hover:bg-sky-600">Meter {angka(hasil.ditulis.meterDibuat)}</Badge>
              <Badge variant="secondary">Daftar catat {angka(hasil.ditulis.daftarCatatDibuat)}</Badge>
            </div>
          )}

          {hasil.galat.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-600" />
                <p className="text-sm font-medium">{angka(hasil.galat.length)} baris bermasalah</p>
              </div>
              <ul className="mt-1.5 space-y-0.5 text-xs break-all text-muted-foreground">
                {hasil.galat.slice(0, 10).map((g) => (
                  <li key={g} className="font-mono">
                    {g}
                  </li>
                ))}
                {hasil.galat.length > 10 && <li>… (+{angka(hasil.galat.length - 10)} lagi)</li>}
              </ul>
            </div>
          )}

          {/* TABEL, bukan daftar contoh. Berkas PBPK berisi puluhan baris —
              bukan puluhan ribu — jadi seluruhnya bisa ditampilkan. Operator
              perlu melihat SETIAP baris sebelum menerapkan, terutama kolom
              rute: yang tak dikenali tidak akan masuk beban kerja siapa pun. */}
          {/* Tanpa batas tinggi: tabel dibiarkan setinggi isinya dan selebar
              halaman. Mematoknya di 28rem membuat 26 baris terkurung di
              jendela kecil padahal ruang layar masih banyak — operator jadi
              menggulir dua kali (di dalam tabel, lalu di halaman) untuk
              melihat sesuatu yang sebenarnya muat sekaligus. */}
          {hasil.baris.length > 0 && (
            <div className="scrollbar-tipis mt-4 w-full overflow-x-auto rounded-md border">
              <table className="w-max min-w-full border-collapse text-sm">
                <thead className="bg-muted/60 sticky top-0 z-10">
                  <tr className="text-muted-foreground [&>th]:border-border/70 [&>th]:border-b [&>th]:px-3 [&>th]:py-2 [&>th]:text-left [&>th]:text-xs [&>th]:font-semibold [&>th]:whitespace-nowrap">
                    <th style={{ minWidth: 140 }}>No. langganan</th>
                    <th style={{ minWidth: 200 }}>Nama</th>
                    <th style={{ minWidth: 280 }}>Alamat</th>
                    <th style={{ minWidth: 70 }}>RT</th>
                    <th style={{ minWidth: 70 }}>RW</th>
                    <th style={{ minWidth: 120 }}>Rute</th>
                    <th style={{ minWidth: 90 }}>No. urut</th>
                    <th style={{ minWidth: 110 }}>Golongan</th>
                    <th style={{ minWidth: 130 }}>No. meter</th>
                    <th style={{ minWidth: 80 }}>Jenis</th>
                    <th style={{ minWidth: 150 }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {hasil.baris.map((b) => (
                    <tr
                      key={b.nomorLangganan}
                      className={`[&>td]:border-border/40 [&>td]:border-b [&>td]:px-3 [&>td]:py-1.5 [&>td]:whitespace-nowrap ${
                        b.status === "BARU"
                          ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                          : b.status === "METER_MENYUSUL"
                            ? "bg-sky-50/50 dark:bg-sky-950/20"
                            : "bg-muted/30"
                      }`}
                    >
                      <td className="font-mono">{b.nomorLangganan}</td>
                      <td className="max-w-56 truncate" title={b.nama}>{b.nama}</td>
                      <td className="text-muted-foreground max-w-72 truncate" title={b.alamat}>{b.alamat}</td>
                      <td className="text-muted-foreground">{b.rt ?? "—"}</td>
                      <td className="text-muted-foreground">{b.rw ?? "—"}</td>
                      <td>
                        {b.ruteDikenal ? (
                          <span className="font-mono">{b.kodeRute}</span>
                        ) : (
                          /* Rute tak dikenal ditandai TEGAS: inilah baris yang
                             tidak akan masuk beban kerja siapa pun kalau
                             dibiarkan, dan itu kebocoran yang diam. */
                          <Badge variant="outline" className="border-amber-400 text-amber-700 dark:text-amber-400">
                            {b.kodeRute || "kosong"}
                          </Badge>
                        )}
                      </td>
                      <td className="text-muted-foreground tabular-nums">{b.noUrutRute ?? "—"}</td>
                      <td className="text-muted-foreground font-mono text-xs">
                        {b.golonganDikenal ? (b.kodeGolongan ?? "—") : `${b.kodeGolongan ?? "?"} ⚠`}
                      </td>
                      <td className="text-muted-foreground font-mono text-xs">{b.nomorMeter ?? "—"}</td>
                      <td>
                        {b.mutasian ? (
                          <Badge variant="secondary" className="text-[10px]" title={b.mutasian === "PK" ? "Pasang Kembali — pelanggan lama menyambung ulang" : "Pasang Baru"}>
                            {b.mutasian}
                          </Badge>
                        ) : "—"}
                      </td>
                      <td className="text-xs">
                        {b.status === "BARU" ? (
                          <span className="text-emerald-700 dark:text-emerald-400">akan dibuat</span>
                        ) : b.status === "METER_MENYUSUL" ? (
                          <span className="text-sky-700 dark:text-sky-400">meter dibuatkan</span>
                        ) : (
                          <span className="text-muted-foreground">sudah ada</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tidak ada yang tersisa untuk diimpor — dikatakan terang-terangan.
              Tanpa pesan ini layar hanya diam dan tombol Terapkan menghilang,
              yang terbaca seperti tombolnya rusak. */}
          {!hasil.diterapkan && r.akanDibuat === 0 && r.totalBaris > 0 && (
            <div className="mt-4 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm dark:border-sky-900 dark:bg-sky-950/30">
              Seluruh {angka(r.totalBaris)} sambungan di berkas ini sudah ada di database — tidak ada
              yang perlu diimpor{r.sudahDiDaftarCatat > 0 ? `, dan ${angka(r.sudahDiDaftarCatat)} di antaranya sudah masuk daftar catat periode ${hasil.periode}` : ""}.
              Bila ini berkas yang salah, periksa kembali periodenya.
            </div>
          )}

          {!hasil.diterapkan && r.akanDibuat > 0 && (
            <div className="mt-5 border-t pt-4">
              {!bolehTerapkan ? (
                <p className="text-sm text-muted-foreground">
                  Menerapkan PBPK memerlukan wewenang Senior Manager ke atas.
                </p>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button disabled={sibuk}>
                      {sibuk ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
                      Terapkan {angka(r.akanDibuat)} sambungan baru
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Buat {angka(r.akanDibuat)} sambungan baru?</AlertDialogTitle>
                      <AlertDialogDescription asChild>
                        <div className="space-y-2 text-sm">
                          <p>
                            Masing-masing dibuatkan baris pelanggan, meter, dan baris daftar catat periode{" "}
                            {hasil.periode} berstatus TIDAK_TERCATAT.
                          </p>
                          {r.tanpaRute > 0 && (
                            <p className="text-amber-600">
                              {angka(r.tanpaRute)} di antaranya rutenya tidak dikenal — tetap dibuat, tapi belum masuk
                              beban kerja pencatat sampai rutenya diisi.
                            </p>
                          )}
                          <p className="text-muted-foreground">
                            Nomor yang sudah ada tidak akan ditimpa.
                          </p>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={() => void jalankan(true)}>Ya, buat</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Sel({
  label,
  nilai,
  keterangan,
  perhatian,
}: {
  label: string
  nilai: string
  keterangan?: string
  perhatian?: boolean
}) {
  return (
    <div className="bg-card p-4">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className={`mt-1.5 text-xl font-semibold ${perhatian ? "text-amber-600" : "text-foreground"}`}>{nilai}</p>
      {keterangan && <p className="mt-1 text-xs text-muted-foreground">{keterangan}</p>}
    </div>
  )
}
