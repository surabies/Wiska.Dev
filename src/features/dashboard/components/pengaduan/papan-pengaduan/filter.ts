// features/dashboard/components/pengaduan/papan-pengaduan/filter.ts —
// dropdown filter di atas grid.
import { LABEL_JENIS_PENGADUAN } from "@/features/public/lib/format";
import {
  LABEL_PRIORITAS_PENGADUAN,
  LABEL_STATUS_PENGADUAN_STAF,
} from "@/features/dashboard/lib/label";

const dariLabel = (peta: Record<string, string>) =>
  Object.entries(peta).map(([value, label]) => ({ value, label }));

export const FILTER_PENGADUAN = [
  {
    param: "status",
    label: "Status",
    // Dropdown punya ruang yang tidak dimiliki sel grid — di sini dipakai
    // label panjangnya, karena justru saat MEMILIH filter operator perlu tahu
    // "SELESAI" itu belum berarti tiket tutup.
    opsi: dariLabel(LABEL_STATUS_PENGADUAN_STAF),
  },
  { param: "prioritas", label: "Prioritas", opsi: dariLabel(LABEL_PRIORITAS_PENGADUAN) },
  { param: "jenis", label: "Jenis", opsi: dariLabel(LABEL_JENIS_PENGADUAN) },
  { param: "melanggarSla", label: "SLA", opsi: [{ value: "true", label: "Lewat tenggat" }] },
];
