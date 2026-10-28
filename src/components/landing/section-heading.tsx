// Judul section & pembungkus section yang dipakai ulang di seluruh beranda.
import { cn } from "@/lib/utils"

export function SectionHeading({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={cn("text-3xl font-semibold tracking-tight text-balance sm:text-4xl", className)}>
      {children}
    </h2>
  )
}

// Lebar maksimum + padding horizontal seragam.
export function SectionShell({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("mx-auto w-full max-w-362 px-4 py-16 lg:px-6 lg:py-24", className)}>{children}</section>
}