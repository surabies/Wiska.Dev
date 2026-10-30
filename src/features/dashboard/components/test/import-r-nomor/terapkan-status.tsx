"use client"

// features/dashboard/components/pemutusan/terapkan-status.tsx — panel
// "terapkan status pelanggan dari pemutusan" di atas grid /dashboard/pemutusan.
//
// KENAPA LAYAR INI PERLU ADA. Mencatat pemutusan tidak pernah mengubah
// `Pelanggan.status` sebagai efek samping — itu aturan yang dipegang sejak
// awal supaya tidak ada perubahan tersembunyi di data billing. Tapi selama
// ini akibatnya jadi lain dari maksudnya: SATU-SATUNYA jalur yang bisa
// mengubah status adalah unggah master STI dan menyunting pelanggan satu per
// satu. Praktisnya status tidak pernah diperbarui sama sekali, dan angka
// "pelanggan aktif" di layar data pelanggan meleset sebanyak sambungan yang
// sudah dicabut tapi masih tertulis AKTIF.
//
// Jadi yang ditambahkan adalah PINTUNYA, bukan otomatisasinya: pratinjau
// dulu (tidak menulis apa pun), lihat baris demi baris, baru disetujui.
import * as React from "react"
import { AlertTriangle, CheckCircle2, Loader2, ShieldCheck } from "lucide-react"
import { kirimJson, ApiError } from "@/features/dashboard/lib/api-client"
import { usePeriodeKerja } from "@/features/dashboard/lib/periode-kerja"
import { formatPeriode } from "@/features/public/lib/format"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { NativeSelect } from "@/components/ui/native-select"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

type Tindakan =
  | "AKAN_DIUBAH"
  | "SUDAH_SESUAI"
  | "TANPA_PELANGGAN"
  | "JENIS_BELUM_PASTI"
  | "TERSAMBUNG_KEMBALI"

interface BarisTerap {
  pemutusanId: string
  nomorLangganan: string | null
  namaPelanggan: string | null
  jenis: string
  statusSekarang: string | null
  statusTujuan: string | null
  tindakan: Tindakan
}

interface Hasil {
  periode: number
  diperiksa: number
  akanDiubah: number
  sudahSesuai: number
  tanpaPelanggan: number
  jenisBelumPasti: number
  tersambungKembali: number
  diterapkan: boolean
  diubah?: number
  rencana: BarisTerap[]
}

const angka = (n: number) => n.toLocaleString("id-ID")

const NADA_TINDAKAN: Record<Tindakan, "default" | "secondary" | "destructive" | "outline"> = {
  AKAN_DIUBAH: "default",
  SUDAH_SESUAI: "secondary",
  TANPA_PELANGGAN: "outline",
  JENIS_BELUM_PASTI: "destructive",
  TERSAMBUNG_KEMBALI: "outline",
}

