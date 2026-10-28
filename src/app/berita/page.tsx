import type { Metadata } from "next"

import { Bagian, HalamanInfo, KontenContoh } from "@/components/landing/halaman-info"

export const metadata: Metadata = { title: "Berita" }

type Berita = { slug: string; judul: string; ringkasan: string; tanggal: string }

// TODO: ganti dengan data dari server atau CMS. Detail berita bisa dibuat
// di app/berita/[slug]/page.tsx.
const DAFTAR_BERITA: Berita[] = [
  {
    slug: "contoh-1",
    judul: "Contoh judul berita",
    ringkasan: "Contoh ringkasan berita. Ganti dengan berita yang sebenarnya.",
    tanggal: "2026-01-01",
  },
]

export default function Page() {
  return (
    <HalamanInfo judul="Berita" deskripsi="Kabar terbaru dan pengumuman resmi dari PERUMDA Tirtawening.">
      <Bagian judul="Berita terbaru">
        <KontenContoh>Berita di bawah hanya contoh.</KontenContoh>

        {DAFTAR_BERITA.length === 0 ? (
          <p className="mt-4 text-muted-foreground">Belum ada berita.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {DAFTAR_BERITA.map((b) => (
              <li key={b.slug} className="rounded-lg border border-border bg-card p-4">
                <time dateTime={b.tanggal} className="text-xs text-muted-foreground">
                  {b.tanggal}
                </time>
                <p className="mt-1 text-lg font-medium text-foreground">{b.judul}</p>
                <p className="mt-1 text-sm text-muted-foreground">{b.ringkasan}</p>
              </li>
            ))}
          </ul>
        )}
      </Bagian>
    </HalamanInfo>
  )
}