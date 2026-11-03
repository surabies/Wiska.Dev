"use client"

// features/dashboard/verifikasi/components/modalMandiri.tsx — modal aksi
// verifikasi laporan mandiri: foto besar (zoom, geser, putar) berdampingan
// dengan kotak stand yang bisa dikoreksi, lalu verify/reject.
//
// Koreksi bukan aksi simpan tersendiri: verifikator membetulkan angkanya di
// sini lalu menekan verifikasi. Nilai hanya memperbarui laporan mandiri;
// pembacaan resmi dibuat lewat alur verifikasi petugas.
import * as React from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { formatPeriode } from "@/features/public/lib/Format"
import { kirimJson, ApiError } from "@/features/dashboard/api/ApiDashboard"
import type { LaporanMandiriDetail } from "../../types/TipeVerifikasi"
import { Bagian } from "../panel/KomponenPanel"
import { DialogVerifikasi, KELAS_KONTROL_MODAL } from "../DialogVerifikasi"

export function ModalMandiri({
  detail,
  tolakAwal,
  onTutup,
  onSelesai,
}: {
  detail: LaporanMandiriDetail
  /** true = langsung mode tolak. */
  tolakAwal: boolean
  onTutup: () => void
  onSelesai: () => void
}) {
  const [stand, setStand] = React.useState(String(detail.standDilaporkan))
  const [alasan, setAlasan] = React.useState("")
  const [modeTolak, setModeTolak] = React.useState(tolakAwal)
  const [mengirim, setMengirim] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)

  const standNum = Number(stand)
  const standSiap = stand !== "" && Number.isInteger(standNum) && standNum >= 0
  const berubah = standSiap && standNum !== detail.standDilaporkan

  async function jalankan(aksi: "verify" | "reject") {
    if (aksi === "verify" && !standSiap) {
      setGalat("Isi ST akhir dengan bilangan bulat yang valid.")
      return
    }
    setMengirim(true)
    setGalat(null)
    try {
      if (aksi === "verify") {
        await kirimJson(`/laporan-mandiri/${detail.id}/verify`, "PATCH", {
          standDilaporkan: standNum,
        })
      } else {
        await kirimJson(`/laporan-mandiri/${detail.id}/reject`, "PATCH", {
          alasanDitolak: alasan.trim(),
        })
      }
      onSelesai()
    } catch (err) {
      setGalat(err instanceof ApiError ? err.message : "Aksi gagal dijalankan.")
    } finally {
      setMengirim(false)
    }
  }

  const footer = (
    <div className="flex flex-col gap-2">
      {galat && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{galat}</AlertDescription>
        </Alert>
      )}
      {modeTolak ? (
        <>
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            disabled={mengirim || alasan.trim().length === 0}
            onClick={() => jalankan("reject")}
          >
            {mengirim && <Spinner className="size-3.5" />} Tolak laporan
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full"
            disabled={mengirim}
            onClick={() => setModeTolak(false)}
          >
            Batal
          </Button>
        </>
      ) : (
        <>
          <Button
            size="lg"
            className="w-full"
            disabled={mengirim || !standSiap}
            onClick={() => jalankan("verify")}
          >
            {mengirim && <Spinner className="size-3.5" />}
            Verifikasi dan simpan stand
          </Button>
          <Button
            variant="outline"
            size="lg"
            className="w-full"
            disabled={mengirim}
            onClick={() => setModeTolak(true)}
          >
            Tolak laporan
          </Button>
        </>
      )}
    </div>
  )

  return (
    <DialogVerifikasi
      buka
      onBuka={(v) => !v && onTutup()}
      judul={`Verifikasi stand — ${detail.pelanggan?.nama ?? detail.nomorLangganan}`}
      subjudul={`${formatPeriode(detail.periode)} · dilaporkan ${detail.namaPelapor} · cocokkan angka pada foto dengan kotak stand.`}
      fotoUrl={detail.fotoUrl}
      fotoLabel={`Foto meter — ${formatPeriode(detail.periode)}`}
      footer={footer}
    >
      <Bagian judul="ST akhir">
        <Input
          type="number"
          min={0}
          value={stand}
          onChange={(e) => setStand(e.target.value)}
          className={KELAS_KONTROL_MODAL}
          aria-label="ST akhir catat"
        />
        <p className="text-center text-[11px] text-muted-foreground">
          {berubah
            ? `Angka laporan: ${detail.standDilaporkan.toLocaleString("id-ID")}.`
            : "Isi sesuai angka pada foto."}
        </p>
      </Bagian>

      {modeTolak && (
        <Bagian judul="Alasan penolakan (wajib, dikirim ke pelapor)">
          <Textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={3}
            className="text-sm"
            placeholder="Mis. foto buram / angka stand tidak terbaca"
          />
        </Bagian>
      )}
    </DialogVerifikasi>
  )
}
