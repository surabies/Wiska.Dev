// Ajakan terakhir: "Ready to deploy?"
import Link from "next/link"

import { SectionShell } from "@/components/landing/section-heading"
import { CTA } from "@/lib/landing/content"

export function CtaSection() {
  return (
    <SectionShell className="text-center">
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{CTA.judul}</h2>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link href={CTA.utama.href} className="inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-medium text-background transition-colors hover:bg-foreground/90">
          {CTA.utama.label}
        </Link>
        <Link href={CTA.kedua.href} className="inline-flex h-10 items-center rounded-full border border-border px-5 text-sm font-medium transition-colors hover:bg-muted">
          {CTA.kedua.label}
        </Link>
      </div>
    </SectionShell>
  )
}
