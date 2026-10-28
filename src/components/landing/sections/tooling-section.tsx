// Tiga langkah layanan (padanan section "tooling" di nextjs.org): kartu bergaris tipis dengan
// ikon di kiri atas dan teks di bagian bawah. Data dari TOOLING.
import Link from "next/link"
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react"
import { Invoice01Icon, SentIcon, UserCheck01Icon } from "@hugeicons/core-free-icons"

import { SectionHeading, SectionShell } from "@/components/landing/section-heading"
import { TOOLING } from "@/lib/landing/content"

// Peta kunci "ikon" (dari content.ts) ke ikon HugeIcons:
//  - langganan  → rekening/tagihan (nomor langganan tertera di rekening air)
//  - laporan    → kirim
//  - verifikasi → petugas yang memeriksa
const IKON: Record<(typeof TOOLING.item)[number]["ikon"], IconSvgElement> = {
  langganan: Invoice01Icon,
  laporan: SentIcon,
  verifikasi: UserCheck01Icon,
}

export function ToolingSection() {
  return (
    <SectionShell>
      {/* Jarak judul ke kartu dibuat lega, seperti di contoh (±64px di layar besar) */}
      <div className="flex flex-col gap-12 md:gap-16">
        <SectionHeading className="lg:max-w-xl">{TOOLING.judul}</SectionHeading>

        <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-3">
          {TOOLING.item.map((t, i) => {
            const eksternal = t.href.startsWith("http")
            return (
              <li key={t.judul} className="min-w-0">
                {/*
                  TAHAP 1 — Kartu.
                  Tinggi minimal 240px, isi dibagi dua: ikon + nomor langkah di atas,
                  judul + deskripsi menempel di bawah (justify-between).
                  Hover: border menguat, ikon naik sedikit, panah bergeser.
                */}
                <Link
                  href={t.href}
                  {...(eksternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="group flex h-full min-h-60 flex-col justify-between gap-8 rounded-xs border border-border p-6 no-underline outline-none transition-colors duration-150 hover:border-foreground/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  {/* TAHAP 2 — Baris atas: ikon 32px (kiri) dan nomor langkah kecil (kanan) */}
                  <div className="flex items-start justify-between">
                    <HugeiconsIcon
                      icon={IKON[t.ikon]}
                      size={32}
                      strokeWidth={1.5}
                      aria-hidden
                      className="text-foreground transition-transform duration-300 ease-out group-hover:-translate-y-0.5 motion-reduce:transition-none"
                    />
                    <span aria-hidden className="font-mono text-xs text-muted-foreground transition-colors duration-150 group-hover:text-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>

                  {/* TAHAP 3 — Teks: judul + panah yang bergeser saat hover, lalu deskripsi */}
                  <div className="flex flex-col gap-3">
                    <span className="flex items-center gap-3 text-base font-medium text-foreground">
                      {t.judul}
                      <span
                        aria-hidden
                        className="inline-block -translate-x-1 transition-transform group-hover:translate-x-0"
                      >
                        →
                      </span>
                    </span>
                    <span className="max-w-94 text-pretty text-base text-muted-foreground transition-colors group-hover:text-foreground">
                      {t.deskripsi}
                    </span>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </SectionShell>
  )
}