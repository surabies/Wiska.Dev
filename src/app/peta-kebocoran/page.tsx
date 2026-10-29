import { 
  ringkasanLaporanPeta, 
  ringkasanAsetPeta, 
  daftarKebocoranAktifPeta,
  getGeoJsonKelurahanDariDb 
} from "@/features/dashboard/lib/peta-queries";
import { PetaKecamatan } from "@/features/dashboard/components/peta-kecamatan";

export const metadata = {
  title: "GIS & Monitoring Kebocoran Pipa",
};

export default async function PetaKebocoranPage() {
  const [ringkasan, _aset, _kebocoranAktif, geoJsonData] = await Promise.all([
    ringkasanLaporanPeta(),
    ringkasanAsetPeta(),
    daftarKebocoranAktifPeta(),
    getGeoJsonKelurahanDariDb(),
  ]);

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

      <PetaKecamatan data={hotspotData} geoJsonData={geoJsonData} />
    </div>
  );
}