"use client"

import * as React from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { formatPeriode } from "@/features/public/lib/Format"
import { toast } from "sonner"
import {
  ambilSatu,
  kirimJson,
  ApiError,
} from "@/features/dashboard/api/ApiDashboard"
import type { LaporanHarianDetail } from "../../types/TipeVerifikasi"
import { DialogVerifikasi } from "../DialogVerifikasi"

export function ModalCekUlang({
  id,
  onTutup,
  onSelesai,
}: {
  id: string
  onTutup: () => void
  onSelesai: () => void
}) {
  const [detail, setDetail] = React.useState<LaporanHarianDetail | null>(null)
  const [alasan, setAlasan] = React.useState("")
  const [galat, setGalat] = React.useState<string | null>(null)
  const [mengirim, setMengirim] = React.useState(false)

  React.useEffect(() => {
    let batal = false
    ambilSatu<LaporanHarianDetail>(`/laporan-harian/${id}`)
      .then((row) => {
        if (!batal) setDetail(row)
      })
      .catch((err) => {
        if (!batal)
          setGalat(
            err instanceof ApiError
              ? err.message
              : "Gagal memuat detail laporan."
          )
      })
    return () => {
      batal = true
    }
  }, [id])

  async function kirim() {
    const alasanBersih = alasan.trim()
    if (!alasanBersih) {
      setGalat("Alasan baca ulang wajib diisi.")
      return
    }
    if (
      !detail ||
      detail.isVerified ||
      detail.pembacaanId ||
      detail.verifiedAt
    ) {
      setGalat(
        "Laporan sudah diproses atau tidak lagi dapat dikirim untuk baca ulang."
      )
      return
    }

    setMengirim(true)
    setGalat(null)
    try {
      await kirimJson(`/laporan-harian/${id}/reject`, "PATCH", {
        catatanVerif: alasanBersih,
      })
      toast.success("Laporan dikembalikan untuk dibaca ulang.")
      onSelesai()
    } catch (err) {
      setGalat(
        err instanceof ApiError
          ? err.message
          : "Gagal mengirim laporan untuk baca ulang."
      )
    } finally {
      setMengirim(false)
    }
  }

  const judul = detail
    ? `Kirim baca ulang — ${detail.pelanggan?.nama ?? detail.namaPelanggan ?? detail.nomorLangganan}`
    : "Kirim baca ulang"

  return (
    <DialogVerifikasi
      buka
      onBuka={(buka) => !buka && !mengirim && onTutup()}
      judul={judul}
      subjudul={
        detail
          ? `${formatPeriode(detail.periode)} · ${detail.pencatat?.namaLapangan ?? "Pencatat tidak diketahui"}`
          : "Memuat laporan…"
      }
      fotoLabel="Foto meter"
      fotos={
        detail
          ? [
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
            ]
          : undefined
      }
      footer={
        <div className="flex flex-col gap-2">
          {galat && (
            <Alert variant="destructive" className="py-2">
              <AlertDescription className="text-xs">{galat}</AlertDescription>
            </Alert>
          )}
          <Button
            variant="destructive"
            size="lg"
            className="w-full"
            disabled={
              !detail ||
              detail.isVerified ||
              !!detail.pembacaanId ||
              !!detail.verifiedAt ||
              mengirim ||
              alasan.trim().length === 0
            }
            onClick={() => void kirim()}
          >
            {mengirim && <Spinner className="size-3.5" />}
            Kirim untuk baca ulang
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full"
            disabled={mengirim}
            onClick={onTutup}
          >
            Tutup
          </Button>
        </div>
      }
    >
      {!detail && !galat && (
        <p className="text-sm text-muted-foreground" role="status">
          Memuat foto dan detail laporan…
        </p>
      )}
      {detail && (
        <>
          <Alert>
            <AlertDescription className="text-xs">
              Laporan dikembalikan ke petugas. Tahap V1–V3 dan nilai koreksi
              periode ini akan dikosongkan; alasan serta nilai sebelum/sesudah
              dicatat pada audit. Pembacaan resmi yang sudah terbentuk tidak
              dapat dikirim melalui tindakan ini.
            </AlertDescription>
          </Alert>
          <div className="flex flex-col gap-2">
            <label htmlFor="alasan-baca-ulang" className="text-xs font-medium">
              Alasan baca ulang
            </label>
            <Textarea
              id="alasan-baca-ulang"
              value={alasan}
              onChange={(event) => setAlasan(event.target.value)}
              maxLength={500}
              placeholder="Jelaskan apa yang perlu diperiksa atau dicatat ulang oleh petugas."
              aria-required="true"
            />
            <p className="text-right text-[11px] text-muted-foreground">
              {alasan.length}/500
            </p>
          </div>
        </>
      )}
    </DialogVerifikasi>
  )
}
