import type { Metadata } from "next";
import { PageContainer } from "@/components/layout";
import { PetaWilayah } from "@/features/dashboard/components/peta-wilayah/peta-wilayah";
import {
  batasKecamatanFC,
  batasKelurahanFC,
  ringkasanKoordinatPelanggan,
  ruteFC,
  titikEksPelangganFC,
  titikPengaduanFC,
  titikPelangganFC,
  titikPotensiFC,
} from "@/features/dashboard/lib/geo-queries";
import {
  daftarKebocoranAktifPeta,
  ringkasanAsetPeta,
  ringkasanLaporanPeta,
} from "@/features/dashboard/lib/peta-queries";

export const metadata: Metadata = { title: "Peta Jaringan · Tirtawening" };

export default async function WilayahPage() {
  const [
    kelurahan,
    kecamatan,
    rute,
    pelanggan,
    statistikPelanggan,
    potensi,
    eksPelanggan,
    pengaduan,
    daftarKebocoran,
    ringkasan,
    aset,
  ] = await Promise.all([
    batasKelurahanFC(),
    batasKecamatanFC(),
    ruteFC(),
    titikPelangganFC(),
    ringkasanKoordinatPelanggan(),
    titikPotensiFC(),
    titikEksPelangganFC(),
    titikPengaduanFC(),
    daftarKebocoranAktifPeta(),
    ringkasanLaporanPeta(),
    ringkasanAsetPeta(),
  ]);

  return (
    // Tinggi tidak lagi dihitung manual: layout fluid sudah membatasi ruang
    // (layar - navbar - footer), jadi cukup mengisi ruang itu dengan flex-1.
    <PageContainer
      className="flex min-h-0 flex-1 flex-col overflow-hidden pt-3 sm:pt-3 [&>header]:hidden sm:[&>header]:flex"
      breadcrumbs={[
        { label: "Jaringan & Distribusi", href: "/peta-wilayah" },
        { label: "Peta Wilayah" },
      ]}
    >
      <PetaWilayah
        kelurahan={kelurahan}
        kecamatan={kecamatan}
        rute={rute}
        pelanggan={pelanggan}
        statistikPelanggan={statistikPelanggan}
        potensi={potensi}
        eksPelanggan={eksPelanggan}
        pengaduan={pengaduan}
        daftarKebocoran={daftarKebocoran}
        ringkasan={ringkasan}
        aset={aset}
      />
    </PageContainer>
  );
}