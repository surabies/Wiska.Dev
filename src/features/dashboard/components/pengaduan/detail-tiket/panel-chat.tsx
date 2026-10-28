"use client";

// features/dashboard/components/pengaduan/detail-tiket/panel-chat.tsx — chat
// dua arah dengan pelapor. SELALU publik: tampil sebagai percakapan di
// halaman pelacakan warga & app mobile.
import * as React from "react";
import { MessageCircle } from "@/components/ui/hugeicons-compat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { kirimJson } from "@/features/dashboard/lib/api-client";
import { PanelKartu } from "@/features/dashboard/components/pengaduan/bersama/panel-kartu";
import type { PengaduanDetail } from "@/features/dashboard/components/pengaduan/tipe";
import type { JalankanAksi } from "./use-detail-tiket";

export function PanelChat({
  detail,
  mengirim,
  jalankan,
}: {
  detail: PengaduanDetail;
  mengirim: boolean;
  jalankan: JalankanAksi;
}) {
  const [pesan, setPesan] = React.useState("");
  const pesanBersih = pesan.trim();

  // Satu fungsi kirim untuk tombol DAN tombol Enter (dulu ditulis dua kali).
  async function kirim() {
    if (!pesanBersih || mengirim) return;
    const sukses = await jalankan(() =>
      kirimJson(`/pengaduan/${detail.id}/chat`, "POST", { pesan: pesanBersih }),
    );
    if (sukses) setPesan("");
  }

  return (
    <PanelKartu judul="Chat dengan pelapor">
      <div className="flex gap-2">
        <Input
          autoComplete="off"
          placeholder="Tulis pesan untuk pelapor…"
          value={pesan}
          onChange={(e) => setPesan(e.target.value)}
          disabled={mengirim}
          onKeyDown={(e) => {
            if (e.key === "Enter") void kirim();
          }}
        />
        <Button className="shrink-0" disabled={mengirim || !pesanBersih} onClick={kirim}>
          <MessageCircle />
          Kirim
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Pesan chat selalu terlihat pelapor (beda dari catatan internal). Balasannya masuk ke
        riwayat sebagai “Chat”.
      </p>
    </PanelKartu>
  );
}