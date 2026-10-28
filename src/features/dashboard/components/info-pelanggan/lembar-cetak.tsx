"use client"

// Lembar cetak/PDF A4 bergaya laporan modern: pita judul, identitas
// pelanggan, roda angka stand, kartu pemakaian, grafik periode, rincian, lalu
// foto lapangan. Semua data fungsional lama tetap ada ditambah koordinat
// lokasi sebagai pengganti peta.
//
// Di layar lembar ini tersembunyi. Saat mencetak, SEMUA isi halaman lain
// disembunyikan dan hanya lembar ini yang tampil — lewat portal ke <body>
// supaya tidak terpengaruh overflow/tinggi layout. Aturan cetak (@page,
// display, print-color-adjust) ada di globals.css.
//
// TIDAK ADA warna hardcode di sini. Kelas `.lembar-cetak` di globals.css ikut
// memakai blok palet TERANG (`:root, .lembar-cetak`), sehingga semua token
// (bg-card, bg-primary, bg-info, ...) selalu terang di dalam lembar ini dan
// hasil cetak sama di mode terang maupun gelap.
import * as React from "react"
import { flushSync, createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { LABEL_KONDISI_CATAT, LABEL_STATUS_PELANGGAN } from "../../lib/label"
import {
  fmtAngka,
  fmtPeriode,
  fmtPeriodeSingkat,
  fmtRupiah,
  fmtTeks,
  fmtWaktu,
} from "./format"
import { bandingkan } from "./panel-pembacaan"
import type { InfoPelanggan } from "./tipe"

const NADA_STATUS: Record<string, string> = {
  AKTIF: "border-success/30 bg-success-muted text-success",
  TUTUP_SEMENTARA: "border-warning/30 bg-warning-muted text-warning",
  DISEGEL: "border-destructive/30 bg-destructive/10 text-destructive",
  TUTUP_SPT: "border-destructive/30 bg-destructive/10 text-destructive",
}

function Chip({ label, nilai }: { label: string; nilai: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-[10px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{nilai}</span>
    </span>
  )
}

function RodaAngka({ label, nilai }: { label: string; nilai: number | null }) {
  const teks = nilai == null ? null : String(Math.max(0, Math.trunc(nilai))).padStart(5, "0")
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="mb-1.5 text-[10px] text-muted-foreground">{label}</p>
      {teks ? (
        <div className="flex gap-[1.5px]">
          {[...teks].map((d, i) => (
            <span
              key={i}
              className="flex h-[9mm] w-[6mm] items-center justify-center rounded-xs bg-primary font-mono text-[15px] font-medium text-primary-foreground"
            >
              {d}
            </span>
          ))}
        </div>
      ) : (
        <p className="h-[9mm] text-[15px] text-muted-foreground">—</p>
      )}
    </div>
  )
}

function BarisRincian({ label, nilai }: { label: string; nilai: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border-subtle py-1 last:border-b-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium text-foreground">{nilai}</dd>
    </div>
  )
}

function KotakFoto({ judul, src }: { judul: string; src: string | null }) {
  return (
    <figure className="min-w-0">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={`Foto ${judul}`}
          loading="eager"
          className="aspect-square w-full rounded-md border border-border object-cover"
        />
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-border bg-muted text-[10px] text-muted-foreground">
          Foto tidak dikirim
        </div>
      )}
      <figcaption className="mt-1 text-[10px] text-muted-foreground">{judul}</figcaption>
    </figure>
  )
}

