import { 
  ringkasanLaporanPeta, 
  ringkasanAsetPeta, 
  daftarKebocoranAktifPeta 
} from "@/features/dashboard/lib/peta-queries";
import { PetaKecamatan } from "@/features/dashboard/components/peta-kecamatan";

export const metadata = {
  title: "GIS & Monitoring Kebocoran Pipa",
};

export default async function PetaKebocoranPage() {
  // Mengambil data dari query yang sudah ada (aset diberi prefix _ karena belum dipakai di tampilan)
  const [ringkasan, _aset, _kebocoranAktif] = await Promise.all([
    ringkasanLaporanPeta(),
    ringkasanAsetPeta(),
    daftarKebocoranAktifPeta(),
  ]);

  // Format data hotspot dengan tipe eksplisit agar tidak error implicit any
  const hotspotData = ringkasan.hotspot.map((item: { kelurahan: string; jumlah: number }) => ({
    name: item.kelurahan,
    value: item.jumlah,
  }));

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">GIS & Monitoring Kebocoran Pipa Dinas</h1>
        <p className="text-muted-foreground text-sm">
          Visualisasi spasial titik gangguan pipa dan data wilayah operasional per kelurahan.
        </p>
      </div>

      <PetaKecamatan data={hotspotData} />
    </div>
  );
}