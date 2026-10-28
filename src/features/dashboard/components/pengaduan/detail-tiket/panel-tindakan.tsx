"use client";

// features/dashboard/components/pengaduan/detail-tiket/panel-tindakan.tsx —
// blok "Tindakan": tugaskan petugas, tulis catatan (internal/publik), dan
// tombol transisi status generik. `transisiTersedia` diputuskan SERVER
// (matriks TRANSISI, sudah disaring per role) — jangan disalin ke sini.
import * as React from "react";
import { Lock, MessageSquarePlus, Send, UserCheck } from "@/components/ui/hugeicons-compat";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { kirimJson } from "@/features/dashboard/lib/api-client";
import { LABEL_AKSI_STATUS_PENGADUAN } from "@/features/dashboard/lib/label";
import { PanelKartu } from "@/features/dashboard/components/pengaduan/bersama/panel-kartu";
import { PilihPetugas } from "@/features/dashboard/components/pengaduan/bersama/pilih-petugas";
import type { PengaduanDetail, PetugasRingkas } from "@/features/dashboard/components/pengaduan/tipe";
import { BUKAN_TOMBOL_STATUS } from "./konstanta";
import type { JalankanAksi } from "./use-detail-tiket";

export function PanelTindakan({
  detail,
  petugas,
  mengirim,
  jalankan,
}: {
  detail: PengaduanDetail;
  petugas: PetugasRingkas[];
  mengirim: boolean;
  jalankan: JalankanAksi;
}) {
  const [pilihPetugas, setPilihPetugas] = React.useState("");
  const [catatan, setCatatan] = React.useState("");
  const [catatanPublik, setCatatanPublik] = React.useState(false);

  const transisi = detail.transisiTersedia.filter((s) => !BUKAN_TOMBOL_STATUS.includes(s));
  const bisaSelesai = detail.transisiTersedia.includes("SELESAI");
  const catatanBersih = catatan.trim();

  // Catatan hanya dikosongkan bila aksi di panel ini SUKSES.
  async function kirim(aksi: () => Promise<unknown>) {
    if (await jalankan(aksi)) setCatatan("");
  }

  return (
    <PanelKartu judul="Tindakan">
      <div className="flex gap-2">
        <PilihPetugas
          petugas={petugas}
          value={pilihPetugas}
          onChange={setPilihPetugas}
          placeholder="Pilih petugas…"
          ariaLabel="Pilih petugas"
          disabled={mengirim}
        />
        <Button
          className="shrink-0"
          disabled={mengirim || !pilihPetugas}
          onClick={() =>
            kirim(() =>
              kirimJson(`/pengaduan/${detail.id}/tugaskan`, "PATCH", {
                ditugaskanKeId: pilihPetugas,
                catatan: catatanBersih || undefined,
              }),
            )
          }
        >
          <UserCheck />
          Tugaskan
        </Button>
      </div>

      <Textarea
        rows={3}
        placeholder="Catatan tindak lanjut… (dipakai oleh tombol di bawah)"
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        disabled={mengirim}
      />

      <div className="flex items-center gap-2">
        <Switch
          id="catatan-publik"
          checked={catatanPublik}
          onCheckedChange={setCatatanPublik}
          disabled={mengirim}
        />
        <Label htmlFor="catatan-publik" className="flex items-center gap-1.5 text-xs">
          {catatanPublik ? (
            <>
              <MessageSquarePlus className="size-3.5" /> Terlihat oleh pelapor
            </>
          ) : (
            <>
              <Lock className="size-3.5" /> Catatan internal
            </>
          )}
        </Label>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={mengirim || !catatanBersih}
          onClick={() =>
            kirim(() =>
              kirimJson(`/pengaduan/${detail.id}/catatan`, "POST", {
                catatan: catatanBersih,
                isPublik: catatanPublik,
              }),
            )
          }
        >
          {mengirim ? <Spinner className="size-3.5" /> : <Send />}
          Tambah catatan
        </Button>

        {transisi.map((s) => (
          <Button
            key={s}
            size="sm"
            variant={s === "DITOLAK" ? "destructive" : "secondary"}
            disabled={mengirim}
            onClick={() =>
              kirim(() =>
                kirimJson(`/pengaduan/${detail.id}/status`, "PATCH", {
                  status: s,
                  catatan: catatanBersih || undefined,
                  isPublik: true,
                }),
              )
            }
          >
            {LABEL_AKSI_STATUS_PENGADUAN[s]}
          </Button>
        ))}
      </div>

      {transisi.length === 0 && !bisaSelesai && (
        <p className="text-xs text-muted-foreground">
          Status tiket ini sudah final — tidak ada transisi yang tersedia.
        </p>
      )}
    </PanelKartu>
  );
}