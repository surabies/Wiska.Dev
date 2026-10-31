"use client"

import * as React from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { formatPeriode } from "@/features/public/lib/format"
import { toast } from "sonner"
import { kirimJson, ApiError } from "../../../lib/api-client"
import type { LaporanHarianDetail } from "../types/tipe"
import { Bagian } from "../panel/panel-bagian"
import { DialogVerifikasi } from "../dialog-verifikasi"

export function ModalCekUlang({
  detail,
  onTutup,
  onSelesai,
}: {
  detail: LaporanHarianDetail
  onTutup: () => void
  onSelesai: () => void
}) {
  const [alasan, setAlasan] = React.useState("")
  const [galat, setGalat] = React.useState<string | null>(null)
  const [mengirim, setMengirim] = React.useState(false)

  async function kirim() {
    if (alasan.trim().length === 0) {
      setGalat("Alasan cek ulang wajib diisi.")
      return
    }
    setMengirim(true)
    setGalat(null)
    try {
      await kirimJson(`/laporan-harian/${detail.id}/reject`, "PATCH", {
        catatanVerif: alasan.trim(),
      })
      toast.success("Laporan dikirim untuk cek ulang.")
      onSelesai()
    } catch (err) {
      setGalat(err instanceof ApiError ? err.message : "Gagal mengirim laporan untuk cek ulang.")
    } finally {
      setMengirim(false)
    }
  }

  return (
    <DialogVerifikasi
      buka
      onBuka={(buka) => !buka && !mengirim && onTutup()}
      judul={`Kirim untuk cek ulang — ${detail.pelanggan?.nama ?? detail.namaPelanggan ?? detail.nomorLangganan}`}
      subjudul={`${formatPeriode(detail.periode)} · ${detail.pencatat?.namaLapangan ?? "pencatat tidak diketahui"}`}
      fotoLabel={`Foto meter — ${formatPeriode(detail.periode)}`}
      fotos={[
        {
          kunci: "stand",
          label: "Stand meter",
          url: detail.fotoStandUrl ?? detail.pembacaan?.fotoBukti,
          keteranganKosong: "Laporan ini tidak memiliki foto meter.",
        },
        {
          kunci: "segel",
          label: "Segel",
          url: detail.fotoSegelUrl,
          keteranganKosong: "Petugas tidak mengirim foto segel.",
        },
        {
          kunci: "rumah",
          label: "Rumah",
          url: detail.fotoRumahUrl,
          keteranganKosong: "Petugas tidak mengirim foto rumah/persil.",
        },
      ]}
      footer={
        <div className="flex flex-col gap-2">
          {galat && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{galat}</AlertDescription>
            </Alert>
          )}
          <Button
            variant="destructive"
            className="h-9 w-full"
            disabled={mengirim || alasan.trim().length === 0}
            onClick={() => void kirim()}
          >
            {mengirim && <Spinner className="size-3.5" />}
            Kirim untuk cek ulang
          </Button>
          <Button variant="ghost" className="h-9 w-full" disabled={mengirim} onClick={onTutup}>
            Batal
          </Button>
        </div>
      }
    >
      <Bagian judul="Alasan cek ulang">
        <Textarea
          value={alasan}
          onChange={(event) => setAlasan(event.target.value)}
          maxLength={500}
          placeholder="Jelaskan masalah yang perlu diperiksa petugas."
          aria-required="true"
        />
      </Bagian>
    </DialogVerifikasi>
  )
}
