"use client";

import * as React from "react";
import { AreaTinggiLayar } from "@/components/layout/page/AreaTinggiLayar";
import {
  TabLembaran,
  type ItemTab,
} from "@/components/layout/page/TabLembaran";
import { Button } from "@/components/ui/button";
import { ambilSatu, kirimJson } from "../../lib/api-client";

type KunciTab = "satuan" | "massal";

const TAB: ItemTab<KunciTab>[] = [
  { kunci: "satuan", label: "Manual Add" },
  { kunci: "massal", label: "Manual Add All" },
];

type Pelanggan = {
  id: string;
  nomorLangganan: string;
  nama: string;
  alamat: string;
  nomorMeter: string | null;
  meterAktif: boolean;
  meterAmbigu: boolean;
  standTerakhir: number | null;
  pemakaianTerakhir: number | null;
  sudahAdaLaporan: boolean;
  bolehTimpaLaporan: boolean;
};

type Opsi = {
  periode: number | null;
  rute: { id: string; kode: string }[];
  pencatat: { id: string; nama: string }[];
};

type ItemManualAdd = {
  daftarCatatId: string;
  pelangganId: string;
  nomorLangganan: string;
  nama: string;
  alamat: string;
  taksasi: number;
  metode?:
    | "RATA_RATA_12_BULAN"
    | "TIGA_TERTINGGI"
    | "RIWAYAT_TERSEDIA"
    | "TANPA_HISTORI";
  standTerakhir: number;
  pemakaianLalu: number | null;
  nomorMeter: string | null;
  manualProvenance?: {
    standSumber: { id: string; periode: string; standAwal: number } | null;
    sumberPembacaan: { id: string; periode: string; pemakaianRiil: number }[];
  };
};

type HasilMassal = {
  dibuat: number;
  duplikat: number;
  totalDipilih: number;
};

const INPUT_CLASS =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-60";
const LABEL_CLASS = "grid gap-1.5 text-sm font-medium text-foreground";
const UKURAN_BATCH = 25;
const ALASAN_MASSAL_DEFAULT =
  "Alamat belum disetorkan petugas; pencatatan dilakukan melalui Manual Add All.";

function periodeDariInput(nilai: string) {
  const [tahun, bulan] = nilai.split("-").map(Number);
  return tahun && bulan ? tahun * 100 + bulan : null;
}

function inputDariPeriode(periode: number) {
  const tahun = Math.floor(periode / 100);
  const bulan = periode % 100;
  return `${tahun}-${String(bulan).padStart(2, "0")}`;
}

function pesanError(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Terjadi kesalahan yang tidak diketahui.";
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className={LABEL_CLASS}>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Notifikasi({
  error,
  pesan,
}: {
  error: string | null;
  pesan: string | null;
}) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
      >
        {error}
      </p>
    );
  }
  if (pesan) {
    return (
      <p
        role="status"
        className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground"
      >
        {pesan}
      </p>
    );
  }
  return null;
}

