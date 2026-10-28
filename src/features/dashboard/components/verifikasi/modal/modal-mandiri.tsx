"use client";

// features/dashboard/components/verifikasi/modal-mandiri.tsx — modal aksi
// verifikasi laporan mandiri: foto besar (zoom, geser, putar) berdampingan
// dengan kotak stand yang bisa dikoreksi, lalu verify/reject.
//
// Koreksi bukan aksi simpan tersendiri: verifikator membetulkan angkanya di
// sini lalu menekan "Valid", dan satu permintaan verify itulah yang menulis
// angka final — ke laporan sekaligus ke PembacaanMeter resmi.
import * as React from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatPeriode } from "@/features/public/lib/format";
import { kirimJson, ApiError } from "../../../lib/api-client";
import type { LaporanMandiriDetail } from "../types/tipe";
import { Bagian } from "../panel/panel-bagian";
import { DialogVerifikasi, KELAS_KONTROL_MODAL } from "../dialog-verifikasi";

export function ModalMandiri({
  detail,
  meterId,
  memuatMeter,
  galatMeter,
  standLalu,
  blokTarif,
  galatRiwayat,
  tolakAwal,
  onTutup,
  onSelesai,
}: {
  detail: LaporanMandiriDetail;
  /** Meter aktif pelanggan — turunan, tidak dipilih verifikator. */
  meterId: string;
  memuatMeter: boolean;
  galatMeter: string | null;
  standLalu: number | null;
  blokTarif: number | null;
  galatRiwayat: string | null;
  /** true = langsung mode tolak. */
  tolakAwal: boolean;
  onTutup: () => void;
  onSelesai: () => void;
}) {
  const [stand, setStand] = React.useState(String(detail.standDilaporkan));
  const [pemakaianOverride, setPemakaianOverride] = React.useState("");
  const [alasan, setAlasan] = React.useState("");
  const [modeTolak, setModeTolak] = React.useState(tolakAwal);
  const [mengirim, setMengirim] = React.useState(false);
  const [galat, setGalat] = React.useState<string | null>(null);

  const standNum = Number(stand);
  const standSiap = stand !== "" && Number.isInteger(standNum) && standNum >= 0;
  const standLaluSiap = standLalu !== null && Number.isFinite(standLalu);
  const blokTarifSiap = blokTarif !== null && Number.isFinite(blokTarif);
  const pemakaian = standSiap && standLaluSiap ? Math.max(0, standNum - standLalu) : null;
  const overrideNum = Number(pemakaianOverride);
  const pemakaianTerpilih =
    pemakaianOverride === ""
      ? pemakaian
      : Number.isInteger(overrideNum) && overrideNum >= 0
        ? overrideNum
        : null;
  const berubah = standSiap && standNum !== detail.standDilaporkan;

  async function jalankan(aksi: "verify" | "reject") {
    if (
      aksi === "verify" &&
      (!meterId ||
        !standSiap ||
        pemakaianTerpilih === null ||
        standLalu === null ||
        blokTarif === null ||
        !Number.isFinite(standLalu) ||
        !Number.isFinite(blokTarif))
    ) {
      setGalat("Data meter dan riwayat stand belum siap untuk diverifikasi.");
      return;
    }
    setMengirim(true);
    setGalat(null);
    try {
      if (aksi === "verify") {
        await kirimJson(`/laporan-mandiri/${detail.id}/verify`, "PATCH", {
          meterId,
          memuatMeter,
          galatMeter,
          standLalu,
          blokTarif,
          standDilaporkan: standNum,
          pemakaianM3: pemakaianTerpilih,
        });
      } else {
        await kirimJson(`/laporan-mandiri/${detail.id}/reject`, "PATCH", {
          alasanDitolak: alasan.trim(),
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
            disabled={mengirim || alasan.trim().length === 0}
            onClick={() => jalankan("reject")}
          >
            {mengirim && <Spinner className="size-3.5" />} Tolak laporan
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
              !standSiap ||
              pemakaianTerpilih === null ||
              !standLaluSiap ||
              !blokTarifSiap
            }
            onClick={() => jalankan("verify")}
          >
            {mengirim && <Spinner className="size-3.5" />}
            {berubah ? "Simpan koreksi & jadikan resmi" : "Valid — jadikan pembacaan resmi"}
          </Button>
          <Button
            variant="outline"
            className="h-9 w-full"
            disabled={mengirim}
            onClick={() => setModeTolak(true)}
          >
            Tolak / minta foto ulang
          </Button>
        </>
      )}
    </div>
  );

  return (
    <DialogVerifikasi
      buka
      onBuka={(v) => !v && onTutup()}
      judul={`Verifikasi stand — ${detail.pelanggan?.nama ?? detail.nomorLangganan}`}
      subjudul={`${formatPeriode(detail.periode)} · dilaporkan ${detail.namaPelapor} · cocokkan angka pada foto dengan kotak stand.`}
      fotoUrl={detail.fotoUrl}
      fotoLabel={`Foto meter — ${formatPeriode(detail.periode)}`}
      footer={footer}
    >
      <Bagian judul="ST akhir catat">
        <Input
          type="number"
          min={0}
          value={stand}
          onChange={(e) => setStand(e.target.value)}
          className={KELAS_KONTROL_MODAL}
          aria-label="ST akhir catat"
        />
        <p className="text-center text-[11px] text-muted-foreground">
          {berubah
            ? `Dikoreksi dari ${detail.standDilaporkan.toLocaleString("id-ID")}.`
            : "Koreksi bila pelapor salah input."}
        </p>
      </Bagian>

      <Bagian judul="M³ tagihan">
        <Input
          type="number"
          min={0}
          step={1}
          value={pemakaianOverride}
          placeholder={pemakaian?.toString() ?? "—"}
          onChange={(e) => setPemakaianOverride(e.target.value)}
          className={KELAS_KONTROL_MODAL}
          aria-label="M³ tagihan"
        />
        <p className="text-center text-[11px] text-muted-foreground">
          Hasil hitung dari ST awal dan akhir: {pemakaian?.toLocaleString("id-ID") ?? "—"} m³. Nilai
          ini menjadi M³ tagihan; ubah hanya bila ada koreksi kebijakan.
        </p>
      </Bagian>

      {/* Meter tujuan tidak dipilih manual, jadi ketiadaannya harus
          dijelaskan — kalau tidak, tombol verifikasi cuma mati tanpa sebab. */}
      {memuatMeter && (
        <p role="status" className="text-center text-[11px] text-muted-foreground">
          Memuat meter pelanggan…
        </p>
      )}
      {galatMeter && (
        <p role="alert" className="text-center text-[11px] text-destructive">
          {galatMeter}
        </p>
      )}
      {!memuatMeter && !galatMeter && !meterId && (
        <p className="text-center text-[11px] text-amber-700 dark:text-amber-400">
          Pelanggan ini belum punya meter terdaftar — verifikasi baru bisa dijalankan setelah meternya
          didaftarkan.
        </p>
      )}
      {meterId && galatRiwayat && (
        <p role="alert" className="text-center text-[11px] text-destructive">
          {galatRiwayat}
        </p>
      )}
      {meterId && !galatRiwayat && !standLaluSiap && (
        <p role="status" className="text-center text-[11px] text-muted-foreground">
          Memuat riwayat stand meter dan blok tarif…
        </p>
      )}

      {modeTolak && (
        <Bagian judul="Alasan penolakan (wajib, dikirim ke pelapor)">
          <Textarea
            value={alasan}
            onChange={(e) => setAlasan(e.target.value)}
            rows={3}
            className="text-sm"
            placeholder="Mis. foto buram / angka stand tidak terbaca"
          />
        </Bagian>
      )}
    </DialogVerifikasi>
  );
}