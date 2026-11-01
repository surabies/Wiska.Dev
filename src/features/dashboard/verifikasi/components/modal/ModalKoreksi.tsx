"use client"

// features/dashboard/verifikasi/components/modalKoreksi.tsx — "Koreksi Data
// Pembacaan" (menu Edit dan CHN; keduanya membuka form yang SAMA).
//
// Simpan memakai callback halaman; tata letak mengikuti form sistem lama —
// Form Edit, Data Berjalan | Data Koreksi, Stand Angkat, Riwayat Deposit.
import * as React from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Spinner } from "@/components/ui/spinner"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LABEL_KONDISI_CATAT } from "../../../lib/LabelPencatatan"
import { ambilSatu, ApiError } from "@/features/dashboard/api/ApiDashboard"
import { KELAS_KONTROL_MODAL, PilihSatu } from "../DialogVerifikasi"
import { hitungPemakaianGantiMeter } from "@/lib/domain/PerhitunganMeter"
import {
  BarisForm,
  JudulBagian,
  KerangkaModal,
  KotakBaca,
} from "../KerangkaModal"

export interface BarisDeposit {
  periode: string
  stDeposit: number | null
  depositResmi: number | null
  depositPerubahan: number | null
  sisaDeposit: number | null
}

export interface DataKoreksi {
  /** Label gabungan untuk modal lain yang masih menampilkan identitas ringkas. */
  pelanggan: string
  nomorLangganan?: string | null
  namaPelanggan?: string | null
  tarif?: string | null
  alamat?: string | null
  periode: string
  standAwal: number | null
  standAkhir: number | null
  pemakaian: number | null
  kelainan?: string | null
  kondisiAsli?: string | null
  standAwalRevisi?: number | null
  standAkhirRevisi?: number | null
  pemakaianTagihVerif?: number | null
  standAngkatLama?: number | null
  standMeterBaru?: number | null
  pelangganId?: string | null
  meterVerifId?: string | null
  /** null = tidak ada stand angkat. */
  standAngkat?: { lama: number | null; baru: number | null } | null
  riwayatDeposit?: BarisDeposit[]
}

/** Bentuk minimum baris tabel (petugas maupun mandiri) yang dibutuhkan konversi. */
export interface BarisSumberModal {
  pelangganId?: string | null
  nomorLangganan?: string | null
  periode?: number | null
  standAwal?: number | null
  standAkhir?: number | null
  pemakaian?: number | null
  kondisi?: string | null
  kondisiRevisi?: string | null
  standAwalRevisi?: number | null
  standAkhirRevisi?: number | null
  pemakaianTagihVerif?: number | null
  standAngkatLama?: number | null
  standMeterBaru?: number | null
  meterVerifId?: string | null
  golonganTarif?: string | null
  alamatPelanggan?: string | null
  namaPelanggan?: string | null
  pelanggan?: {
    id?: string
    nomorLangganan?: string
    nama?: string | null
    alamat?: string | null
    tarifGolongan?: { kodeAsli: string } | null
  } | null
}

export function dataKoreksiDariBaris(b: BarisSumberModal): DataKoreksi {
  const nomorLangganan = b.pelanggan?.nomorLangganan ?? b.nomorLangganan ?? null
  const nama = b.pelanggan?.nama ?? b.namaPelanggan ?? ""
  return {
    pelanggan: `${nomorLangganan ?? ""} ${nama}`.trim() || "—",
    nomorLangganan,
    namaPelanggan: nama || null,
    tarif: b.pelanggan?.tarifGolongan?.kodeAsli ?? b.golonganTarif ?? null,
    alamat: b.pelanggan?.alamat ?? b.alamatPelanggan ?? null,
    periode: b.periode ? String(b.periode) : "—",
    standAwal: b.standAwal ?? null,
    standAkhir: b.standAkhir ?? null,
    pemakaian: b.pemakaian ?? null,
    kelainan: b.kondisiRevisi ?? b.kondisi ?? null,
    kondisiAsli: b.kondisi ?? null,
    standAwalRevisi: b.standAwalRevisi ?? null,
    standAkhirRevisi: b.standAkhirRevisi ?? null,
    pemakaianTagihVerif: b.pemakaianTagihVerif ?? null,
    standAngkatLama: b.standAngkatLama ?? null,
    standMeterBaru: b.standMeterBaru ?? null,
    pelangganId: b.pelanggan?.id ?? b.pelangganId ?? null,
    meterVerifId: b.meterVerifId ?? null,
    standAngkat:
      b.standAngkatLama != null || b.standMeterBaru != null
        ? {
            lama: b.standAngkatLama ?? null,
            baru: b.standMeterBaru ?? null,
          }
        : null,
    riwayatDeposit: [],
  }
}

