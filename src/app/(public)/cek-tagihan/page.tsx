// app/(public)/cek-tagihan/page.tsx — /cek-tagihan
//
// Page tipis: metadata + rakit fitur lewat kerangka HalamanPublik (satu
// bahasa visual dengan beranda). Lihat FRONTEND.md.
//
// Menerima ?nomor=... dari form cek cepat di landing page — nomor diteruskan
// sebagai nilai awal input (TIDAK auto-submit: pemanggilan API tetap satu
// klik sadar dari pemakai, dan tetap dari browser mereka agar rate limit
// per-IP bermakna).
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "@/components/ui/hugeicons-compat";
import { CekTagihanForm } from "@/features/public/components/cek-tagihan-form";
import {
  HalamanPublik,
  AsideBlok,
} from "@/features/public/components/halaman-publik";

export const metadata: Metadata = {
  title: "Cek tagihan",
  description: "Cek tagihan air PERUMDA Tirtawening Kota Bandung secara online",
};

export default async function CekTagihanPage({
  searchParams,
}: {
  searchParams: Promise<{ nomor?: string }>;
}) {
  const { nomor } = await searchParams;
  const nomorAwal = /^\d{11}$/.test(nomor ?? "") ? nomor : undefined;

  return (
    <HalamanPublik
      eyebrow="Layanan Mandiri · 24 Jam"
      judul="Tagihan air Anda, transparan sampai ke rinciannya."
      lede="Masukkan nomor langganan dan lihat sampai 12 periode terakhir — rincian biaya per komponen, status pembayaran, jatuh tempo, hingga grafik konsumsi."
      aside={
        <>
          <AsideBlok label="Di mana nomor langganan saya?">
            <p>
              Tertera di rekening atau struk pembayaran air Anda — selalu 11
              digit angka, termasuk nol di depan.
            </p>
            <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-foreground">
              Contoh: 00401700010
            </p>
          </AsideBlok>

          <AsideBlok label="Privasi Anda dijaga">
            <p>
              Halaman ini hanya menampilkan yang perlu Anda lihat — alamat
              disamarkan sebagian, dan setiap permintaan dibatasi lajunya untuk
              menghalangi pengambilan data massal.
            </p>
          </AsideBlok>

          <AsideBlok label="Layanan terkait">
            <ul className="space-y-2">
              {[
                { href: "/lapor-meter", label: "Lapor angka meter mandiri" },
                {
                  href: "/pengaduan",
                  label: "Tagihan tidak sesuai? Ajukan pengaduan",
                },
              ].map((l) => (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className="group inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {l.label}
                    <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </AsideBlok>
        </>
      }
    >
      <CekTagihanForm nomorAwal={nomorAwal} />
    </HalamanPublik>
  );
}
