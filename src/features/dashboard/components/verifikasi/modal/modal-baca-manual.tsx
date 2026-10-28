"use client"

// features/dashboard/components/verifikasi/modal-baca-manual.tsx — modal
// "Baca Manual" (menu ADD): input stand secara manual untuk pelanggan yang
// belum punya setoran. HANYA TAMPILAN; logika menyusul.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LABEL_KONDISI_CATAT } from "../../../lib/label"
import { KELAS_KONTROL_MODAL, PilihSatu } from "../dialog-verifikasi"
import { BarisTumpuk, KerangkaModal, KotakBaca } from "../kerangka-modal"
import type { DataKoreksi } from "./modal-koreksi"

export interface HasilBacaManual {
  standAwal: number | null
  standAkhir: number | null
  taksasi: boolean
  nilaiTaksasi: string
  kelainan: string
}

export function ModalBacaManual({
  data,
  onTutup,
  onSimpan,
}: {
  data: Pick<DataKoreksi, "pelanggan" | "tarif" | "periode" | "standAwal">
  onTutup: () => void
  /** Belum diberikan = Simpan hanya menutup modal (logika menyusul). */
  onSimpan?: (h: HasilBacaManual) => void
}) {
  const [standAwal, setStandAwal] = React.useState(data.standAwal == null ? "" : String(data.standAwal))
  const [standAkhir, setStandAkhir] = React.useState("")
  const [taksasi, setTaksasi] = React.useState(false)
  const [nilaiTaksasi, setNilaiTaksasi] = React.useState("")
  const [kelainan, setKelainan] = React.useState("")

  const awalNum = standAwal === "" ? null : Number(standAwal)
  const akhirNum = standAkhir === "" ? null : Number(standAkhir)
  const pakai =
    awalNum != null && akhirNum != null && Number.isFinite(awalNum) && Number.isFinite(akhirNum)
      ? Math.max(0, akhirNum - awalNum)
      : null

  return (
    <KerangkaModal
      buka
      onBuka={(v) => !v && onTutup()}
      judul="Baca Manual"
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
              onSimpan?.({
                standAwal: awalNum != null && Number.isFinite(awalNum) ? awalNum : null,
                standAkhir: akhirNum != null && Number.isFinite(akhirNum) ? akhirNum : null,
                taksasi,
                nilaiTaksasi,
                kelainan,
              })
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
        <BarisTumpuk label="Tarif"><KotakBaca nilai={data.tarif} /></BarisTumpuk>
        <BarisTumpuk label="Periode"><KotakBaca nilai={data.periode} /></BarisTumpuk>

        <div className="grid gap-4 sm:grid-cols-2">
          <BarisTumpuk label="St Awal" htmlFor="manual-awal">
            <Input
              id="manual-awal"
              type="number"
              min={0}
              value={standAwal}
              onChange={(e) => setStandAwal(e.target.value)}
              className={KELAS_KONTROL_MODAL}
            />
          </BarisTumpuk>
          <BarisTumpuk label="St Akhir" htmlFor="manual-akhir">
            <Input
              id="manual-akhir"
              type="number"
              min={0}
              value={standAkhir}
              onChange={(e) => setStandAkhir(e.target.value)}
              className={KELAS_KONTROL_MODAL}
            />
          </BarisTumpuk>
        </div>

        <BarisTumpuk label="Pakai"><KotakBaca nilai={pakai} /></BarisTumpuk>

        <div className="flex flex-col gap-2">
          <Label htmlFor="manual-taksasi" className="flex items-center gap-2 text-xs font-medium">
            <Checkbox
              id="manual-taksasi"
              checked={taksasi}
              onCheckedChange={(v) => setTaksasi(v === true)}
            />
            Taksasi
          </Label>
          <Input
            type="number"
            min={0}
            disabled={!taksasi}
            value={nilaiTaksasi}
            onChange={(e) => setNilaiTaksasi(e.target.value)}
            className={KELAS_KONTROL_MODAL}
            aria-label="Nilai taksasi"
          />
        </div>

        <BarisTumpuk label="Kelainan">
          <PilihSatu
            ariaLabel="Kelainan"
            value={kelainan}
            onChange={setKelainan}
            placeholder="- Kelainan -"
            opsi={Object.entries(LABEL_KONDISI_CATAT).map(([kode, nama]) => ({
              value: kode,
              label: nama,
            }))}
          />
        </BarisTumpuk>
      </div>
    </KerangkaModal>
  )
}