"use client"

// Impor cadangan lapangan — dua pintu terpisah (catatan dan foto). Periode
// dinyatakan di depan, lalu server mengadu tiap berkas dengan pernyataan itu.
// Alasan lengkapnya ada di blok catatan laporan-harian.router.ts.
import * as React from "react"
import { FileTextIcon, Image01Icon } from "@hugeicons/core-free-icons"
import { TabLembaran, type ItemTab } from "@/components/layout/page/TabLembaran"
import { FormImpor } from "./impor-cadangan/form-impor"
import { PanelHasil } from "./impor-cadangan/panel-hasil"
import type { HasilImpor, KunciImpor } from "./impor-cadangan/tipe"

const TAB: ItemTab<KunciImpor>[] = [
  { kunci: "catatan", label: "Catatan pencatatan", icon: FileTextIcon },
  { kunci: "foto", label: "Foto bukti", icon: Image01Icon },
]

const KODE = "rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground"

export function ImporCadanganClient() {
  const [aktif, setAktif] = React.useState<KunciImpor>("catatan")
  const [hasil, setHasil] = React.useState<HasilImpor | null>(null)

  function ganti(kunci: KunciImpor) {
    setAktif(kunci)
    setHasil(null)
  }

  return (
    <div className="flex max-w-3xl flex-col gap-4">
      <TabLembaran
        label="Jenis impor"
        tab={TAB}
        aktif={aktif}
        onGanti={ganti}
        panelClassName="p-5 sm:p-6"
      >
        {aktif === "catatan" ? (
          <FormImpor
            judul="Impor catatan pencatatan"
            keterangan="Berkas CSV yang diekspor aplikasi petugas. Dari sinilah baris pembacaan dibuat, jadi impor ini lebih dulu agar foto punya induk untuk dilampiri."
            accept=".csv,text/csv,.zip,application/zip"
            format="CSV atau ZIP"
            path="/laporan-harian/impor/catatan"
            onHasil={setHasil}
          />
        ) : (
          <FormImpor
            judul="Impor foto bukti"
            keterangan={
              <>
                Satu jenis per unggahan. Nama berkas mengikuti pola <code className={KODE}>periode_tipe_nomor</code>,
                mis. <code className={KODE}>202607_rumah_00700800867.jpg</code>, dan harus cocok dengan periode
                serta jenis yang dipilih.
              </>
            }
            accept="image/jpeg,image/png,image/webp,video/mp4,.zip,application/zip"
            format="JPG, PNG, WEBP, MP4, atau ZIP"
            path="/laporan-harian/impor/foto"
            denganJenis
            onHasil={setHasil}
          />
        )}
      </TabLembaran>

      {hasil && <PanelHasil hasil={hasil} />}
    </div>
  )
}