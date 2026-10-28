"use client";

// features/dashboard/components/pengaduan/detail-tiket/panel-eskalasi.tsx —
// eskalasi tiket ke atasan, opsional sambil menaikkan prioritas.
import * as React from "react";
import { ArrowUpCircle } from "@/components/ui/hugeicons-compat";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { kirimJson } from "@/features/dashboard/lib/api-client";
import { LABEL_PRIORITAS_PENGADUAN } from "@/features/dashboard/lib/label";
import { PanelKartu } from "@/features/dashboard/components/pengaduan/bersama/panel-kartu";
import { PilihPetugas } from "@/features/dashboard/components/pengaduan/bersama/pilih-petugas";
import type { PengaduanDetail, PetugasRingkas } from "@/features/dashboard/components/pengaduan/tipe";
import type { JalankanAksi } from "./use-detail-tiket";

export function PanelEskalasi({
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
  const [atasan, setAtasan] = React.useState("");
  const [alasan, setAlasan] = React.useState("");
  const [prioritas, setPrioritas] = React.useState("");

  async function eskalasi() {
    const sukses = await jalankan(() =>
      kirimJson(`/pengaduan/${detail.id}/eskalasi`, "PATCH", {
        eskalasiKeId: atasan,
        alasan: alasan.trim(),
        prioritasBaru: prioritas || undefined,
      }),
    );
    if (sukses) {
      setAtasan("");
      setAlasan("");
      setPrioritas("");
    }
  }

  return (
    <PanelKartu judul="Eskalasi ke atasan">
      <div className="flex gap-2">
        <PilihPetugas
          petugas={petugas}
          value={atasan}
          onChange={setAtasan}
          placeholder="Pilih atasan…"
          ariaLabel="Pilih atasan untuk eskalasi"
          disabled={mengirim}
        />
        <NativeSelect
          value={prioritas}
          onChange={(e) => setPrioritas(e.currentTarget.value)}
          disabled={mengirim}
          className="w-40 shrink-0"
          aria-label="Naikkan prioritas (opsional)"
        >
          <option value="">Prioritas tetap</option>
          {Object.entries(LABEL_PRIORITAS_PENGADUAN).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Textarea
        rows={2}
        placeholder="Alasan eskalasi… (mis. butuh alat berat / keputusan anggaran)"
        value={alasan}
        onChange={(e) => setAlasan(e.target.value)}
        disabled={mengirim}
      />
      <Button
        size="sm"
        variant="outline"
        className="self-start"
        disabled={mengirim || !atasan || !alasan.trim()}
        onClick={eskalasi}
      >
        <ArrowUpCircle />
        Eskalasi
      </Button>
    </PanelKartu>
  );
}
