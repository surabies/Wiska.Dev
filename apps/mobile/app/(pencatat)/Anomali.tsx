/** Rute /anomali — daftar sambungan tidak terukur untuk penyelia anomali. */
import { useState } from 'react';
import { router } from 'expo-router';
import { AnomaliScreen } from '@/features/pencatat/DaftarAnomali';
import { KunjunganAnomaliScreen } from '@/features/pencatat/KunjunganAnomali';
import type { BarisAnomali } from '@/features/pencatat/lib/RepositoryAnomali';

/// Periode kerja = bulan kalender berjalan. Kunjungan anomali dicatat pada
/// bulan saat petugas datang, bukan pada periode tagihan yang sedang
/// diproses — dua hal berbeda yang kebetulan sering sama.
function periodeSekarang(): number {
  const d = new Date();
  return d.getFullYear() * 100 + (d.getMonth() + 1);
}

export default function Anomali() {
  const [dipilih, setDipilih] = useState<BarisAnomali | null>(null);
  const periode = periodeSekarang();

  if (dipilih) {
    return (
      <KunjunganAnomaliScreen
        baris={dipilih}
        periode={periode}
        onBack={() => setDipilih(null)}
        onSelesai={() => setDipilih(null)}
      />
    );
  }
  return <AnomaliScreen periode={periode} onBack={() => router.back()} onPilih={setDipilih} />;
}
