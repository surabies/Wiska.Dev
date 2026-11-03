"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { ambilSatu, ApiError } from "@/features/dashboard/api/ApiDashboard"
import { PilihSatu } from "../DialogVerifikasi"
import { BarisTumpuk, KerangkaModal, KotakBaca } from "../KerangkaModal"
import { TabFoto } from "../foto/TabFoto"
import type { LaporanHarianDetail } from "../../types/TipeVerifikasi"
import type { DataKoreksi } from "./ModalKoreksi"

export interface HasilKondisiFoto {
  sesuai: boolean
  keterangan: string
}

export function ModalKondisiFoto({
  data,
  id,
  onTutup,
  onSimpan,
}: {
  data: Pick<DataKoreksi, "pelanggan" | "periode">
  id: string
  onTutup: () => void
  onSimpan: (hasil: HasilKondisiFoto) => Promise<void>
}) {
  const [detail, setDetail] = React.useState<LaporanHarianDetail | null>(null)
  const [galatMuat, setGalatMuat] = React.useState<string | null>(null)
  const [sesuai, setSesuai] = React.useState<"ya" | "tidak">("ya")
  const [keterangan, setKeterangan] = React.useState("")
  const [galat, setGalat] = React.useState<string | null>(null)
  const [menyimpan, setMenyimpan] = React.useState(false)

  React.useEffect(() => {
    let batal = false
    ambilSatu<LaporanHarianDetail>(`/laporan-harian/${id}`)
      .then((row) => {
        if (!batal) setDetail(row)
      })
      .catch((error: unknown) => {
        if (!batal) {
          setGalatMuat(
            error instanceof ApiError
              ? error.message
              : "Gagal memuat foto dan detail laporan."
          )
        }
      })
    return () => {
      batal = true
    }
  }, [id])

  async function simpan() {
    if (!detail) {
      setGalat("Foto dan detail laporan belum berhasil dimuat.")
      return
    }
    const catatan = keterangan.trim()
    if (sesuai === "tidak" && catatan.length < 5) {
      setGalat(
        "Tuliskan keterangan minimal 5 karakter untuk kondisi yang tidak sesuai."
      )
      return
    }

    setMenyimpan(true)
    setGalat(null)
    try {
      await onSimpan({ sesuai: sesuai === "ya", keterangan: catatan })
    } catch (error) {
      setGalat(
        error instanceof Error
          ? error.message
          : "Penilaian kondisi foto gagal disimpan."
      )
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <KerangkaModal
      buka
      onBuka={(buka) => !buka && !menyimpan && onTutup()}
      judul="Kondisi Foto dan Lapangan"
      subjudul={`${data.pelanggan} · periode ${data.periode}`}
      lebar="sm"
      footer={
        <>
          <Button
            variant="outline"
            size="lg"
            onClick={onTutup}
            disabled={menyimpan}
          >
            Batal
          </Button>
          <Button
            size="lg"
            onClick={() => void simpan()}
            disabled={menyimpan || !detail}
          >
            {menyimpan && <Spinner className="size-3.5" />}
            Simpan Penilaian
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {galat && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {galat}
          </p>
        )}
        <BarisTumpuk label="Pelanggan">
          <KotakBaca nilai={data.pelanggan} />
        </BarisTumpuk>
        <BarisTumpuk label="Periode">
          <KotakBaca nilai={data.periode} />
        </BarisTumpuk>
        {galatMuat ? (
          <p role="alert" className="text-sm text-destructive">
            {galatMuat}
          </p>
        ) : detail ? (
          <TabFoto
            varian="zoom"
            item={[
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
          />
        ) : (
          <p role="status" className="text-sm text-muted-foreground">
            <Spinner className="mr-2 inline size-4" />
            Memuat foto dan detail laporan…
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Penilaian disimpan ke riwayat audit dan tidak mengubah stand atau
          status verifikasi.
        </p>
        <BarisTumpuk label="Kondisi foto sesuai?">
          <PilihSatu
            ariaLabel="Kondisi foto sesuai"
            value={sesuai}
            onChange={(v) => setSesuai(v as "ya" | "tidak")}
            opsi={[
              { value: "ya", label: "Ya" },
              { value: "tidak", label: "Tidak" },
            ]}
          />
        </BarisTumpuk>
        <BarisTumpuk label="Keterangan" htmlFor="kondisi-foto-ket">
          <Textarea
            id="kondisi-foto-ket"
            rows={3}
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            className="text-sm"
            placeholder="Mis. foto buram, segel rusak, meter tertutup"
            maxLength={500}
          />
        </BarisTumpuk>
      </div>
    </KerangkaModal>
  )
}
