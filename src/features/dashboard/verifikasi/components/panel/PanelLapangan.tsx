"use client"

// features/dashboard/verifikasi/components/panelLapangan.tsx — panel detail
// halaman verifikasi laporan petugas lapangan.
//
// MURNI PENAMPIL DETAIL. Verifikasi V1/V2/V3 langsung dijalankan dari menu
// klik kanan; dialog tindakan dikelola halaman agar terbuka tanpa menunggu
// panel detail selesai memuat.
//
// Isi panel berupa tumpukan SEKSI LIPAT (kartu). Informasi dan Stand terbuka
// bawaan; histori, foto, ring, dan lokasi tertutup — dan baru mengambil data
// saat dibuka.
import * as React from "react"
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  CursorPointer01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Skeleton } from "@/components/ui/skeleton"
import { formatTanggal } from "@/features/public/lib/Format"
import { ambilSatu, ApiError } from "@/features/dashboard/api/ApiDashboard"
import { LABEL_KONDISI_CATAT } from "@/features/dashboard/lib/LabelPencatatan"
import { label } from "@/features/dashboard/lib/Label"
import type { LaporanHarianDetail } from "../../types/TipeVerifikasi"
import { tahapLaporanHarian, ringVerif } from "../../types/TipeVerifikasi"
import { GridStand, InfoPelanggan, PanelKosong, Seksi } from "./KomponenPanel"
import { FotoSebelumnya } from "../foto/FotoSebelumnya"
import { TabFoto } from "../foto/TabFoto"
import { HistoriPemakaian } from "../HistoriPemakaian"
import { PetaLokasi } from "../PetaLokasi"
import { TEKS_RING } from "../../types/WarnaTahap"
import { tentukanHasilPembacaan } from "../../lib/HasilPembacaan"