export function ManualAddClient() {
  const [tab, setTab] = React.useState<KunciTab>("satuan");
  const [periode, setPeriode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pesan, setPesan] = React.useState<string | null>(null);

  const [nomor, setNomor] = React.useState("");
  const [pelanggan, setPelanggan] = React.useState<Pelanggan[]>([]);
  const [pilihan, setPilihan] = React.useState<Pelanggan | null>(null);
  const [standAwal, setStandAwal] = React.useState("");
  const [standAkhir, setStandAkhir] = React.useState("");
  const [alasanSatuan, setAlasanSatuan] = React.useState("");
  const [konfirmasiTimpa, setKonfirmasiTimpa] = React.useState(false);
  const [mencari, setMencari] = React.useState(false);
  const [menyimpanSatuan, setMenyimpanSatuan] = React.useState(false);

  const [opsi, setOpsi] = React.useState<Opsi>({
    periode: null,
    rute: [],
    pencatat: [],
  });
  const [opsiLoading, setOpsiLoading] = React.useState(false);
  const [ruteId, setRuteId] = React.useState("");
  const [pencatatId, setPencatatId] = React.useState("");
  const [alasanMassal, setAlasanMassal] = React.useState(
    ALASAN_MASSAL_DEFAULT,
  );
  const [daftarManualAdd, setDaftarManualAdd] = React.useState<
    ItemManualAdd[] | null
  >(null);
  const [pilihanIds, setPilihanIds] = React.useState<Set<string>>(new Set());
  const [memuatDaftar, setMemuatDaftar] = React.useState(false);
  const [menyimpanMassal, setMenyimpanMassal] = React.useState(false);
  const [progresMassal, setProgresMassal] = React.useState<{
    selesai: number;
    total: number;
  } | null>(null);

  const nomorPeriode = periodeDariInput(periode);
  const pemakaianSatuan =
    standAwal !== "" && standAkhir !== ""
      ? Number(standAkhir) - Number(standAwal)
      : null;

  React.useEffect(() => {
    let active = true;
    setOpsiLoading(true);
    setError(null);
    ambilSatu<Opsi>("/manual-add/opsi", {
      periode: nomorPeriode ?? undefined,
      pencatatId: pencatatId || undefined,
      ruteId: ruteId || undefined,
    })
      .then((data) => {
        if (active) {
          setOpsi(data);
          if (nomorPeriode === null && data.periode !== null) {
            setPeriode(inputDariPeriode(data.periode));
          }
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(pesanError(cause));
      })
      .finally(() => {
        if (active) setOpsiLoading(false);
      });
    return () => {
      active = false;
    };
  }, [nomorPeriode, pencatatId, ruteId]);

  React.useEffect(() => {
    let active = true;
    setDaftarManualAdd(null);
    setPilihanIds(new Set());
    setProgresMassal(null);
    if (nomorPeriode === null || !pencatatId || !ruteId) {
      setMemuatDaftar(false);
      return () => {
        active = false;
      };
    }

    setError(null);
    setPesan(null);
    setMemuatDaftar(true);
    ambilSatu<ItemManualAdd[]>("/manual-add/daftar", {
      periode: nomorPeriode,
      ruteId,
      pencatatId,
    })
      .then((hasil) => {
        if (active) setDaftarManualAdd(hasil);
      })
      .catch((cause: unknown) => {
        if (active) {
          setDaftarManualAdd(null);
          setError(pesanError(cause));
        }
      })
      .finally(() => {
        if (active) setMemuatDaftar(false);
      });

    return () => {
      active = false;
    };
  }, [nomorPeriode, pencatatId, ruteId]);

  async function cariPelanggan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nomorPeriode === null) return;
    setError(null);
    setPesan(null);
    setMencari(true);
    setPilihan(null);
    setPelanggan([]);
    try {
      const hasil = await ambilSatu<Pelanggan[]>("/manual-add/cari-pelanggan", {
        nomor: nomor.trim(),
        periode: nomorPeriode,
      });
      setPelanggan(hasil);
      if (hasil.length === 0) setPesan("Pelanggan aktif tidak ditemukan.");
    } catch (cause) {
      setError(pesanError(cause));
    } finally {
      setMencari(false);
    }
  }

  function pilihPelanggan(item: Pelanggan) {
    setPilihan(item);
    setKonfirmasiTimpa(false);
    setStandAwal(item.standTerakhir == null ? "" : String(item.standTerakhir));
    setStandAkhir(item.standTerakhir == null ? "" : String(item.standTerakhir));
    setPesan(null);
    setError(null);
  }

  async function simpanSatuan(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pilihan || nomorPeriode === null) return;
    setError(null);
    setPesan(null);
    setMenyimpanSatuan(true);
    try {
      await kirimJson("/manual-add/satuan", "POST", {
        pelangganId: pilihan.id,
        periode: nomorPeriode,
        standAwal: Number(standAwal),
        standAkhir: Number(standAkhir),
        alasanManual: alasanSatuan,
      });
      setPesan(
        pilihan.bolehTimpaLaporan
          ? `Hasil lama ${pilihan.nomorLangganan} diganti. Status verifikasi direset; laporan menunggu verifikasi ulang.`
          : `Laporan ${pilihan.nomorLangganan} tersimpan dan menunggu verifikasi.`,
      );
      setPelanggan((items) =>
        items.map((item) =>
          item.id === pilihan.id
            ? {
                ...item,
                sudahAdaLaporan: true,
                bolehTimpaLaporan: false,
              }
            : item,
        ),
      );
      setPilihan((item) =>
        item
          ? {
              ...item,
              sudahAdaLaporan: true,
              bolehTimpaLaporan: false,
            }
          : item,
      );
    } catch (cause) {
      setError(pesanError(cause));
    } finally {
      setMenyimpanSatuan(false);
    }
  }

  async function simpanMassal() {
    if (nomorPeriode === null || !ruteId || !pencatatId) return;
    const dipilih = (daftarManualAdd ?? []).filter((item) =>
      pilihanIds.has(item.daftarCatatId),
    );
    if (dipilih.length === 0) return;
    const alasanManual = alasanMassal.trim() || ALASAN_MASSAL_DEFAULT;
    setError(null);
    setPesan(null);
    setAlasanMassal(alasanManual);
    setMenyimpanMassal(true);
    setProgresMassal({ selesai: 0, total: dipilih.length });
    let selesai = 0;
    try {
      let totalDibuat = 0;
      let totalDuplikat = 0;
      for (let offset = 0; offset < dipilih.length; offset += UKURAN_BATCH) {
        const batch = dipilih.slice(offset, offset + UKURAN_BATCH);
        const hasil = await kirimJson<HasilMassal>(
          "/manual-add/massal",
          "POST",
          {
            periode: nomorPeriode,
            ruteId,
            pencatatId,
            daftarCatatIds: batch.map((item) => item.daftarCatatId),
            alasanManual,
          },
        );
        totalDibuat += hasil.dibuat;
        totalDuplikat += hasil.duplikat;
        selesai += batch.length;
        setProgresMassal({ selesai, total: dipilih.length });
        setDaftarManualAdd((daftar) =>
          daftar?.filter(
            (item) =>
              !batch.some(
                (diproses) =>
                  diproses.daftarCatatId === item.daftarCatatId,
              ),
          ) ?? null,
        );
        setPilihanIds((sebelumnya) => {
          const berikutnya = new Set(sebelumnya);
          batch.forEach((item) => berikutnya.delete(item.daftarCatatId));
          return berikutnya;
        });
      }
      setPesan(
        `Selesai: ${totalDibuat} laporan ditambahkan; ${totalDuplikat} duplikat yang muncul saat proses dilewati.`,
      );
    } catch (cause) {
      setError(
        selesai > 0
          ? `Proses berhenti setelah ${selesai} dari ${dipilih.length} alamat diproses. ${pesanError(cause)}`
          : pesanError(cause),
      );
    } finally {
      setMenyimpanMassal(false);
    }
  }

  return (
    <AreaTinggiLayar className="flex min-h-0 flex-col">
      <TabLembaran
        label="Manual Add"
        tab={TAB}
        aktif={tab}
        onGanti={(value) => {
          setTab(value);
          setError(null);
          setPesan(null);
        }}
        className="min-h-0 flex-1"
        panelClassName="overflow-y-auto p-4"
      >
        {tab === "satuan" ? (
          <section className="mx-auto grid w-full max-w-4xl gap-5">
            <header>
              <h2 className="text-lg font-semibold">
                Tambah laporan satu pelanggan
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Cari nomor pelanggan, masukkan stand secara manual, lalu kirim
                untuk verifikasi.
              </p>
            </header>
            <Notifikasi error={error} pesan={pesan} />
            <form
              onSubmit={cariPelanggan}
              className="grid gap-3 sm:grid-cols-[1fr_12rem_auto] sm:items-end"
            >
              <Field label="Nomor pelanggan">
                <input
                  className={INPUT_CLASS}
                  value={nomor}
                  onChange={(event) => setNomor(event.target.value)}
                  inputMode="numeric"
                  maxLength={11}
                  autoComplete="off"
                  required
                />
              </Field>
              <Field label="Periode">
                <input
                  className={INPUT_CLASS}
                  type="month"
                  value={periode}
                  onChange={(event) => {
                    setPeriode(event.target.value);
                    setPilihan(null);
                    setPelanggan([]);
                  }}
                  required
                />
              </Field>
              <Button
                type="submit"
                disabled={mencari || nomor.trim().length < 2}
              >
                {mencari ? "Mencari..." : "Cari pelanggan"}
              </Button>
            </form>

            {pelanggan.length > 0 && (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full min-w-2xl text-left text-sm">
                  <thead className="bg-muted/50 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Pilih</th>
                      <th className="px-3 py-2">No. Pel</th>
                      <th className="px-3 py-2">Nama / Alamat</th>
                      <th className="px-3 py-2">Meter aktif</th>
                      <th className="px-3 py-2">ST resmi terakhir</th>
                      <th className="px-3 py-2">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pelanggan.map((item) => (
                      <tr key={item.id} className="border-t border-border">
                        <td className="px-3 py-2 font-mono">
                          {item.nomorLangganan}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.nama}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.alamat}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          {item.meterAmbigu
                            ? "Data meter ambigu"
                            : (item.nomorMeter ?? "Tidak ada")}
                        </td>
                        <td className="px-3 py-2">
                          {item.standTerakhir ?? "Belum tersedia"}
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                              !item.meterAktif ||
                              (item.sudahAdaLaporan && !item.bolehTimpaLaporan)
                            }
                            onClick={() => pilihPelanggan(item)}
                          >
                            {item.bolehTimpaLaporan
                              ? "Pilih untuk timpa"
                              : item.sudahAdaLaporan
                                ? "Sudah ada"
                                : "Pilih"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {pilihan && (
              <form
                onSubmit={simpanSatuan}
                className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4"
              >
                <div>
                  <h3 className="font-semibold">
                    {pilihan.nomorLangganan} · {pilihan.nama}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {pilihan.alamat}
                  </p>
                </div>
                {pilihan.bolehTimpaLaporan && (
                  <div className="grid gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
                    <p>
                      Laporan ini sudah diverifikasi. Menimpa akan menghapus
                      penanda V1–V3 dan mengembalikan hasil ke antrean
                      verifikasi. Pembacaan yang sudah ditagihkan tidak dapat
                      ditimpa.
                    </p>
                    <label className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={konfirmasiTimpa}
                        onChange={(event) =>
                          setKonfirmasiTimpa(event.target.checked)
                        }
                      />
                      <span>
                        Saya memahami hasil lama diganti dan perlu diverifikasi
                        ulang.
                      </span>
                    </label>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="ST Awal">
                    <input
                      className={INPUT_CLASS}
                      type="number"
                      min="0"
                      step="1"
                      value={standAwal}
                      onChange={(event) => setStandAwal(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label="ST Akhir">
                    <input
                      className={INPUT_CLASS}
                      type="number"
                      min="0"
                      step="1"
                      value={standAkhir}
                      onChange={(event) => setStandAkhir(event.target.value)}
                      required
                    />
                  </Field>
                </div>
                <p className="text-sm text-muted-foreground">
                  Perkiraan Pakai dari selisih stand: {pemakaianSatuan ?? "—"} m³.
                  Jika stand mundur, laporan tetap masuk untuk ditinjau dan
                  tidak diubah menjadi nol.
                </p>
                <Field
                  label={
                    pilihan.bolehTimpaLaporan
                      ? "Alasan penggantian hasil"
                      : "Alasan Manual Add"
                  }
                >
                  <textarea
                    className={`${INPUT_CLASS} min-h-20 py-2`}
                    value={alasanSatuan}
                    onChange={(event) => setAlasanSatuan(event.target.value)}
                    maxLength={500}
                    minLength={5}
                    required
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    disabled={
                      menyimpanSatuan ||
                      !pilihan.meterAktif ||
                      (pilihan.sudahAdaLaporan && !pilihan.bolehTimpaLaporan) ||
                      (pilihan.bolehTimpaLaporan && !konfirmasiTimpa)
                    }
                  >
                    {menyimpanSatuan
                      ? "Menyimpan..."
                      : pilihan.sudahAdaLaporan && !pilihan.bolehTimpaLaporan
                        ? "Sudah tersimpan"
                        : pilihan.bolehTimpaLaporan
                          ? "Ganti hasil & ulangi verifikasi"
                          : "Simpan untuk verifikasi"}
                  </Button>
                  <span className="text-xs text-muted-foreground">
                    Data tidak menjadi hasil resmi atau tagihan sebelum V3.
                  </span>
                </div>
              </form>
            )}
          </section>
        ) : (
          <section className="mx-auto grid w-full max-w-6xl gap-5">
            <header>
              <h2 className="text-lg font-semibold">
                Tambah laporan massal berdasarkan rute dan petugas
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Sistem menghitung rata-rata pemakaian dari histori resmi yang
                tersedia. ST Awal dan ST Akhir mengambil angka ST Awal dari
                pencatatan resmi terakhir, dan nilainya sama. Jika tidak ada
                pencatatan sebelumnya, keduanya 0. Jika terdapat beberapa
                meter aktif, sistem memakai meter terbaru.
              </p>
            </header>
            <Notifikasi error={error} pesan={pesan} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Periode">
                <input
                  className={INPUT_CLASS}
                  type="month"
                  value={periode}
                  onChange={(event) => {
                    setPeriode(event.target.value);
                    setDaftarManualAdd(null);
                    setProgresMassal(null);
                    setRuteId("");
                    setPencatatId("");
                  }}
                  required
                />
              </Field>
              <Field label="Petugas">
                <select
                  className={INPUT_CLASS}
                  value={pencatatId}
                  onChange={(event) => {
                    setPencatatId(event.target.value);
                    setRuteId("");
                    setDaftarManualAdd(null);
                    setPilihanIds(new Set());
                    setProgresMassal(null);
                  }}
                  disabled={opsiLoading}
                  required
                >
                  <option value="">Pilih petugas</option>
                  {opsi.pencatat.length === 0 && (
                    <option value="" disabled>
                      Tidak ada petugas dengan daftar yang belum disetorkan
                    </option>
                  )}
                  {opsi.pencatat.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.nama}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rute">
                <select
                  className={INPUT_CLASS}
                  value={ruteId}
                  onChange={(event) => {
                    setRuteId(event.target.value);
                    setDaftarManualAdd(null);
                    setPilihanIds(new Set());
                    setProgresMassal(null);
                  }}
                  disabled={!pencatatId || opsiLoading}
                  required
                >
                  <option value="">Pilih rute</option>
                  {opsi.rute.length === 0 && (
                    <option value="" disabled>
                      Tidak ada rute dengan daftar yang belum disetorkan
                    </option>
                  )}
                  {opsi.rute.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.kode}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <p className="text-sm text-muted-foreground">
              Daftar alamat yang belum disetorkan petugas dimuat otomatis
              setelah Petugas dan Rute dipilih. Taksasi dihitung otomatis untuk
              setiap alamat yang memenuhi syarat; centang alamat yang akan
              ditambahkan ke antrean verifikasi.
            </p>

            <Field label="Alasan Manual Add All">
              <textarea
                className={`${INPUT_CLASS} min-h-20 py-2`}
                value={alasanMassal}
                onChange={(event) => setAlasanMassal(event.target.value)}
                maxLength={500}
                placeholder="Contoh: petugas berhalangan karena sakit"
              />
            </Field>
            <p className="-mt-4 text-xs text-muted-foreground">
              Jika alasan dikosongkan, alasan umum Manual Add All akan dicatat
              otomatis.
            </p>

            {progresMassal && (
              <div className="grid gap-1">
                <progress
                  className="h-2 w-full accent-primary"
                  max={progresMassal.total}
                  value={progresMassal.selesai}
                  aria-label="Progres Manual Add All"
                />
                <p className="text-xs text-muted-foreground" role="status">
                  Taksasi dan penambahan: {progresMassal.selesai} dari{" "}
                  {progresMassal.total} alamat diproses.
                </p>
              </div>
            )}

            {memuatDaftar && (
              <p className="text-sm text-muted-foreground" role="status">
                Memuat daftar alamat dan menghitung taksasi...
              </p>
            )}

            {daftarManualAdd && (
              <div className="grid min-h-0 gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm">
                    {daftarManualAdd.length} alamat · {pilihanIds.size} dipilih
                  </p>
                  <Button
                    type="button"
                    disabled={menyimpanMassal || pilihanIds.size === 0}
                    onClick={simpanMassal}
                  >
                    {menyimpanMassal
                      ? "Menyimpan..."
                      : `Tambah yang dipilih (${pilihanIds.size})`}
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={
                      daftarManualAdd.length > 0 &&
                      daftarManualAdd.every((item) =>
                        pilihanIds.has(item.daftarCatatId),
                      )
                    }
                    disabled={
                      menyimpanMassal || daftarManualAdd.length === 0
                    }
                    onChange={(event) => {
                      setPilihanIds(
                        event.target.checked
                          ? new Set(
                              daftarManualAdd.map((item) => item.daftarCatatId),
                            )
                          : new Set(),
                      );
                    }}
                  />
                  Pilih semua alamat
                </label>
                <div className="max-h-112 overflow-auto rounded-lg border border-border">
                  <table className="w-full min-w-208 text-left text-sm">
                    <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Pilih</th>
                        <th className="px-3 py-2">No. Pel</th>
                        <th className="px-3 py-2">Nama</th>
                        <th className="px-3 py-2">ST Awal</th>
                        <th className="px-3 py-2">ST Akhir</th>
                        <th className="px-3 py-2">Pakai</th>
                      </tr>
                    </thead>
                    <tbody>
                      {daftarManualAdd.length === 0 ? (
                        <tr>
                          <td
                            className="px-3 py-6 text-center text-muted-foreground"
                            colSpan={6}
                          >
                            Tidak ada alamat yang belum disetorkan untuk filter
                            ini.
                          </td>
                        </tr>
                      ) : (
                        daftarManualAdd.map((item) => (
                          <tr
                            key={item.daftarCatatId}
                            className="border-t border-border"
                          >
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                aria-label={`Pilih ${item.nomorLangganan}`}
                                checked={pilihanIds.has(item.daftarCatatId)}
                                disabled={menyimpanMassal}
                                onChange={(event) => {
                                  setPilihanIds((sebelumnya) => {
                                    const berikutnya = new Set(sebelumnya);
                                    if (event.target.checked) {
                                      berikutnya.add(item.daftarCatatId);
                                    } else {
                                      berikutnya.delete(item.daftarCatatId);
                                    }
                                    return berikutnya;
                                  });
                                }}
                              />
                            </td>
                            <td className="px-3 py-2 font-mono">
                              {item.nomorLangganan}
                            </td>
                            <td className="px-3 py-2">{item.nama}</td>
                            <td className="px-3 py-2">{item.standTerakhir}</td>
                            <td className="px-3 py-2">{item.standTerakhir}</td>
                            <td className="px-3 py-2">
                              {item.taksasi} m³
                              {item.metode && (
                                <div className="text-xs text-muted-foreground">
                                  {item.metode === "RATA_RATA_12_BULAN"
                                    ? "Rata-rata 12 bulan"
                                    : item.metode === "TIGA_TERTINGGI"
                                      ? "Rata-rata 3 tertinggi"
                                      : item.metode === "RIWAYAT_TERSEDIA"
                                        ? "Rata-rata histori tersedia"
                                        : "Tanpa histori: 0 m³"}
                                  {item.manualProvenance &&
                                    ` · ${item.manualProvenance.sumberPembacaan.length} pembacaan`}
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
      </TabLembaran>
    </AreaTinggiLayar>
  );
}
