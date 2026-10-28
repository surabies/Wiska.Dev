"use client"

// features/dashboard/components/verifikasi/modal-kondisi-foto.tsx — modal
// "Kondisi Foto dan Lapangan": pelanggan + periode (baca-saja), penilaian
// kesesuaian foto, dan keterangan. HANYA TAMPILAN; logika menyusul.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { PilihSatu } from "../dialog-verifikasi"
import { BarisTumpuk, KerangkaModal, KotakBaca } from "../kerangka-modal"
import type { DataKoreksi } from "./modal-koreksi"

export interface HasilKondisiFoto {
  sesuai: "ya" | "tidak"
  keterangan: string
}

export function ModalKondisiFoto({
  data,
  onTutup,
  onSimpan,
}: {
  data: Pick<DataKoreksi, "pelanggan" | "periode">
  onTutup: () => void
  /** Belum diberikan = Simpan hanya menutup modal (logika menyusul). */
  onSimpan?: (h: HasilKondisiFoto) => void
}) {
  const [sesuai, setSesuai] = React.useState<"ya" | "tidak">("ya")
  const [keterangan, setKeterangan] = React.useState("")

  return (
    <KerangkaModal
      buka
      onBuka={(v) => !v && onTutup()}
      judul="Kondisi Foto dan Lapangan"
      subjudul={`${data.pelanggan} · periode ${data.periode}`}
      lebar="sm"
      footer={
        <>
          {!onSimpan && (
            <span className="mr-auto text-[11px] text-muted-foreground">
              Tampilan saja — belum tersambung ke server.
            </span>
          )}
          <Button variant="outline" className="h-9" onClick={onTutup}>
            Batal
          </Button>
          <Button
            className="h-9"
            onClick={() => {
              onSimpan?.({ sesuai, keterangan: keterangan.trim() })
              onTutup()
            }}
          >
            Simpan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <BarisTumpuk label="Pelanggan"><KotakBaca nilai={data.pelanggan} /></BarisTumpuk>
        <BarisTumpuk label="Periode"><KotakBaca nilai={data.periode} /></BarisTumpuk>
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
          />
        </BarisTumpuk>
      </div>
    </KerangkaModal>
  )
}