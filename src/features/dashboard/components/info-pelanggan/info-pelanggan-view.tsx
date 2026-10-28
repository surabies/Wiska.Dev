"use client"

// Perakit halaman Info Pelanggan, tata letak SAMA dengan lembar PDF:
// pita judul (berisi bilah pencarian) → identitas → stand & pemakaian
// → grafik + rincian → foto lapangan → lokasi. Halaman ini tanpa navbar,
// jadi pita judul membawa tombol Kembali.
// Pita judul: biru (chart-1) di tema terang, kartu gelap di tema gelap.
// Semua warna memakai token dari globals.css.
// Keadaan pencarian disimpan di URL (?no=...&periode=...) sehingga hasil bisa
// di-bookmark dan ditautkan dari halaman lain (mis. baris tabel DPM).
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { BlokLokasi } from "./blok-lokasi"
import { FormCari } from "./form-cari"
import { fmtPeriode } from "./format"
import { GaleriFoto } from "./galeri-foto"
import { KartuGrafik } from "./kartu-grafik"
import { KerangkaMemuat } from "./kerangka-memuat"
import { LembarCetak } from "./lembar-cetak"
import { PanelPembacaan } from "./panel-pembacaan"
import { ProfilPelanggan } from "./profil-pelanggan"
import { RincianCatat } from "./rincian-catat"
import { TombolCetak } from "./tombol-cetak"
import { useInfoPelanggan } from "./use-info-pelanggan"

const HALAMAN_ASAL = "/pengolahan-data/pelanggan"

// Tombol Cetak di atas pita biru (terang). `!` dipakai karena globals.css
// punya aturan hover tombol outline tanpa layer yang akan menimpa utilitas.
const KELAS_TOMBOL_CETAK =
  "border-info-foreground/30 bg-info-foreground/10 text-info-foreground " +
  "hover:bg-info-foreground/20! hover:text-info-foreground " +
  "dark:border-border dark:bg-transparent dark:text-foreground " +
  "dark:hover:bg-hover! dark:hover:text-foreground"

export function InfoPelangganView() {
  const router = useRouter()
  const pathname = usePathname()
  const sp = useSearchParams()
  const nomor = sp.get("no") ?? ""
  const periode = sp.get("periode") ?? ""

  const { status, data, galat } = useInfoPelanggan(nomor, periode)

  function cari(n: string, p: string) {
    const q = new URLSearchParams({ no: n })
    if (p) q.set("periode", p)
    router.replace(`${pathname}?${q}`)
  }

  function kembali() {
    if (window.history.length > 1) router.back()
    else router.push(HALAMAN_ASAL)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      {/* Pita judul: biru di terang, kartu gelap di gelap */}
      <header className="shrink-0 border-b border-chart-1 bg-chart-1 text-info-foreground dark:border-border dark:bg-card dark:text-foreground">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={kembali}
                className="-ml-1 mb-3 inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-info-foreground/80 transition-colors hover:text-info-foreground focus-visible:ring-2 focus-visible:ring-info-foreground/60 focus-visible:outline-none dark:text-muted-foreground dark:hover:text-foreground dark:focus-visible:ring-ring"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-3.5"
                  aria-hidden
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Kembali
              </button>
              <p className="text-xs text-info-foreground/80 dark:text-muted-foreground">
                Tirtawening · Laporan pencatatan meter
              </p>
              <h1 className="mt-1.5 text-3xl leading-none font-semibold tracking-heading-32 sm:text-4xl">
                Info Pelanggan
              </h1>
            </div>

            {data && (
              <div className="flex flex-col items-end gap-2 text-right">
                {data.catat && (
                  <p className="text-lg font-semibold">{fmtPeriode(data.catat.periode)}</p>
                )}
                <TombolCetak
                  judulDokumen={`Info Pelanggan ${data.pelanggan.nomorLangganan}${
                    data.catat?.periode ? ` ${data.catat.periode}` : ""
                  }`}
                  className={KELAS_TOMBOL_CETAK}
                />
              </div>
            )}
          </div>

          <FormCari
            nomor={nomor}
            periode={periode}
            memuat={status === "memuat"}
            onCari={cari}
          />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6">
        {status === "idle" && (
          <p className="py-16 text-center text-sm text-muted-foreground">
            Masukkan No. Langganan di atas untuk melihat stand meter, foto lapangan, dan
            riwayat pemakaian.
          </p>
        )}

        {status === "memuat" && <KerangkaMemuat />}

        {status === "galat" && (
          <div
            role="alert"
            className="mx-auto w-full max-w-2xl rounded-lg border border-border bg-destructive/10 px-5 py-4 text-center"
          >
            <p className="text-sm font-medium text-destructive">{galat}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Periksa nomor langganan dan periodenya, lalu cari lagi.
            </p>
          </div>
        )}

        {data && (
          <>
            <ProfilPelanggan pelanggan={data.pelanggan} />
            <PanelPembacaan catat={data.catat} riwayat={data.riwayat} />
            {data.catat && (
              // Tanpa items-start: kedua kartu otomatis sama tinggi.
              <div className="grid gap-3 lg:grid-cols-2">
                <KartuGrafik catat={data.catat} riwayat={data.riwayat} />
                <RincianCatat catat={data.catat} lokasi={data.lokasi} />
              </div>
            )}
            <GaleriFoto foto={data.foto} />
            <BlokLokasi lokasi={data.lokasi} />
            {/* Hanya tampil saat mencetak. */}
            <LembarCetak data={data} />
          </>
        )}
      </main>
    </div>
  )
}