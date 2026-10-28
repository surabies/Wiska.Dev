// app/(public)/pengaduan/page.tsx — /pengaduan
//
// Page tipis: metadata + rakit fitur lewat kerangka HalamanPublik (satu
// bahasa visual dengan beranda). Lihat FRONTEND.md.
import type { Metadata } from "next";
import { MessageSquare, Ticket } from "@/components/ui/hugeicons-compat";
import { auth } from "@/lib/auth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PengaduanForm } from "@/features/public/components/pengaduan-form";
import { LacakTiketForm } from "@/features/public/components/lacak-tiket-form";
import { getPetaCakupan } from "@/features/beranda/lib/peta";
import {
  HalamanPublik,
  AsideBlok,
  KartuBerbingkai,
} from "@/features/public/components/halaman-publik";

export const metadata: Metadata = {
  title: "Pengaduan",
  description:
    "Laporkan kebocoran, air mati, atau keluhan layanan PERUMDA Tirtawening Kota Bandung",
};

export default async function PengaduanPage({
  searchParams,
}: {
  // ?nomor= dipakai /akun (portal warga) untuk taut-langsung ke detail satu
  // tiket, membuka tab "Lacak tiket" dan mengisi + mencari otomatis — bukan
  // menduplikasi tampilan detail tiket di tempat lain. ?tab=lacak membuka tab
  // pelacakan langsung (deep-link umum, mis. dari email/WA).
  searchParams: Promise<{ nomor?: string; tab?: string }>;
}) {
  const { nomor, tab } = await searchParams;
  const [session, peta] = await Promise.all([auth(), getPetaCakupan()]);
  const tabAwal = nomor || tab === "lacak" ? "lacak" : "lapor";

  return (
    <HalamanPublik
      eyebrow="Pengaduan & Pelacakan"
      judul="Gangguan air bukan urusan Anda sendirian."
      lede="Pipa bocor, air keruh, meter rusak, atau keluhan layanan — laporkan di sini dan pantau penanganannya lewat nomor tiket. Terbuka untuk siapa saja, tidak harus pelanggan."
      aside={
        <>
          <AsideBlok label="Tidak harus pelanggan">
            <p>
              Melihat pipa bocor di jalan? Laporkan saja — kolom nomor langganan
              boleh dikosongkan. Yang penting petugas tahu lokasinya.
            </p>
          </AsideBlok>

          <AsideBlok label="Kebocoran diprioritaskan">
            <p>
              Laporan kebocoran otomatis masuk antrean prioritas tinggi dan
              meminta titik lokasi, supaya regu lapangan langsung menuju
              sasaran.
            </p>
          </AsideBlok>

          <AsideBlok label="Ada target waktunya">
            <p>
              Setiap tiket punya target penanganan sesuai tingkat
              kegawatannya — dan target itu ikut ditampilkan di halaman
              pelacakan, termasuk saat kami melewatinya.
            </p>
          </AsideBlok>

          <AsideBlok label="Anda yang menutup tiket">
            <p>
              Petugas hanya bisa menandai laporan <em>selesai</em>. Tiket baru
              benar-benar ditutup setelah Anda mengonfirmasi — kalau masalahnya
              belum beres, buka kembali tiket yang sama.
            </p>
          </AsideBlok>

          <AsideBlok label="Simpan nomor tiket">
            <p>
              Setiap laporan mendapat nomor tiket unik — satu-satunya kunci
              memantau perkembangan penanganan. Catat atau salin begitu muncul.
            </p>
            <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs tracking-wider text-foreground">
              TW-2607-4F2A9K
            </p>
          </AsideBlok>
        </>
      }
    >
      {/* Dua alur dalam satu halaman: melapor & memantau. Tab, bukan halaman
          terpisah — keduanya pendek dan pengguna yang baru melapor sering
          langsung ingin memantau. */}
      <KartuBerbingkai
        label="Layanan · Pengaduan"
        chip="Terbuka Umum"
        className="p-0"
      >
        <Tabs defaultValue={tabAwal} className="flex w-full flex-col">
          <div className="px-5 pt-4 pb-2.5">
            <TabsList
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
              }}
              className="h-9 border border-border bg-muted"
            >
              <TabsTrigger
                value="lapor"
                className="gap-1.5 text-xs font-medium"
              >
                <MessageSquare size={13} />
                Buat pengaduan
              </TabsTrigger>
              <TabsTrigger
                value="lacak"
                className="gap-1.5 text-xs font-medium"
              >
                <Ticket size={13} />
                Lacak tiket
              </TabsTrigger>
            </TabsList>
            <div className="mt-2.5 h-px bg-border" />
          </div>

          <TabsContent value="lapor" className="px-5 pt-2 pb-5">
            <PengaduanForm sudahLogin={!!session?.user} peta={peta} />
          </TabsContent>

          <TabsContent value="lacak" className="px-5 pt-2 pb-5">
            <LacakTiketForm nomorAwal={nomor} />
          </TabsContent>
        </Tabs>
      </KartuBerbingkai>
    </HalamanPublik>
  );
}