export interface HasilKoreksi {
  standAwalRevisi: number | null
  standAkhirRevisi: number | null
  pemakaianTagihVerif?: number | null
  kondisiRevisi: string | null
  standAngkatLama: number | null
  standMeterBaru: number | null
}

interface DetailKoreksiApi {
  pelanggan?: {
    nomorLangganan?: string
    nama?: string
    alamat?: string | null
    tarifGolongan?: { kodeAsli: string } | null
  } | null
}

const angka = (n: number | null | undefined) =>
  n == null ? "—" : n.toLocaleString("id-ID")

export function ModalKoreksi({
  data,
  id,
  onTutup,
  onSimpan,
  onRata3,
  bolehAturTagihan,
}: {
  data: DataKoreksi
  id: string
  onTutup: () => void
  onSimpan?: (h: HasilKoreksi) => Promise<void>
  onRata3?: () => void
  bolehAturTagihan: boolean
}) {
  const [standAkhir, setStandAkhir] = React.useState(
    String(data.standAkhirRevisi ?? data.standAkhir ?? "")
  )
  const [standAwal, setStandAwal] = React.useState(
    String(data.standAwalRevisi ?? data.standAwal ?? "")
  )
  const [taksasi, setTaksasi] = React.useState(data.pemakaianTagihVerif != null)
  const [nilaiTaksasi, setNilaiTaksasi] = React.useState(
    data.pemakaianTagihVerif == null ? "" : String(data.pemakaianTagihVerif)
  )
  const [kelainan, setKelainan] = React.useState(data.kelainan ?? "")
  const [standAngkatLama, setStandAngkatLama] = React.useState(
    data.standAngkatLama == null ? "" : String(data.standAngkatLama)
  )
  const [standMeterBaru, setStandMeterBaru] = React.useState(
    data.standMeterBaru == null ? "" : String(data.standMeterBaru)
  )
  const [galat, setGalat] = React.useState<string | null>(null)
  const [menyimpan, setMenyimpan] = React.useState(false)
  const [detail, setDetail] = React.useState<DetailKoreksiApi | null>(null)

  React.useEffect(() => {
    let batal = false
    ambilSatu<DetailKoreksiApi>(`/laporan-harian/${id}`)
      .then((row) => {
        if (!batal) setDetail(row)
      })
      .catch((err) => {
        if (!batal)
          setGalat(
            err instanceof ApiError
              ? err.message
              : "Gagal memuat detail laporan."
          )
      })
    return () => {
      batal = true
    }
  }, [id])

  const akhirNum = standAkhir === "" ? null : Number(standAkhir)
  const awalNum = standAwal === "" ? null : Number(standAwal)
  const standAngkatNum = standAngkatLama === "" ? null : Number(standAngkatLama)
  const standMeterBaruNum =
    standMeterBaru === "" ? null : Number(standMeterBaru)
  const pakai =
    kelainan === "MB"
      ? awalNum != null &&
        Number.isInteger(awalNum) &&
        standAngkatNum != null &&
        Number.isInteger(standAngkatNum) &&
        standMeterBaruNum != null &&
        Number.isInteger(standMeterBaruNum)
        ? hitungPemakaianGantiMeter({
            standAwalLama: awalNum,
            standAngkatLama: standAngkatNum,
            standMeterBaru: standMeterBaruNum,
          })
        : null
      : awalNum != null &&
          akhirNum != null &&
          Number.isInteger(awalNum) &&
          Number.isInteger(akhirNum)
        ? akhirNum - awalNum
        : null
  const riwayat = data.riwayatDeposit ?? []

  async function simpan() {
    if (!onSimpan) return
    const akhirValid =
      kelainan === "MB" ||
      (akhirNum != null && Number.isInteger(akhirNum) && akhirNum >= 0)
    const awalValid =
      kelainan !== "REV_PENCATAT" ||
      (awalNum != null && Number.isInteger(awalNum) && awalNum >= 0)
    const taksasiValid =
      !bolehAturTagihan ||
      !taksasi ||
      (nilaiTaksasi !== "" &&
        Number.isInteger(Number(nilaiTaksasi)) &&
        Number(nilaiTaksasi) >= 0)
    const meterBaruValid =
      kelainan !== "MB" ||
      (awalNum != null &&
        Number.isInteger(awalNum) &&
        awalNum >= 0 &&
        standAngkatNum != null &&
        Number.isInteger(standAngkatNum) &&
        standAngkatNum >= 0 &&
        standMeterBaruNum != null &&
        Number.isInteger(standMeterBaruNum) &&
        standMeterBaruNum >= 0)
    const pemakaianNegatif = pakai != null && pakai < 0

    const kesalahan: string[] = []
    if (!akhirValid)
      kesalahan.push("Stand akhir harus bilangan bulat minimal 0.")
    if (!awalValid)
      kesalahan.push("ST awal revisi harus bilangan bulat minimal 0.")
    if (!taksasiValid)
      kesalahan.push("Nilai taksasi harus bilangan bulat minimal 0.")
    if (!meterBaruValid)
      kesalahan.push(
        "Lengkapi stand awal meter lama, stand angkat, dan stand meter baru."
      )
    if (pemakaianNegatif) kesalahan.push("Pemakaian tidak boleh negatif.")

    if (kesalahan.length > 0) {
      setGalat(kesalahan.join(" "))
      return
    }
    setMenyimpan(true)
    setGalat(null)
    try {
      const hasil: HasilKoreksi = {
        standAwalRevisi: kelainan === "REV_PENCATAT" ? awalNum : null,
        standAkhirRevisi:
          kelainan === "MB"
            ? standAngkatNum
            : akhirNum === data.standAkhir
              ? null
              : akhirNum,
        kondisiRevisi: kelainan === data.kondisiAsli ? null : kelainan || null,
        standAngkatLama: kelainan === "MB" ? standAngkatNum : null,
        standMeterBaru: kelainan === "MB" ? standMeterBaruNum : null,
      }
      if (bolehAturTagihan) {
        hasil.pemakaianTagihVerif = taksasi
          ? Number(nilaiTaksasi)
          : kelainan === "MB"
            ? pakai
            : null
      }
      await onSimpan(hasil)
      onTutup()
    } catch (err) {
      setGalat(err instanceof Error ? err.message : "Koreksi gagal disimpan.")
    } finally {
      setMenyimpan(false)
    }
  }

  return (
    <KerangkaModal
      buka
      onBuka={(v) => !v && onTutup()}
      judul="Koreksi Data Pembacaan"
      subjudul={`${detail?.pelanggan?.nama ?? data.namaPelanggan ?? "Koreksi pembacaan"} · periode ${data.periode}`}
      lebar="xl"
      footer={
        <>
          {!onSimpan && (
            <span className="mr-auto text-[11px] text-muted-foreground">
              Tampilan saja — Simpan belum tersambung ke server.
            </span>
          )}
          <Button variant="outline" className="h-9" onClick={onTutup}>
            Batal
          </Button>
          <Button
            className="h-9"
            disabled={!onSimpan || menyimpan}
            onClick={() => void simpan()}
          >
            {menyimpan && <Spinner className="size-3.5" />}
            Simpan
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.9fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]">
        {/* ── Kiri: form edit + data berjalan/koreksi ───────────────────── */}
        <section className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <JudulBagian>Form Edit</JudulBagian>
            <BarisForm label="No. Langganan">
              <KotakBaca
                nilai={detail?.pelanggan?.nomorLangganan ?? data.nomorLangganan}
              />
            </BarisForm>
            <BarisForm label="Pelanggan">
              <KotakBaca
                nilai={detail?.pelanggan?.nama ?? data.namaPelanggan}
              />
            </BarisForm>
            <BarisForm label="Tarif">
              <KotakBaca
                nilai={detail?.pelanggan?.tarifGolongan?.kodeAsli ?? data.tarif}
              />
            </BarisForm>
            <BarisForm label="Alamat">
              <KotakBaca nilai={detail?.pelanggan?.alamat ?? data.alamat} />
            </BarisForm>
            <BarisForm label="Periode">
              <KotakBaca nilai={data.periode} />
            </BarisForm>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex min-w-0 flex-col gap-2.5">
              <JudulBagian>Data Berjalan</JudulBagian>
              <BarisForm label="Stand Awal">
                <KotakBaca nilai={data.standAwal} />
              </BarisForm>
              <BarisForm label="Stand Akhir">
                <KotakBaca nilai={data.standAkhir} />
              </BarisForm>
              <BarisForm label="Pemakaian">
                <KotakBaca nilai={data.pemakaian} />
              </BarisForm>
              <BarisForm label="Kelainan">
                <KotakBaca
                  nilai={
                    data.kelainan
                      ? (LABEL_KONDISI_CATAT[data.kelainan] ?? data.kelainan)
                      : null
                  }
                />
              </BarisForm>
              <BarisForm label="Stand Angkat" tone="destruktif">
                <KotakBaca nilai={data.standAngkat?.lama} />
              </BarisForm>
            </div>

            <div className="flex min-w-0 flex-col gap-2.5">
              <JudulBagian>Data Koreksi</JudulBagian>
              {kelainan === "REV_PENCATAT" ? (
                <BarisForm label="ST Awal revisi" htmlFor="koreksi-awal">
                  <Input
                    id="koreksi-awal"
                    type="number"
                    min={0}
                    value={standAwal}
                    onChange={(e) => setStandAwal(e.target.value)}
                    className={KELAS_KONTROL_MODAL}
                  />
                </BarisForm>
              ) : (
                <BarisForm label="Stand Awal">
                  <KotakBaca nilai={awalNum} />
                </BarisForm>
              )}
              {kelainan === "MB" ? (
                <BarisForm label="Stand akhir meter lama">
                  <KotakBaca nilai={standAngkatNum} />
                </BarisForm>
              ) : (
                <BarisForm label="Stand Akhir" htmlFor="koreksi-akhir">
                  <Input
                    id="koreksi-akhir"
                    type="number"
                    min={0}
                    value={standAkhir}
                    onChange={(e) => setStandAkhir(e.target.value)}
                    className={KELAS_KONTROL_MODAL}
                  />
                </BarisForm>
              )}
              <BarisForm label="Pakai">
                <KotakBaca nilai={pakai} />
              </BarisForm>

              {bolehAturTagihan ? (
                <div className="grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-2">
                  <Label
                    htmlFor="koreksi-taksasi"
                    className="flex items-center gap-2 text-xs font-normal text-muted-foreground"
                  >
                    <Checkbox
                      id="koreksi-taksasi"
                      checked={taksasi}
                      onCheckedChange={(v) => setTaksasi(v === true)}
                    />
                    Tagihan
                  </Label>
                  <div className="flex min-w-0 items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      disabled={!taksasi}
                      value={nilaiTaksasi}
                      onChange={(e) => setNilaiTaksasi(e.target.value)}
                      className={KELAS_KONTROL_MODAL}
                      aria-label="Pemakaian Tagihan dalam m3"
                    />
                    <Button
                      type="button"
                      variant="link"
                      className="h-auto shrink-0 p-0 text-xs text-blue-600 dark:text-blue-400"
                      onClick={onRata3}
                      disabled={!onRata3}
                    >
                      Rata3
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Nilai Tagihan hanya dapat ditetapkan oleh V3.
                </p>
              )}

              <BarisForm label="Kelainan">
                <PilihSatu
                  ariaLabel="Kelainan"
                  value={kelainan}
                  onChange={setKelainan}
                  placeholder="- Kelainan -"
                  opsi={Object.entries(LABEL_KONDISI_CATAT).map(
                    ([kode, nama]) => ({
                      value: kode,
                      label: nama,
                    })
                  )}
                />
              </BarisForm>
              {kelainan === "MB" && (
                <>
                  <BarisForm
                    label="Stand angkat meter lama"
                    htmlFor="koreksi-angkat-lama"
                  >
                    <Input
                      id="koreksi-angkat-lama"
                      type="number"
                      min={0}
                      value={standAngkatLama}
                      onChange={(e) => setStandAngkatLama(e.target.value)}
                      className={KELAS_KONTROL_MODAL}
                    />
                  </BarisForm>
                  <BarisForm
                    label="Stand meter baru"
                    htmlFor="koreksi-meter-baru"
                  >
                    <Input
                      id="koreksi-meter-baru"
                      type="number"
                      min={0}
                      value={standMeterBaru}
                      onChange={(e) => setStandMeterBaru(e.target.value)}
                      className={KELAS_KONTROL_MODAL}
                    />
                  </BarisForm>
                </>
              )}
            </div>
            {galat && (
              <Alert variant="destructive">
                <AlertDescription>{galat}</AlertDescription>
              </Alert>
            )}
          </div>
        </section>

        {/* ── Tengah: stand angkat ─────────────────────────────────────── */}
        <section className="flex min-w-0 flex-col gap-2.5 lg:border-l lg:border-border/70 lg:pl-6">
          <JudulBagian>Stand Angkat</JudulBagian>
          {data.standAngkat ? (
            <>
              <BarisForm label="Meter lama">
                <KotakBaca nilai={data.standAngkat.lama} />
              </BarisForm>
              <BarisForm label="Meter baru">
                <KotakBaca nilai={data.standAngkat.baru} />
              </BarisForm>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Tidak ada stand angkat.
            </p>
          )}
        </section>

        {/* ── Kanan: riwayat deposit ───────────────────────────────────── */}
        <section className="flex min-w-0 flex-col gap-2.5 lg:border-l lg:border-border/70 lg:pl-6">
          <JudulBagian>Riwayat Deposit</JudulBagian>
          <div className="overflow-hidden rounded-lg border border-border/70">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="h-9 w-8 text-[11px]">No</TableHead>
                  <TableHead className="h-9 text-[11px]">Periode</TableHead>
                  <TableHead className="h-9 text-right text-[11px]">
                    St Deposit
                  </TableHead>
                  <TableHead className="h-9 text-right text-[11px]">
                    Deposit Resmi
                  </TableHead>
                  <TableHead className="h-9 text-right text-[11px]">
                    Deposit Perubahan
                  </TableHead>
                  <TableHead className="h-9 text-right text-[11px]">
                    Sisa Deposit
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {riwayat.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-6 text-center text-xs text-muted-foreground"
                    >
                      Belum ada riwayat deposit.
                    </TableCell>
                  </TableRow>
                ) : (
                  riwayat.map((r, i) => (
                    <TableRow key={`${r.periode}-${i}`}>
                      <TableCell className="py-2 text-xs tabular-nums">
                        {i + 1}
                      </TableCell>
                      <TableCell className="py-2 text-xs">
                        {r.periode}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs tabular-nums">
                        {angka(r.stDeposit)}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs tabular-nums">
                        {angka(r.depositResmi)}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs tabular-nums">
                        {angka(r.depositPerubahan)}
                      </TableCell>
                      <TableCell className="py-2 text-right text-xs tabular-nums">
                        {angka(r.sisaDeposit)}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </KerangkaModal>
  )
}
