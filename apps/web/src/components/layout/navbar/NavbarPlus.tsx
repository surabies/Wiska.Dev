// components/layout/navbar/NavbarPlus.tsx
// Tugas: link sorotan bergaya Tailwind (kotak putus-putus + tanda "+" piksel
// di tiap sudut). Class & SVG disalin dari hasil inspeksi tailwindcss.com.
import Link from "next/link"

// Tanda "+" piksel 5x5. `position` berisi class posisi sudutnya.
function Corner({ position }: { position: string }) {
  return (
    <svg
      width={5}
      height={5}
      viewBox="0 0 5 5"
      aria-hidden="true"
      className={`absolute fill-sky-300 dark:fill-sky-300/50 ${position}`}
    >
      <path d="M2 0h1v2h2v1h-2v2h-1v-2h-2v-1h2z" />
    </svg>
  )
}

export function NavbarPlus({
  label = "Bantuan",
  href = "/bantuan",
}: {
  label?: string
  href?: string
}) {
  return (
    <Link
      href={href}
      className="group relative px-2 py-0.5 text-sm font-medium text-sky-700 dark:text-sky-300"
    >
      <span className="absolute inset-0 border border-dashed border-sky-300/60 bg-sky-400/10 group-hover:bg-sky-400/15 dark:border-sky-300/30" />

      <Corner position="top-[-2px] left-[-2px]" />
      <Corner position="top-[-2px] right-[-2px]" />
      <Corner position="bottom-[-2px] left-[-2px]" />
      <Corner position="right-[-2px] bottom-[-2px]" />

      <span className="relative">{label}</span>
    </Link>
  )
}
