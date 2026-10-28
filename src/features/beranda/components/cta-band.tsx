// features/beranda/components/cta-band.tsx — ajakan penutup sebelum footer.
// Dua jalur nyata: buat pengaduan baru, atau lacak tiket yang sudah ada.
import Link from "next/link"
import { ArrowRight } from "@/components/ui/hugeicons-compat"
import { OrganicButton } from "@/components/ui/organic-button"
import { Reveal } from "./motion/reveal"

export function CtaBand() {
  return (
    <section
      aria-labelledby="cta-judul"
      className="relative overflow-hidden border-b border-border bg-muted/30"
    >
      <div className="relative mx-auto grid w-full max-w-6xl grid-cols-1 lg:grid-cols-2">
        <Reveal className="flex flex-col items-start justify-center gap-5 px-5 py-12 md:px-8 lg:py-16">
          <h2
            id="cta-judul"
            className="text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          >
            Ada kendala air di lingkungan Anda?
          </h2>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Pipa bocor di jalan pun boleh dilaporkan siapa saja — Anda tidak
            harus pelanggan. Laporan kebocoran otomatis masuk antrean prioritas
            tinggi.
          </p>
          <OrganicButton
            href="/pengaduan"
            label="Buat pengaduan"
            variantColor="secondary"
            icon={
              <ArrowRight className="organic-icon transition-transform duration-100 group-hover/organic:translate-x-0.5" />
            }
          />
        </Reveal>

        <Reveal
          delay={0.1}
          className="flex flex-col items-start justify-center gap-3 border-t border-border px-5 py-12 md:px-8 lg:border-t-0 lg:border-l lg:py-16"
        >
          <p className="text-xs font-medium text-muted-foreground">
            Sudah pernah melapor?
          </p>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            Pantau perkembangan penanganan dengan nomor tiket yang Anda terima —
            dari diterima, ditugaskan ke petugas, hingga selesai.
          </p>
          <Link
            href="/pengaduan"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 hover:underline"
          >
            Lacak tiket pengaduan
            <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
