// features/publik/components/hasil-tagihan/tab-info.tsx — profil sambungan
// pelanggan: alamat, golongan tarif, stand meter terakhir, status sambungan.
import { FieldLabel, FieldValue, StatusDot } from "./atoms"
import type { HasilCekTagihan } from "../../lib/api"

function InfoField({ label, value, colSpan = false }: { label: string; value: React.ReactNode; colSpan?: boolean }) {
  return (
    <div className={`border-b border-dashed border-border/50 pb-3 ${colSpan ? "col-span-2" : ""}`}>
      <FieldLabel>{label}</FieldLabel>
      {value}
    </div>
  )
}

export function TabInfo({ hasil }: { hasil: HasilCekTagihan }) {
  const { pelanggan, tagihan } = hasil
  const terbaru = tagihan[0]

  const alamat = [pelanggan.alamat, pelanggan.rt && pelanggan.rw ? `RT ${pelanggan.rt}/RW ${pelanggan.rw}` : null].filter(Boolean).join(", ")
  const aktif = pelanggan.status === "AKTIF"

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4">
      <InfoField label="Nama pelanggan" colSpan value={<FieldValue>{pelanggan.nama}</FieldValue>} />
      <InfoField label="Alamat" colSpan value={<FieldValue>{alamat || "—"}</FieldValue>} />
      <InfoField label="Golongan tarif" value={<FieldValue mono>{pelanggan.tarifGolongan?.kodeAsli ?? "—"}</FieldValue>} />
      <InfoField label="Kategori" value={<FieldValue>{pelanggan.tarifGolongan?.kategori ?? "—"}</FieldValue>} />

      {terbaru?.standLalu != null && terbaru.standAkhir != null && (
        <>
          <InfoField label="Stand meter lalu" value={<FieldValue mono>{terbaru.standLalu.toLocaleString("id-ID")} m³</FieldValue>} />
          <InfoField label="Stand meter terkini" value={<FieldValue mono>{terbaru.standAkhir.toLocaleString("id-ID")} m³</FieldValue>} />
        </>
      )}

      <InfoField
        label="Status sambungan"
        colSpan
        value={
          <div className="flex items-center gap-1.5">
            <StatusDot className={aktif ? "bg-success" : "bg-destructive"} />
            <FieldValue className={aktif ? "text-success" : "text-destructive"}>
              {aktif ? "Aktif" : pelanggan.status}
            </FieldValue>
          </div>
        }
      />
    </div>
  )
}
