"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { ambilSatu } from "@/features/dashboard/api/ApiDashboard"
import { ALASAN_MANUAL } from "../../../tambah-manual/lib/AlasanManual"
import { KELAS_KONTROL_MODAL } from "../DialogVerifikasi"
import { BarisTumpuk, KerangkaModal } from "../KerangkaModal"
import type { DataKoreksi } from "./ModalKoreksi"

type PelangganManual = {
  id: string
  nomorLangganan: string
  nama: string
  tarifGolongan: { kodeAsli: string } | null
  nomorMeter: string | null
  meterAktif: boolean
  meterAmbigu: boolean
  standTerakhir: number | null
  sudahAdaLaporan: boolean
  bolehTimpaLaporan: boolean
}

export interface HasilBacaManual {
  pelangganId: string
  standAwal: number
  standAkhir: number
  pemakaian: number
  alasanManual: string
}

type DataBacaManual = Pick<
  DataKoreksi,
  "pelanggan" | "tarif" | "periode" | "pelangganId"
> & {
  nomorLangganan: string | null
  periodeId: number | null
}

function pesanError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan yang tidak diketahui."
}

export function ModalBacaManual({
  data,
  onTutup,
  onSimpan,
}: {
  data: DataBacaManual
  onTutup: () => void
  onSimpan: (hasil: HasilBacaManual) => Promise<void>
}) {
  const [pelanggan, setPelanggan] = React.useState<PelangganManual | null>(null)
  const [standAwal, setStandAwal] = React.useState("")
  const [standAkhir, setStandAkhir] = React.useState("")
  const [pemakaianInput, setPemakaianInput] = React.useState<string | null>(
    null
  )
  const [alasanManual, setAlasanManual] = React.useState<string>(
    ALASAN_MANUAL.pencatatan
  )
  const [galat, setGalat] = React.useState<string | null>(null)
  const [memuat, setMemuat] = React.useState(true)
  const [menyimpan, setMenyimpan] = React.useState(false)

  React.useEffect(() => {
    let batal = false
    if (!data.nomorLangganan || !data.periodeId) {
      setPelanggan(null)
      setGalat("Data pelanggan atau periode tidak lengkap untuk Manual ADD.")
      setMemuat(false)
      return () => {
        batal = true
      }
    }

    setGalat(null)
    setPelanggan(null)
    setMemuat(true)
    ambilSatu<PelangganManual[]>("/manual-add/cari-pelanggan", {
      nomor: data.nomorLangganan,
      periode: data.periodeId,
    })
      .then((hasil) => {
        if (batal) return
        const ditemukan = data.pelangganId
          ? hasil.find((item) => item.id === data.pelangganId)
          : hasil.find((item) => item.nomorLangganan === data.nomorLangganan)
        if (!ditemukan) {
          setGalat(
            "Pelanggan tidak ditemukan, belum tertaut, atau sudah tidak aktif."
          )
          return
        }
        setPelanggan(ditemukan)
        const standAwalOtomatis = ditemukan.standTerakhir ?? 0
        setStandAwal(String(standAwalOtomatis))
        setStandAkhir(String(standAwalOtomatis))
        setPemakaianInput(null)
        setAlasanManual(
          ditemukan.sudahAdaLaporan
            ? ALASAN_MANUAL.koreksi
            : ALASAN_MANUAL.pencatatan
        )
      })
      .catch((error: unknown) => {
        if (!batal) setGalat(pesanError(error))
      })
      .finally(() => {
        if (!batal) setMemuat(false)
      })

    return () => {
      batal = true
    }
  }, [data.nomorLangganan, data.pelangganId, data.periodeId])

  const awal = standAwal === "" ? null : Number(standAwal)
  const akhir = standAkhir === "" ? null : Number(standAkhir)
  const pemakaianDihitung =
    awal != null &&
    akhir != null &&
    Number.isInteger(awal) &&
    Number.isInteger(akhir)
      ? akhir - awal
      : null
  const pemakaian =
    pemakaianInput ??
    (pemakaianDihitung == null ? "" : String(pemakaianDihitung))
  const nilaiPemakaian = pemakaian === "" ? null : Number(pemakaian)
  const dataMeterValid = pelanggan?.meterAktif && !pelanggan.meterAmbigu
  const laporanBolehDitimpa =
    pelanggan != null &&
    (!pelanggan.sudahAdaLaporan || pelanggan.bolehTimpaLaporan)

  async function simpan() {
    const angkaValid = (nilai: number | null): nilai is number =>
      nilai != null &&
      Number.isInteger(nilai) &&
      nilai >= 0 &&
      nilai <= 2_147_483_647
    const pemakaianValid =
      nilaiPemakaian != null &&
      Number.isInteger(nilaiPemakaian) &&
      nilaiPemakaian >= -2_147_483_648 &&
      nilaiPemakaian <= 2_147_483_647
    if (
      !pelanggan ||
      !dataMeterValid ||
      !laporanBolehDitimpa ||
      !angkaValid(awal) ||
      !angkaValid(akhir) ||
      !pemakaianValid ||
      alasanManual.trim().length < 5
    ) {
      setGalat(
        !dataMeterValid
          ? "Pelanggan harus memiliki tepat satu meter aktif."
          : !laporanBolehDitimpa
            ? "Hasil yang sudah dipakai tagihan atau memiliki pembacaan lain tidak dapat ditimpa."
            : "Isi ST dan pemakaian dengan bilangan bulat yang valid."
      )
      return
    }

    setMenyimpan(true)
    setGalat(null)
    try {
      await onSimpan({
        pelangganId: pelanggan.id,
        standAwal: awal,
        standAkhir: akhir,
        pemakaian: nilaiPemakaian,
        alasanManual: alasanManual.trim(),
      })
    } catch (error) {
      setGalat(pesanError(error))
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <KerangkaModal
      buka
      onBuka={(buka) => !buka && !menyimpan && onTutup()}
      judul="Baca Manual"
      subjudul={`${data.pelanggan} · periode ${data.periode}`}
      lebar="lg"
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
            disabled={
              memuat ||
              menyimpan ||
              !pelanggan ||
              !dataMeterValid ||
              !laporanBolehDitimpa
            }
          >
            {menyimpan && <Spinner className="size-3.5" />}
            Simpan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {galat && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {galat}
          </p>
        )}
        {memuat && (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Spinner className="size-4" />
            Memuat data pelanggan dan stand terakhir…
          </p>
        )}
        {pelanggan && (
          <>
            <section className="grid gap-3 rounded-xl border border-border/70 bg-muted/20 p-4 sm:grid-cols-3">
              <div className="min-w-0 sm:col-span-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Pelanggan
                </p>
                <p
                  className="mt-1 truncate font-semibold text-foreground"
                  title={pelanggan.nama}
                >
                  {pelanggan.nomorLangganan} · {pelanggan.nama}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Tarif
                </p>
                <p className="mt-1 text-sm font-medium">
                  {pelanggan.tarifGolongan?.kodeAsli ?? data.tarif ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Periode
                </p>
                <p className="mt-1 text-sm font-medium">
                  {data.periode || "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  Nomor meter
                </p>
                <p className="mt-1 text-sm font-medium">
                  {pelanggan.nomorMeter || "—"}
                </p>
              </div>
            </section>
            <p className="text-sm text-muted-foreground">
              ST Awal terisi dari pembacaan resmi terakhir sebelum periode ini.
              Sesuaikan bila hasil pencatatan berbeda.
            </p>
            {!dataMeterValid && (
              <p role="alert" className="text-sm text-destructive">
                Pelanggan harus memiliki tepat satu meter aktif.
              </p>
            )}
            {!laporanBolehDitimpa && (
              <p role="alert" className="text-sm text-destructive">
                Laporan periode ini masih menunggu verifikasi, sudah dipakai
                tagihan, atau memiliki pembacaan lain sehingga tidak dapat
                ditimpa melalui Manual Add.
              </p>
            )}
            {pelanggan.sudahAdaLaporan && laporanBolehDitimpa && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-sm">
                Hasil lama akan diganti dan laporan kembali ke antrean
                verifikasi.
              </p>
            )}
            <section className="grid gap-4 rounded-xl border border-border/70 p-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <h3 className="text-sm font-semibold">Hasil pencatatan</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Masukkan angka sesuai pencatatan. Pemakaian dapat disesuaikan
                  dari hasil selisih stand.
                </p>
              </div>
              <BarisTumpuk label="ST Awal" htmlFor="manual-awal">
                <Input
                  id="manual-awal"
                  type="number"
                  min={0}
                  step={1}
                  value={standAwal}
                  onChange={(event) => setStandAwal(event.target.value)}
                  className={KELAS_KONTROL_MODAL}
                />
              </BarisTumpuk>
              <BarisTumpuk label="ST Akhir" htmlFor="manual-akhir">
                <Input
                  id="manual-akhir"
                  type="number"
                  min={0}
                  step={1}
                  value={standAkhir}
                  onChange={(event) => setStandAkhir(event.target.value)}
                  className={KELAS_KONTROL_MODAL}
                />
              </BarisTumpuk>
              <BarisTumpuk label="Pemakaian (m³)" htmlFor="manual-pemakaian">
                <Input
                  id="manual-pemakaian"
                  type="number"
                  min={-2_147_483_648}
                  max={2_147_483_647}
                  step={1}
                  value={pemakaian}
                  onChange={(event) => setPemakaianInput(event.target.value)}
                  className={KELAS_KONTROL_MODAL}
                />
              </BarisTumpuk>
            </section>
            <div className="grid gap-1.5">
              <p className="text-xs font-medium text-foreground">
                Catatan audit
              </p>
              <p className="rounded-md border border-border/70 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
                {alasanManual}
              </p>
            </div>
          </>
        )}
      </div>
    </KerangkaModal>
  )
}
