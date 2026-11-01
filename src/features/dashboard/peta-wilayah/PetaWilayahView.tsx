import { PageContainer } from "@/components/layout/index"
import { PetaClientWrapper } from "@/features/dashboard/peta-wilayah/components/PetaClientWrapper"
import {
  batasKecamatanFC,
  batasKelurahanFC,
  ringkasanKoordinatPelanggan,
  ruteFC,
  titikEksPelangganFC,
  titikPengaduanFC,
  titikPelangganFC,
  titikPotensiFC,
} from "@/features/dashboard/peta-wilayah/server/GeoKueri"
import {
  daftarKebocoranAktifPeta,
  ringkasanAsetPeta,
  ringkasanLaporanPeta,
} from "@/features/dashboard/peta-wilayah/server/PetaKueri"

export async function PetaWilayahView() {
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
  ])

  return (
    <PageContainer
      className="flex min-h-0 flex-1 flex-col overflow-hidden pt-3 sm:pt-3 [&>header]:hidden sm:[&>header]:flex"
      breadcrumbs={[
        { label: "Jaringan & Distribusi", href: "/peta-wilayah" },
        { label: "Peta Wilayah" },
      ]}
    >
      <PetaClientWrapper
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
  )
}