/// Baris progres ring V1/V2/V3 — penampil murni. Warna per ring SAMA dengan
/// kolom Ring di tabel, dan ketiganya diperlakukan setara.
function ProgresRing({ detail }: { detail: LaporanHarianDetail }) {
  const ring = ringVerif(detail)
  const baris: {
    label: string
    nama: string | null
    tanggal?: string | null
    warna: string
  }[] = [
    {
      label: "V1 · Supervisor",
      nama: ring.v1,
      tanggal: detail.verif1At,
      warna: TEKS_RING[1],
    },
    {
      label: "V2 · Manager",
      nama: ring.v2,
      tanggal: detail.verif2At,
      warna: TEKS_RING[2],
    },
    {
      label: "V3 · Senior Manager",
      nama: ring.v3,
      tanggal: detail.verif3At,
      warna: TEKS_RING[3],
    },
  ]
  return (
    <div className="flex flex-col divide-y divide-border/60">
      {baris.map((b) => (
        <div
          key={b.label}
          className="flex flex-col gap-0.5 py-1.5 first:pt-0 last:pb-0"
        >
          <span className="text-[9px] font-semibold tracking-widest text-muted-foreground uppercase">
            {b.label}
          </span>
          {b.nama ? (
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium ${b.warna}`}
            >
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                strokeWidth={2}
                className="size-3 shrink-0"
                aria-hidden
              />
              {b.nama}
              {b.tanggal ? ` · ${formatTanggal(b.tanggal)}` : ""}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">—</span>
          )}
        </div>
      ))}
    </div>
  )
}

export function PanelLapangan({
  id,
  ambangAnomali,
}: {
  id: string | null
  ambangAnomali: number
}) {
  const [detail, setDetail] = React.useState<LaporanHarianDetail | null>(null)
  const [galat, setGalat] = React.useState<string | null>(null)
  // Pemicu muat ulang setelah aksi. State awal selalu bersih tiap ganti baris
  // karena parent me-remount panel lewat `key`.
  React.useEffect(() => {
    if (!id) return
    let batal = false
    ;(async () => {
      try {
        const row = await ambilSatu<LaporanHarianDetail>(
          `/laporan-harian/${id}`
        )
        if (batal) return
        setDetail(row)
        setGalat(null)
      } catch (err) {
        if (!batal)
          setGalat(
            err instanceof ApiError
              ? err.message
              : "Gagal memuat detail laporan."
          )
      }
    })()
    return () => {
      batal = true
    }
  }, [id])

  if (!id) {
    return (
      <PanelKosong
        icon={CursorPointer01Icon}
        pesan="Klik baris untuk melihat detail; klik kanan baris untuk aksi verifikasi (V1/V2/V3, cek ulang, batalkan)."
      />
    )
  }
  if (!detail && !galat) {
    return (
      <div className="flex flex-col gap-2 p-3">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    )
  }
  if (!detail) {
    return (
      <p className="p-4 text-center text-xs text-destructive">
        {galat ?? "Detail tidak ditemukan."}
      </p>
    )
  }

  const tahap = tahapLaporanHarian(detail)
  const nama = detail.pelanggan?.nama ?? detail.namaPelanggan ?? "Tanpa nama"
  const alamat = detail.pelanggan?.alamat ?? detail.alamatPelanggan
  const anomali =
    detail.persentase != null && Math.abs(detail.persentase) > ambangAnomali

  // Tiga angka yang sama di panel Petugas dan Pelanggan.
  const {
    standAwal,
    standAkhir: stAkhir,
    pemakaian: pakai,
  } = tentukanHasilPembacaan(detail)

  return (
    <div className="flex min-w-0 flex-col gap-2 p-3">
      <Seksi id="info" judul="Informasi pelanggan" awalBuka>
        <InfoPelanggan
          nama={nama}
          status={tahap}
          nomor={detail.nomorLangganan}
          kondisi={label(LABEL_KONDISI_CATAT, detail.kondisi)}
          alamat={alamat}
        />
        {!detail.pelanggan && (
          <p className="text-[11px] text-amber-700 dark:text-amber-400">
            Nomor langganan ini belum terhubung ke data pelanggan — verifikasi
            belum bisa dijalankan sebelum pelanggannya ter-import.
          </p>
        )}
      </Seksi>

      <Seksi id="stand" judul="Stand meter" awalBuka>
        <GridStand
          sel={[
            { label: "ST awal", nilai: standAwal },
            { label: "ST akhir", nilai: stAkhir, nada: "info" },
            { label: "Pakai", nilai: pakai, nada: "sukses" },
          ]}
        />
      </Seksi>

      <Seksi id="histori" judul="Histori pemakaian (3 bulan)">
        <HistoriPemakaian pelangganId={detail.pelanggan?.id} />
      </Seksi>

      <Seksi id="foto" judul="Foto periode berjalan">
        <TabFoto
          varian="panel"
          item={[
            {
              kunci: "stand",
              label: "Stand meter",
              url: detail.fotoStandUrl ?? detail.pembacaan?.fotoBukti,
              keteranganKosong:
                "Laporan petugas dari sistem lama tidak menyertakan foto.",
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
      </Seksi>

      <Seksi id="foto-lalu" judul="Foto periode sebelumnya">
        <FotoSebelumnya
          pelangganId={detail.pelanggan?.id}
          periode={detail.periode}
        />
      </Seksi>

      <Seksi id="ring" judul="Verifikasi berjenjang">
        <ProgresRing detail={detail} />
      </Seksi>

      <Seksi id="lokasi" judul="Lokasi">
        <PetaLokasi
          langsung
          lat={detail.pelanggan?.geoLat}
          lng={detail.pelanggan?.geoLong}
        />
      </Seksi>

      {tahap === "RESMI" && (
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400">
          Sudah menjadi pembacaan resmi
          {detail.verifiedBy?.name
            ? ` — approve final ${detail.verifiedBy.name}`
            : ""}
          {detail.verifiedAt ? ` (${formatTanggal(detail.verifiedAt)})` : ""}.
        </p>
      )}
      {tahap === "DITOLAK" && (
        <p className="text-[11px] text-muted-foreground">
          Dikembalikan untuk cek ulang
          {detail.verifiedBy?.name ? ` oleh ${detail.verifiedBy.name}` : ""}
          {detail.catatanVerif ? ` — “${detail.catatanVerif}”` : ""}. Klik kanan
          barisnya untuk memverifikasi ulang bila ternyata benar.
        </p>
      )}
      {detail.catatanVerif && tahap !== "DITOLAK" && (
        <p className="text-[11px] text-muted-foreground">
          Catatan verifikasi: “{detail.catatanVerif}”
        </p>
      )}
    </div>
  )
}
