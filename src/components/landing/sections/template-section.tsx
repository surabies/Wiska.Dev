// Section "Mulai dalam hitungan detik" — layout meniru nextjs.org:
// kolom kiri (judul, deskripsi, tombol; sticky) + kolom kanan (grid kartu 2 kolom, sudut terlipat).
import Link from "next/link"
import { HugeiconsIcon } from "@hugeicons/react"
import { Clock01Icon, DropletIcon } from "@hugeicons/core-free-icons"

import { SectionHeading, SectionShell } from "@/components/landing/section-heading"
import { TEMPLATE } from "@/lib/landing/content"

// Tipe satu kartu, diambil otomatis dari data di content.ts
type Item = (typeof TEMPLATE.item)[number]

// Style dasar kedua tombol (pill, tinggi 40px). Warna dibedakan saat dipakai.
const tombol =
  "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"

// Style dasar kartu. "relative" wajib karena lipatan sudut diposisikan absolute.
const kartu =
  "group relative flex h-full min-h-45 flex-col rounded-xs border border-border p-4 no-underline outline-none transition-colors"

/*
  TAHAP 1 — Lipatan sudut kanan atas.
  Di Next.js efek ini berasal dari CSS module (class "_0JHfLG_folded"), yang tidak ikut
  tersalin di HTML hasil inspeksi — itu sebabnya lipatannya tidak muncul. Di sini kita buat
  sendiri dengan satu kotak kecil 24px di pojok kartu:
    - segitiga kanan atas  = warna latar halaman (menutupi sudut kartu, jadi tampak terpotong)
    - segitiga kiri bawah  = warna "muted" (sisi kertas yang terlipat)
    - garis diagonal tipis = warna border kartu (currentColor)
  border-l + border-b menggambar dua sisi lipatan yang tampak di dalam kartu.
  Warna garis mengikuti "text-*" agar ikut berubah saat kartu di-hover.

  EFEK HOVER (yang membuatnya terasa "mahal"):
  saat kartu di-hover, lipatan MEMBUKA: kotak lipatan mengecil ke titik pojok kanan atas
  (scale-0, origin-top-right) sehingga sudut yang terpotong hilang dan kartu menjadi
  persegi panjang utuh. Dipakai transform (bukan width/height) supaya animasinya halus
  dan border 1px tidak menyisakan garis kecil di pojok. Kartu hanya perlu class "group"
  agar span ini bisa bereaksi lewat "group-hover:".
  motion-reduce: animasi dimatikan untuk pengguna yang memilih "kurangi gerakan".
*/
function LipatanSudut({ aktif }: { aktif: boolean }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute -right-px -top-px size-6 origin-top-right border-b border-l border-current text-border transition-transform duration-300 ease-out motion-reduce:transition-none ${
        aktif ? "group-hover:scale-0" : ""
      }`}
      style={{
        background:
          "linear-gradient(to bottom left, var(--background) calc(50% - 0.5px), currentColor calc(50% - 0.5px) calc(50% + 0.5px), var(--muted) calc(50% + 0.5px))",
      }}
    />
  )
}

/*
  TAHAP 2 — Isi kartu (dipakai oleh kartu aktif maupun "segera hadir").
  justify-between: judul + deskripsi di atas, baris status menempel di bawah.
*/
function IsiKartu({ t }: { t: Item }) {
  return (
    <div className="flex h-full flex-col justify-between gap-2 lg:gap-3">
      <span className="flex flex-col gap-2">
        <span className="text-base font-semibold text-foreground">{t.judul}</span>
        <span className="max-w-[32ch] text-balance text-base text-muted-foreground">{t.deskripsi}</span>
      </span>

      {/* Baris bawah: rute jika halaman sudah ada, "Segera hadir" jika belum */}
      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
        {t.tersedia ? (
          <>
            <HugeiconsIcon icon={DropletIcon} size={16} aria-hidden className="shrink-0" />
            {t.rute}
          </>
        ) : (
          <>
            <HugeiconsIcon icon={Clock01Icon} size={16} aria-hidden className="shrink-0" />
            Segera hadir
          </>
        )}
      </span>
    </div>
  )
}

export function TemplateSection() {
  return (
    <SectionShell>
      {/* TAHAP 3 — Grid 12 kolom: kiri 4/12, kanan 8/12 di layar lg */}
      <div className="grid grid-cols-12 gap-x-6 gap-y-6 md:gap-y-10">
        {/*
          TAHAP 4 — Kolom kiri sticky.
          lg:top-24 = jarak dari atas layar; sesuaikan dengan tinggi navbar.
          lg:self-start + lg:h-fit wajib agar sticky bekerja di dalam grid.
        */}
        <div className="col-span-full flex flex-col items-start gap-6 lg:sticky lg:top-24 lg:col-span-4 lg:h-fit lg:self-start">
          <div className="flex max-w-[46ch] flex-col gap-4">
            <SectionHeading>{TEMPLATE.judul}</SectionHeading>
            <p className="max-w-[34ch] text-pretty text-base text-muted-foreground lg:text-lg">
              {TEMPLATE.deskripsi}
            </p>
          </div>

          <div className="flex flex-wrap items-start gap-4">
            <Link
              href={TEMPLATE.deploy.href}
              className={`${tombol} bg-primary text-primary-foreground hover:bg-primary/90`}
            >
              {TEMPLATE.deploy.label}
            </Link>
            <Link
              href={TEMPLATE.semua.href}
              className={`${tombol} border border-border bg-background text-foreground hover:bg-muted`}
            >
              {TEMPLATE.semua.label}
            </Link>
          </div>
        </div>

        {/* TAHAP 5 — Kolom kanan: grid kartu, mulai dari kolom 5 sampai 13 di layar lg */}
        <ul className="col-span-full m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:col-start-5 lg:col-end-13">
          {TEMPLATE.item.map((t) => (
            <li key={t.judul} className="min-w-0">
              {t.tersedia ? (
                // Kartu aktif: bisa diklik, ada efek hover dan focus ring
                <Link
                  href={t.href}
                  className={`${kartu} hover:border-foreground/40 hover:bg-muted/30 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`}
                >
                  <LipatanSudut aktif />
                  <IsiKartu t={t} />
                </Link>
              ) : (
                // Kartu "segera hadir": bukan tautan (tidak ada 404), tampil sedikit redup
                <div aria-disabled="true" className={`${kartu} cursor-default opacity-70`}>
                  <LipatanSudut aktif={false} />
                  <IsiKartu t={t} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </SectionShell>
  )
}