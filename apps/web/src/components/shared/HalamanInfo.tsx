import Link from "next/link"
import type { ReactNode } from "react"

export function HalamanInfo({
  judul,
  deskripsi,
  children,
}: {
  judul: string
  deskripsi: string
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 pt-12 pb-24">
      <nav aria-label="Jejak halaman" className="text-sm text-muted-foreground">
        <Link href="/" className="transition-colors hover:text-foreground">
          Beranda
        </Link>
        <span aria-hidden className="mx-2">
          /
        </span>
        <span className="text-foreground">{judul}</span>
      </nav>

      <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
        {judul}
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
        {deskripsi}
      </p>

      <div className="mt-12 space-y-12">{children}</div>
    </div>
  )
}

export function Bagian({
  judul,
  children,
}: {
  judul: string
  children: ReactNode
}) {
  return (
    <section>
      <h2 className="text-xl font-semibold tracking-tight text-foreground">
        {judul}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function KontenContoh({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/50 p-4 text-sm text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/50 dark:text-neutral-400">
      {children}
    </div>
  )
}
