"use client";

// features/dashboard/components/verifikasi/modal-lapangan.tsx — modal aksi
// verifikasi berjenjang V1→V2→V3: foto (tab stand/segel/rumah) berdampingan
// dengan isian koreksi. Ketiga ring memakai modal yang sama; V1 juga memilih
// meter tujuan. Plus mode "cek ulang" (tolak).
//
// Meter tujuan dipilih manual: `nomorMeter` di laporan bisa duplikat/orphan,
// jadi penentuan meter yang benar adalah keputusan verifikator. Revisi TIDAK
// menimpa angka catat petugas — pembacaan resmi memakai revisi saat V3.
//
// Modal hanya dirender saat aksi diminta, jadi state isian selalu mulai bersih.
import * as React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatPeriode } from "@/features/public/lib/format";
import { hitungPemakaianGantiMeter } from "@/lib/domain/perhitungan-meter";
import { kirimJson, ApiError } from "../../../lib/api-client";
import { LABEL_KONDISI_CATAT } from "../../../lib/label";
import type { LaporanHarianDetail, MeterRingkas } from "../types/tipe";
import { Bagian } from "../panel/panel-bagian";
import { DialogVerifikasi, KELAS_KONTROL_MODAL, PilihSatu } from "../dialog-verifikasi";

export function ModalLapangan({
  detail,
  meters,
  meterAwal,
  ring,
  tolakAwal,
  onTutup,
  onSelesai,
}: {
  detail: LaporanHarianDetail;
  meters: MeterRingkas[];
  /** Prapilih dari panel: meter yang nomornya cocok, lalu meter aktif. */
  meterAwal: string;
  /** Ring yang sedang dikerjakan. Ketiganya menerima koreksi yang sama. */
  ring: 1 | 2 | 3;
  /** true = langsung mode cek ulang. */
  tolakAwal: boolean;
  onTutup: () => void;
  onSelesai: () => void;
}) {
  const [meterId, setMeterId] = React.useState(meterAwal);
  const [blokTarif, setBlokTarif] = React.useState(String(detail.blokTarifVerif ?? 1));
  const [revisi, setRevisi] = React.useState(String(detail.standAkhirRevisi ?? detail.standAkhir));
  const [kondisi, setKondisi] = React.useState(detail.kondisi);
  const [standAngkatLama, setStandAngkatLama] = React.useState(
    detail.standAngkatLama == null ? "" : String(detail.standAngkatLama),
  );
  const [standAwalMeterBaru, setStandAwalMeterBaru] = React.useState(
    detail.standAwalMeterBaru == null ? "" : String(detail.standAwalMeterBaru),
  );
  const [pemakaianOverride, setPemakaianOverride] = React.useState(
    detail.pemakaianTagihVerif == null ? "" : String(detail.pemakaianTagihVerif),
  );
  const [catatan, setCatatan] = React.useState("");
  const [modeTolak, setModeTolak] = React.useState(tolakAwal);
  const [mengirim, setMengirim] = React.useState(false);
  const [galat, setGalat] = React.useState<string | null>(null);

  const revisiNum = Number(revisi);
  const revisiSiap = revisi !== "" && Number.isInteger(revisiNum) && revisiNum >= 0;
  const berubah = revisiSiap && revisiNum !== detail.standAkhir;
  const meterBaru = kondisi === "MB";
  const standAngkatNum = Number(standAngkatLama);
  const standAwalBaruNum = Number(standAwalMeterBaru);
  const standAngkatSiap =
    standAngkatLama !== "" && Number.isInteger(standAngkatNum) && standAngkatNum >= 0;
  const standAwalBaruSiap =
    standAwalMeterBaru !== "" && Number.isInteger(standAwalBaruNum) && standAwalBaruNum >= 0;
  const hitunganM3 =
    revisiSiap && (meterBaru ? standAngkatSiap && standAwalBaruSiap : true)
      ? meterBaru
        ? hitungPemakaianGantiMeter({
            standAwalLama: detail.standAwal,
            standAngkatLama: standAngkatNum,
            standAwalMeterBaru: standAwalBaruNum,
            standAkhirMeterBaru: revisiNum,
          })
        : Math.max(0, revisiNum - detail.standAwal)
      : null;
  const overrideNum = Number(pemakaianOverride);
  const pemakaianTerpilih =
    pemakaianOverride === ""
      ? hitunganM3
      : Number.isInteger(overrideNum) && overrideNum >= 0
        ? overrideNum
        : null;

  async function jalankan(aksi: "verif" | "reject") {
    if (
      aksi === "verif" &&
      (!revisiSiap ||
        pemakaianTerpilih === null ||
        (meterBaru && (!standAngkatSiap || !standAwalBaruSiap)))
    ) {
      setGalat(
        meterBaru
          ? "Lengkapi stand akhir, stand angkat meter lama, stand awal meter baru, dan M³ terpakai."
          : "Stand akhir dan M³ terpakai harus berupa bilangan bulat nonnegatif.",
      );
      return;
    }
    setMengirim(true);
    setGalat(null);
    try {
      if (aksi === "verif") {
        await kirimJson(`/laporan-harian/${detail.id}/verif${ring}`, "PATCH", {
          meterId,
          blokTarif: Number(blokTarif),
          catatanVerif: catatan.trim() || undefined,
          // Revisi hanya dikirim bila benar-benar beda dari angka catat.
          standAkhirRevisi: berubah ? revisiNum : null,
          standAngkatLama: meterBaru ? standAngkatNum : null,
          standAwalMeterBaru: meterBaru ? standAwalBaruNum : null,
          pemakaianTagih: pemakaianTerpilih,
          // Kondisi hanya dikirim bila dikoreksi — undefined = tidak diubah.
          kondisi: kondisi !== detail.kondisi ? kondisi : undefined,
        });
      } else {
        await kirimJson(`/laporan-harian/${detail.id}/reject`, "PATCH", {
          catatanVerif: catatan.trim(),
        });
      }
      onSelesai();
    } catch (err) {
      setGalat(err instanceof ApiError ? err.message : "Aksi gagal dijalankan.");
    } finally {
      setMengirim(false);
    }
  }

  const footer = (
    <div className="flex flex-col gap-2">
      {galat && (
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="text-xs">{galat}</AlertDescription>
        </Alert>
      )}
      {modeTolak ? (
        <>
          <Button
            variant="destructive"
            className="h-9 w-full"
            disabled={mengirim || catatan.trim().length === 0}
            onClick={() => jalankan("reject")}
          >
            {mengirim && <Spinner className="size-3.5" />} Kirim untuk cek ulang
          </Button>
          <Button
            variant="ghost"
            className="h-9 w-full"
            disabled={mengirim}
            onClick={() => setModeTolak(false)}
          >
            Batal
          </Button>
        </>
      ) : (
        <>
          <Button
            className="h-9 w-full"
            disabled={
              mengirim ||
              !meterId ||
              !revisiSiap ||
              pemakaianTerpilih === null ||
              (meterBaru && (!standAngkatSiap || !standAwalBaruSiap))
            }
            onClick={() => jalankan("verif")}
          >
            {mengirim && <Spinner className="size-3.5" />}
            {berubah ? `Simpan koreksi & tandai V${ring}` : `Valid — tandai V${ring}`}
          </Button>
          <Button
            variant="outline"
            className="h-9 w-full"
            disabled={mengirim}
            onClick={() => setModeTolak(true)}
          >
            Cek ulang
          </Button>
        </>
      )}
    </div>
  );

  return (
    <DialogVerifikasi
      buka
      onBuka={(v) => !v && onTutup()}
      judul={`Verifikasi V${ring} — ${detail.pelanggan?.nama ?? detail.namaPelanggan ?? detail.nomorLangganan}`}
      subjudul={`${formatPeriode(detail.periode)} · ${detail.pencatat?.namaLapangan ?? "pencatat tidak diketahui"} · stand catat ${detail.standAwal.toLocaleString("id-ID")} → ${detail.standAkhir.toLocaleString("id-ID")}.`}
      fotoLabel={`Foto meter — ${formatPeriode(detail.periode)}`}
      fotos={[
        {
          kunci: "stand",
          label: "Stand meter",
          url: detail.fotoStandUrl ?? detail.pembacaan?.fotoBukti,
          keteranganKosong:
            "Laporan petugas dari sistem lama tidak menyertakan foto — koreksi mengacu pada histori pemakaian.",
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
      footer={footer}
    >
      <Bagian judul="Hasil ST akhir">
        <Input
          type="number"
          min={0}
          value={revisi}
          onChange={(e) => setRevisi(e.target.value)}
          className={KELAS_KONTROL_MODAL}
          aria-label="Stand akhir revisi"
        />
        <p className="text-center text-[11px] text-muted-foreground">
          {berubah
            ? `Revisi dari angka catat ${detail.standAkhir.toLocaleString("id-ID")} — angka catat tetap tersimpan.`
            : "Samakan dengan angka catat bila petugas benar; ubah bila salah input."}
        </p>
      </Bagian>

      {meterBaru && (
        <Bagian judul="Stand angkat meter baru (MB)">
          <p className="text-center text-[11px] text-muted-foreground">
            Rumus: (stand angkat lama − {detail.standAwal.toLocaleString("id-ID")}) + (stand akhir baru − stand awal pemasangan baru).
          </p>
          <div className="grid gap-1.5">
            <Label htmlFor="angkat-lama" className="text-[11px] font-normal text-muted-foreground">
              Stand angkat meter lama
            </Label>
            <Input
              id="angkat-lama"
              type="number"
              min={0}
              step={1}
              value={standAngkatLama}
              onChange={(e) => setStandAngkatLama(e.target.value)}
              className={KELAS_KONTROL_MODAL}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="awal-baru" className="text-[11px] font-normal text-muted-foreground">
              Stand awal pemasangan meter baru
            </Label>
            <Input
              id="awal-baru"
              type="number"
              min={0}
              step={1}
              value={standAwalMeterBaru}
              onChange={(e) => setStandAwalMeterBaru(e.target.value)}
              className={KELAS_KONTROL_MODAL}
            />
          </div>
        </Bagian>
      )}

      <Bagian judul="M³ tagihan">
        <Input
          type="number"
          min={0}
          step={1}
          value={pemakaianOverride}
          placeholder={hitunganM3?.toString() ?? "—"}
          onChange={(e) => setPemakaianOverride(e.target.value)}
          className={KELAS_KONTROL_MODAL}
          aria-label="M³ tagihan"
        />
        <p className="text-center text-[11px] text-muted-foreground">
          Hasil hitung dari ST awal dan akhir: {hitunganM3?.toLocaleString("id-ID") ?? "—"} m³. Nilai
          ini menjadi M³ tagihan; ubah hanya bila ada koreksi kebijakan.
        </p>
      </Bagian>

      <Bagian judul="Meter tujuan">
        <PilihSatu
          ariaLabel="Meter tujuan"
          value={meterId}
          onChange={setMeterId}
          disabled={meters.length === 0}
          placeholder="Pelanggan belum punya meter terdaftar"
          opsi={meters.map((m) => ({
            value: m.id,
            label: `${m.nomorMeter}${m.merkKode ? ` · ${m.merkKode}` : ""} ${m.isAktif ? "(aktif)" : "(histori)"}`,
            disabled: meterBaru && !m.isAktif,
          }))}
        />
      </Bagian>

      <Bagian judul="Blok tarif">
        <PilihSatu
          ariaLabel="Blok tarif"
          value={blokTarif}
          onChange={setBlokTarif}
          opsi={[1, 2, 3, 4].map((b) => ({ value: String(b), label: `Blok ${b}` }))}
        />
      </Bagian>

      <Bagian judul="Keterangan catat">
        <PilihSatu
          ariaLabel="Keterangan catat"
          value={kondisi}
          onChange={(nilai) => {
            setKondisi(nilai);
            if (nilai === "MB") {
              const aktif = meters.find((m) => m.isAktif);
              if (aktif) setMeterId(aktif.id);
            }
          }}
          opsi={Object.entries(LABEL_KONDISI_CATAT).map(([kode, nama]) => ({
            value: kode,
            label: nama,
          }))}
        />
        {kondisi !== detail.kondisi && (
          <p className="text-center text-[11px] text-muted-foreground">
            Dikoreksi dari “{LABEL_KONDISI_CATAT[detail.kondisi] ?? detail.kondisi}”.
          </p>
        )}
      </Bagian>

      <Bagian judul={modeTolak ? "Alasan cek ulang (wajib)" : "Catatan (opsional)"}>
        <Textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          rows={3}
          className="text-sm"
          placeholder={
            modeTolak ? "Mis. angka stand tidak sesuai foto/riwayat" : "Catatan verifikasi"
          }
        />
      </Bagian>

      <Separator className="opacity-0" />
    </DialogVerifikasi>
  );
}