"use client";

// features/dashboard/components/pengaduan/detail-tiket/panel-selesai.tsx —
// blok "Selesaikan tiket". SELESAI diperlakukan KHUSUS: server mewajibkan
// catatanPenyelesaian + fotoPenyelesaianUrl, jadi alurnya unggah foto ke
// /pengaduan/foto → URL-nya ikut PATCH status.
import * as React from "react";
import { CheckCircle2 } from "@/components/ui/hugeicons-compat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { kirimForm, kirimJson } from "@/features/dashboard/lib/api-client";
import { PanelKartu } from "@/features/dashboard/components/pengaduan/bersama/panel-kartu";
import type { PengaduanDetail } from "@/features/dashboard/components/pengaduan/tipe";
import type { JalankanAksi } from "./use-detail-tiket";

export function PanelSelesai({
  detail,
  mengirim,
  jalankan,
}: {
  detail: PengaduanDetail;
  mengirim: boolean;
  jalankan: JalankanAksi;
}) {
  const [catatan, setCatatan] = React.useState("");
  const [foto, setFoto] = React.useState<File | null>(null);

  async function tandaiSelesai() {
    if (!foto) return;
    const sukses = await jalankan(async () => {
      const form = new FormData();
      form.set("nomorTiket", detail.nomorTiket);
      form.set("foto", foto);
      const hasil = await kirimForm<{ url: string; publicId: string }>("/pengaduan/foto", form);
      await kirimJson(`/pengaduan/${detail.id}/status`, "PATCH", {
        status: "SELESAI",
        catatanPenyelesaian: catatan.trim(),
        fotoPenyelesaianUrl: hasil.url,
        fotoPenyelesaianPublicId: hasil.publicId,
        isPublik: true,
      });
    });
    if (sukses) {
      setCatatan("");
      setFoto(null);
    }
  }

  return (
    <PanelKartu judul="Selesaikan tiket" ikon={CheckCircle2} nada="sukses">
      <Textarea
        rows={2}
        placeholder="Ringkasan penyelesaian (wajib, dibaca pelapor)…"
        value={catatan}
        onChange={(e) => setCatatan(e.target.value)}
        disabled={mengirim}
      />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="foto-bukti" className="text-xs text-muted-foreground">
          Foto bukti hasil pekerjaan (wajib)
        </Label>
        <Input
          id="foto-bukti"
          type="file"
          accept="image/*"
          disabled={mengirim}
          onChange={(e) => setFoto(e.currentTarget.files?.[0] ?? null)}
        />
      </div>
      <Button
        size="sm"
        className="self-start"
        disabled={mengirim || !catatan.trim() || !foto}
        onClick={tandaiSelesai}
      >
        {mengirim ? <Spinner className="size-3.5" /> : <CheckCircle2 />}
        Tandai selesai
      </Button>
      <p className="text-xs text-muted-foreground">
        Pelapor melihat catatan & foto ini di halaman pelacakan, lalu mengonfirmasi (atau
        membantah) — tiket TIDAK bisa ditutup dari sisi petugas.
      </p>
    </PanelKartu>
  );
}
