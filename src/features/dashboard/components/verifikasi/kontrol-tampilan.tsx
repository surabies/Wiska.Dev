"use client"

// features/dashboard/components/verifikasi/kontrol-tampilan.tsx — kelompok
// tombol ikon (ToggleGroup) untuk mengatur TAMPILAN halaman: lipat/buka kartu
// ringkasan dan, bila ada, kerapatan baris. Tiap tombol berikon saja dan
// dijelaskan Tooltip — ruang toolbar dihemat, maknanya tidak hilang.
//
// Dipakai halaman petugas (ringkasan + kerapatan) dan pelanggan (ringkasan).
import { DashboardSquare01Icon, Menu01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function KontrolTampilan({
  ringkasanTerbuka,
  onRingkasan,
  padat,
  onPadat,
}: {
  ringkasanTerbuka: boolean
  onRingkasan: (buka: boolean) => void
  /** Hanya diisi halaman yang punya tabel berkerapatan (petugas). */
  padat?: boolean
  onPadat?: (padat: boolean) => void
}) {
  // type="multiple": dua tombol saling bebas; nilai = daftar yang sedang AKTIF.
  const nilai = [ringkasanTerbuka ? "ringkasan" : "", padat ? "padat" : ""].filter(Boolean)

  return (
    <ToggleGroup
      type="multiple"
      variant="outline"
      size="sm"
      value={nilai}
      onValueChange={(v) => {
        onRingkasan(v.includes("ringkasan"))
        onPadat?.(v.includes("padat"))
      }}
      aria-label="Tampilan halaman"
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem value="ringkasan" aria-label="Kartu ringkasan">
            <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} className="size-4" aria-hidden />
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent>{ringkasanTerbuka ? "Sembunyikan ringkasan" : "Tampilkan ringkasan"}</TooltipContent>
      </Tooltip>

      {onPadat && (
        <Tooltip>
          <TooltipTrigger asChild>
            <ToggleGroupItem value="padat" aria-label="Kerapatan baris padat">
              <HugeiconsIcon icon={Menu01Icon} strokeWidth={2} className="size-4" aria-hidden />
            </ToggleGroupItem>
          </TooltipTrigger>
          <TooltipContent>{padat ? "Kerapatan normal" : "Kerapatan padat"}</TooltipContent>
        </Tooltip>
      )}
    </ToggleGroup>
  )
}