export function LembarCetak({ data }: { data: InfoPelanggan }) {
  // Portal hanya bisa ke document.body setelah mount di klien.
  const klien = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  )

  // Waktu cetak diperbarui tepat sebelum dialog cetak dibuka.
  const [waktuCetak, setWaktuCetak] = React.useState(() =>
    fmtWaktu(new Date().toISOString())
  )
  React.useEffect(() => {
    const perbarui = () =>
      flushSync(() => setWaktuCetak(fmtWaktu(new Date().toISOString())))
    window.addEventListener("beforeprint", perbarui)
    return () => window.removeEventListener("beforeprint", perbarui)
  }, [])

  if (!klien) return null

  const { pelanggan: p, catat: c, riwayat, lokasi, foto } = data
  const kondisi = c?.kondisi
    ? ((LABEL_KONDISI_CATAT as Record<string, string>)[c.kondisi] ?? c.kondisi)
    : null
  const labelStatus = p.status
    ? ((LABEL_STATUS_PELANGGAN as Record<string, string>)[p.status] ?? p.status)
    : null
  const banding = c ? bandingkan(c, riwayat) : null

  const batang = c
    ? [
        ...[...riwayat].reverse().map((r) => ({
          periode: r.periode,
          nilai: r.pemakaianM3,
          aktif: false,
        })),
        { periode: c.periode, nilai: c.pemakaianM3, aktif: true },
      ]
    : []
  const maks = Math.max(1, ...batang.map((b) => b.nilai ?? 0))

  return createPortal(
    <div className="lembar-cetak bg-card text-foreground">
      {/* Pita judul */}
      <header className="flex items-end justify-between bg-primary px-[12mm] pt-[9mm] pb-[7mm] text-primary-foreground">
        <div>
          <p className="text-[10px] text-primary-foreground/70">
            Tirtawening · Laporan pencatatan meter
          </p>
          <h1 className="mt-1.5 text-[26px] leading-none font-semibold tracking-tight">
            Info Pelanggan
          </h1>
        </div>
        <div className="text-right text-[10px] leading-snug text-primary-foreground/70">
          <p className="text-[14px] font-semibold text-primary-foreground">
            {c ? fmtPeriode(c.periode) : "—"}
          </p>
          <p>Dicetak {waktuCetak}</p>
        </div>
      </header>

      <div className="flex flex-col gap-[6mm] px-[12mm] pt-[8mm] pb-[10mm] text-[11px] leading-snug">
        {/* Identitas */}
        <section>
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h2 className="text-[22px] leading-tight font-semibold tracking-tight">
                {p.nama || "Tanpa nama"}
              </h2>
              {p.alamat && (
                <p className="mt-1 max-w-[115mm] text-[11px] text-muted-foreground">
                  {p.alamat}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] text-muted-foreground">No. Langganan</p>
              <p className="font-mono text-[15px] font-semibold tabular-nums">
                {p.nomorLangganan}
              </p>
              {labelStatus && (
                <span
                  className={cn(
                    "mt-1 inline-block rounded-full border px-2 py-px text-[10px] font-medium",
                    NADA_STATUS[p.status ?? ""] ?? "border-border bg-muted text-foreground"
                  )}
                >
                  {labelStatus}
                </span>
              )}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.golongan && <Chip label="Golongan" nilai={p.golongan} />}
            {p.nomorMeter && <Chip label="Meter" nilai={p.nomorMeter} />}
            {p.ukuranMeter && <Chip label="Ukuran" nilai={p.ukuranMeter} />}
            {p.noHp && p.noHp !== "0" && <Chip label="Telepon" nilai={p.noHp} />}
          </div>
        </section>

        {/* Stand & pemakaian */}
        <section>
          {c ? (
            <div className="grid grid-cols-[1fr_1fr_1.15fr] gap-3">
              <RodaAngka label="Stand awal" nilai={c.standLalu} />
              <RodaAngka label="Stand akhir" nilai={c.standAkhir} />
              <div className="rounded-lg bg-info p-3 text-info-foreground">
                <p className="text-[10px] text-info-foreground/80">Pemakaian</p>
                <p className="mt-1 flex items-baseline gap-1">
                  <span className="text-[34px] leading-none font-semibold tracking-tight tabular-nums">
                    {fmtAngka(c.pemakaianM3)}
                  </span>
                  <span className="text-[13px] text-info-foreground/80">m³</span>
                </p>
                {banding && (
                  <p className="mt-1.5 text-[10px] text-info-foreground/80">{banding.teks}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-muted-foreground">
              Belum ada pencatatan untuk periode ini.
            </p>
          )}
        </section>

        {/* Grafik + rincian */}
        {c && (
          <section className="grid grid-cols-2 gap-3">
            <div className="flex flex-col rounded-lg border border-border p-3">
              <p className="mb-2 text-[11px] font-semibold">
                Pemakaian per periode{" "}
                <span className="font-normal text-muted-foreground">(m³)</span>
              </p>
              <div className="flex h-[34mm] gap-2.5">
                {batang.map((b) => (
                  <div key={b.periode} className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="relative min-h-0 flex-1">
                      <div
                        className={cn(
                          "absolute inset-x-0 bottom-0 rounded-t-xs",
                          b.aktif ? "bg-chart-1" : "bg-muted-foreground/30"
                        )}
                        style={{
                          height: `${b.nilai == null ? 0 : Math.max(4, (b.nilai / maks) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className="text-center leading-tight">
                      <p
                        className={cn(
                          "text-[11px] tabular-nums",
                          b.aktif ? "font-semibold" : "font-medium"
                        )}
                      >
                        {fmtAngka(b.nilai)}
                      </p>
                      <p className="text-[9px] text-muted-foreground">
                        {fmtPeriodeSingkat(b.periode)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border p-3">
              <p className="mb-1 text-[11px] font-semibold">Rincian pencatatan</p>
              <dl className="text-[10.5px]">
                <BarisRincian label="Periode" nilai={fmtPeriode(c.periode)} />
                {kondisi && <BarisRincian label="Kondisi" nilai={kondisi} />}
                <BarisRincian label="Petugas" nilai={fmtTeks(c.petugas)} />
                <BarisRincian label="Dicatat" nilai={fmtWaktu(c.waktuCatat)} />
                {c.waktuUpload && (
                  <BarisRincian label="Diunggah" nilai={fmtWaktu(c.waktuUpload)} />
                )}
                {c.biaya != null && <BarisRincian label="Biaya" nilai={fmtRupiah(c.biaya)} />}
                {lokasi && (
                  <BarisRincian
                    label="Koordinat"
                    nilai={`${lokasi.lat.toFixed(6)}, ${lokasi.lng.toFixed(6)}`}
                  />
                )}
              </dl>
            </div>
          </section>
        )}

        {/* Foto */}
        <section>
          <h3 className="mb-2 text-[12px] font-semibold">Foto lapangan</h3>
          <div className="grid grid-cols-3 gap-3">
            <KotakFoto judul="Stand meter" src={foto.stand} />
            <KotakFoto judul="Segel" src={foto.segel} />
            <KotakFoto judul="Rumah" src={foto.rumah} />
          </div>
        </section>

        <footer className="flex justify-between border-t border-border pt-2 text-[9px] text-muted-foreground">
          <span>
            Tirtawening · Info Pelanggan {p.nomorLangganan}
            {c ? ` · ${c.periode}` : ""}
          </span>
          <span>Dicetak otomatis dari sistem</span>
        </footer>
      </div>
    </div>,
    document.body
  )
}