export function TerapkanStatusPemutusan({ onSelesai }: { onSelesai?: () => void }) {
  const { periodeKerja, daftar } = usePeriodeKerja()
  const [periode, setPeriode] = React.useState<string>("")
  const [sibuk, setSibuk] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const [hasil, setHasil] = React.useState<Hasil | null>(null)

  // Periode kerja dipakai sebagai isian awal begitu termuat — tapi hanya
  // sekali, supaya pilihan pengguna tidak ditimpa saat komponen render ulang.
  const [terpakai, setTerpakai] = React.useState<number | null>(null)
  if (periodeKerja !== null && periodeKerja !== terpakai) {
    setTerpakai(periodeKerja)
    setPeriode(String(periodeKerja))
  }

  async function jalankan(terapkan: boolean) {
    if (!periode) return
    setSibuk(true)
    setGalat(null)
    try {
      const h = await kirimJson<Hasil>("/pemutusan/terapkan-status", "POST", {
        periode: Number(periode),
        terapkan,
      })
      setHasil(h)
      if (terapkan) onSelesai?.()
    } catch (e) {
      setGalat(e instanceof ApiError ? e.message : "Gagal memproses permintaan.")
    } finally {
      setSibuk(false)
    }
  }

  // Baris "SUDAH_SESUAI" tidak ditampilkan: pada periode yang sudah pernah
  // diterapkan jumlahnya bisa ratusan, dan tak satu pun menuntut tindakan.
  const perluDilihat = (hasil?.rencana ?? []).filter((r) => r.tindakan !== "SUDAH_SESUAI")

  return (
    <div className="rounded-xl border bg-card p-5">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <ShieldCheck className="size-4" aria-hidden />
        Terapkan status pelanggan
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Mengubah <strong>status pelanggan</strong> mengikuti pemutusan yang tercatat pada satu periode:
        TSM menjadi <span className="font-mono text-xs">TUTUP_SEMENTARA</span>, SPT menjadi{" "}
        <span className="font-mono text-xs">TUTUP_SPT</span>. Baris berjenis LAINNYA tidak ditebak —
        ia dilaporkan supaya jenisnya ditentukan lebih dulu. Pratinjau tidak mengubah apa pun.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="periode-terap">Periode pemutusan</Label>
          <NativeSelect
            id="periode-terap"
            value={periode}
            onChange={(e) => { setPeriode(e.currentTarget.value); setHasil(null) }}
            className="w-48"
          >
            <option value="">Pilih periode…</option>
            {daftar.map((p) => (
              <option key={p.periode} value={String(p.periode)}>
                {formatPeriode(p.periode)}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button variant="outline" disabled={!periode || sibuk} onClick={() => void jalankan(false)}>
          {sibuk ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Pratinjau
        </Button>
      </div>

      {galat && (
        <Alert variant="destructive" className="mt-4">
          <AlertTriangle className="size-4" aria-hidden />
          <AlertTitle>Gagal</AlertTitle>
          <AlertDescription>{galat}</AlertDescription>
        </Alert>
      )}

      {hasil && (
        <div className="mt-5 border-t pt-4">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span>
              Diperiksa <strong>{angka(hasil.diperiksa)}</strong> pemutusan periode {hasil.periode}
            </span>
            <span className="text-emerald-600 dark:text-emerald-400">
              akan diubah <strong>{angka(hasil.akanDiubah)}</strong>
            </span>
            <span className="text-muted-foreground">sudah sesuai {angka(hasil.sudahSesuai)}</span>
            {hasil.tanpaPelanggan > 0 && (
              <span className="text-muted-foreground">tanpa baris pelanggan {angka(hasil.tanpaPelanggan)}</span>
            )}
            {hasil.jenisBelumPasti > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                jenis belum pasti <strong>{angka(hasil.jenisBelumPasti)}</strong>
              </span>
            )}
            {hasil.tersambungKembali > 0 && (
              <span className="text-muted-foreground">
                tersambung kembali {angka(hasil.tersambungKembali)}
              </span>
            )}
          </div>

          {hasil.diterapkan && (
            <Alert className="mt-3">
              <CheckCircle2 className="size-4" aria-hidden />
              <AlertTitle>Selesai</AlertTitle>
              <AlertDescription>
                {angka(hasil.diubah ?? 0)} status pelanggan diperbarui dan tercatat di jejak audit.
              </AlertDescription>
            </Alert>
          )}

          {hasil.jenisBelumPasti > 0 && !hasil.diterapkan && (
            <Alert className="mt-3">
              <AlertTriangle className="size-4" aria-hidden />
              <AlertTitle>{angka(hasil.jenisBelumPasti)} baris berjenis LAINNYA dilewati</AlertTitle>
              <AlertDescription>
                Jenisnya belum diketahui pasti, jadi statusnya tidak ditebak — menebak TSM/SPT berarti
                mengarang keterangan yang berakibat hukum. Nomornya ada di tabel bawah; tentukan
                statusnya langsung di halaman data pelanggan bila Anda tahu duduk perkaranya.
              </AlertDescription>
            </Alert>
          )}

          {/* DUA KEADAAN KOSONG YANG DULU TAMPIL SEBAGAI RUANG HAMPA.
              Pratinjau yang tidak menghasilkan apa-apa terbaca seperti layar
              rusak — pengguna tidak bisa membedakan "tidak ada yang perlu
              diubah" dari "gagal memuat". Keduanya sekarang dinyatakan. */}
          {hasil.diperiksa === 0 && (
            <Alert className="mt-3">
              <CheckCircle2 className="size-4" aria-hidden />
              <AlertTitle>Periode {hasil.periode} tidak punya catatan pemutusan</AlertTitle>
              <AlertDescription>
                Bukan kesalahan: tidak ada sambungan yang tercatat putus pada periode itu. Untuk periode
                paling awal hal ini wajar — cabutan dikenali dengan membandingkan daftar bulan ini
                terhadap bulan sebelumnya, dan bulan pertama tidak punya pembanding.
              </AlertDescription>
            </Alert>
          )}

          {hasil.diperiksa > 0 && hasil.akanDiubah === 0 && hasil.jenisBelumPasti === 0 && !hasil.diterapkan && (
            <Alert className="mt-3">
              <CheckCircle2 className="size-4" aria-hidden />
              <AlertTitle>Tidak ada yang perlu diubah</AlertTitle>
              <AlertDescription>
                {angka(hasil.sudahSesuai)} pelanggan sudah berstatus sesuai jenis pemutusannya. Periode ini
                sudah beres.
              </AlertDescription>
            </Alert>
          )}

          {perluDilihat.length > 0 && (
            <div className="mt-3 max-h-96 overflow-auto rounded-md border">
              <Table>
                <TableHeader className="bg-muted/50 sticky top-0">
                  <TableRow>
                    <TableHead className="w-36">No. Langganan</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="w-24">Jenis</TableHead>
                    <TableHead className="w-40">Status</TableHead>
                    <TableHead className="w-44">Tindakan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {perluDilihat.map((r) => (
                    <TableRow key={r.pemutusanId}>
                      <TableCell className="font-mono text-xs">{r.nomorLangganan ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.namaPelanggan ?? "—"}</TableCell>
                      <TableCell className="text-xs">{r.jenis}</TableCell>
                      <TableCell className="text-xs">
                        {r.statusSekarang ?? "—"}
                        {r.statusTujuan && r.tindakan === "AKAN_DIUBAH" ? ` → ${r.statusTujuan}` : ""}
                      </TableCell>
                      <TableCell>
                        <Badge variant={NADA_TINDAKAN[r.tindakan]}>{r.tindakan}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {!hasil.diterapkan && hasil.akanDiubah > 0 && (
            <div className="mt-4">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={sibuk}>
                    {sibuk ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                    Terapkan ke {angka(hasil.akanDiubah)} pelanggan
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Ubah status {angka(hasil.akanDiubah)} pelanggan?</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="space-y-2 text-sm">
                        <p>
                          Status di master pelanggan akan mengikuti jenis pemutusan periode {hasil.periode}.
                          Setiap perubahan dicatat di jejak audit atas nama Anda.
                        </p>
                        <p className="text-muted-foreground">
                          Ini TIDAK menghapus pelanggan, tidak menyentuh tagihan yang sudah terbit, dan tidak
                          mengubah daftar catat. Status bisa dikembalikan lewat halaman data pelanggan.
                        </p>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction onClick={() => void jalankan(true)}>Ya, terapkan</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
