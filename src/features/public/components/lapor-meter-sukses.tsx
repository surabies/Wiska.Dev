"use client"

// features/publik/components/lapor-meter-sukses.tsx — layar konfirmasi
// setelah laporan meter terkirim.
//
// SEMUA field di sini yang membuktikan "server sungguh menerima ini"
// (status, createdAt, pesan) datang dari respons POST /lapor-meter, BUKAN
// dihitung ulang dari state form — echo dari input sendiri tidak meyakinkan
// siapa pun bahwa server benar-benar memprosesnya. Lihat pemanggilnya di
// lapor-meter-form.tsx.
import Link from "next/link"
import { ArrowRight, BadgeCheck, Clock3 } from "@/components/ui/hugeicons-compat"
import { BingkaiFoto } from "@/components/bingkai-foto"
import { Button } from "@/components/ui/button"
import { TombolUtama } from "./tombol-utama"
import { statusLaporanMandiriWarga, formatWaktu } from "../lib/format"

export interface HasilLaporanTampilan {
  nomorLangganan: string
  nama: string
  periodeLabel: string
  stand: number
  fotoPreviewUrl: string
  status: string
  createdAt: string
  pesan: string
}

export function LaporMeterSukses({ hasil, onReset }: { hasil: HasilLaporanTampilan; onReset: () => void }) {
  const status = statusLaporanMandiriWarga(hasil.status)

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-3 text-center">
        {/* Ring bercahaya, bukan lingkaran flat — bahasa visual yang sama
            dengan glow ambient di hero/showcase beranda, supaya "tanda
            terima" ini terasa istimewa, bukan sekadar ikon centang generik. */}
        <div className="relative flex size-16 items-center justify-center">
          <span aria-hidden="true" className="absolute inset-0 rounded-full bg-emerald-400/25 blur-xl" />
          <span className="relative flex size-16 items-center justify-center rounded-full border border-emerald-400/30 bg-emerald-400/10">
            <BadgeCheck className="size-8 text-success" />
          </span>
        </div>

        <div>
          <h2 className="text-xl font-bold text-foreground">Laporan terkirim</h2>
          <p className="mt-1 text-sm text-muted-foreground">{hasil.pesan}</p>
        </div>

        <span className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold " + status.badgeClass}>
          <span className={"size-1.5 rounded-full " + status.dotClass} />
          {status.label}
        </span>
      </div>

      <div className="h-px bg-border/60" />

      <div className="space-y-3">
        {[
          { label: "Nama pelanggan", value: hasil.nama },
          { label: "No. pelanggan", value: hasil.nomorLangganan, mono: true },
          { label: "Periode", value: hasil.periodeLabel },
          { label: "Stand dilaporkan", value: `${hasil.stand.toLocaleString("id-ID")} m³`, mono: true },
          { label: "Diterima server", value: `${formatWaktu(hasil.createdAt)} WIB` },
        ].map(({ label, value, mono }) => (
          <div key={label} className="flex items-start justify-between border-b border-dashed border-border/50 pb-3">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">{label}</p>
            <p className={`text-right text-sm font-medium text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">Foto terkirim</p>
        {/* Frame rasio tetap; blob: lokal jadi tanpa dialog zoom. Mode
            "utuh": angka stand meter tidak boleh terpotong crop. */}
        <BingkaiFoto src={hasil.fotoPreviewUrl} alt="Foto stand meter" mode="utuh" rasio="16/9" tanpaDialog />
      </div>

      <div className="flex items-start gap-2.5 rounded-lg bg-amber-500/10 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
        <Clock3 className="mt-0.5 size-3.5 shrink-0" />
        <p>
          Petugas memeriksa foto sebelum angka ini dipakai menghitung tagihan Anda. Pantau perkembangannya kapan saja
          lewat tab <strong>Cek laporan</strong> — tidak perlu menunggu di sini.
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {/* Nomor langganan diteruskan lewat query supaya tab "Cek laporan"
            langsung mencari otomatis (nomorAwal di CekLaporanMeterForm) —
            pola sama dengan ?nomor= di /pengaduan. */}
        <div className="min-w-0 flex-1">
          <TombolUtama asChild className="h-11 w-full font-semibold">
            <Link href={`/lapor-meter?tab=cek&nomor=${hasil.nomorLangganan}`}>
              Cek status laporan saya
              <ArrowRight className="size-4" />
            </Link>
          </TombolUtama>
        </div>
        
        {/* Bungkus juga tombol kedua dengan div flex-1 agar tingginya konsisten */}
        <div className="min-w-0 flex-1">
          <Button onClick={onReset} variant="outline" className="h-11 w-full">
            Lapor meter lain
          </Button>
        </div>
      </div>
    </div>
  )
}
