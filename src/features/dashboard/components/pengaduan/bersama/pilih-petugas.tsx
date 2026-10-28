// features/dashboard/components/pengaduan/bersama/pilih-petugas.tsx —
// dropdown petugas (tinggi default h-8 — pasangkan dengan Button ukuran default). Dipakai blok "Tindakan" (tugaskan) dan "Eskalasi" — dulu
// daftar <option> yang sama ditulis dua kali.
import { NativeSelect } from "@/components/ui/native-select";
import type { PetugasRingkas } from "@/features/dashboard/components/pengaduan/tipe";

export function PilihPetugas({
  petugas,
  value,
  onChange,
  placeholder,
  ariaLabel,
  disabled,
}: {
  petugas: PetugasRingkas[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <NativeSelect
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      disabled={disabled}
      aria-label={ariaLabel}
      // Wrapper NativeSelect bawaannya w-fit; di baris flex ia harus mengisi sisa lebar.
      className="min-w-0 flex-1"
    >
      <option value="">{placeholder}</option>
      {petugas.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name ?? p.id} · {p.role}
        </option>
      ))}
    </NativeSelect>
  );
}