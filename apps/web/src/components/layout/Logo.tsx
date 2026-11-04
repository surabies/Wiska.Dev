import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"

interface LogoProps {
  className?: string
}

/** Lockup brand PERUMDA Tirtawening Kota Bandung. */
export function Logo({ className }: LogoProps) {
  return (
    <Link
      href="/"
      aria-label="PERUMDA Tirtawening Kota Bandung"
      className={cn("flex items-center gap-2.5 outline-none select-none", className)}
    >
      <div className="relative size-8 shrink-0 md:size-9">
        <Image
          src="/logo.png"
          alt="Logo Tirtawening"
          fill
          priority
          unoptimized
          className="object-contain"
        />
      </div>
      <div className="flex flex-col justify-center leading-none">
        <span className="text-[17px] font-extrabold tracking-tight text-foreground md:text-[19px]">
          TIRTAWENING
        </span>
        <span className="mt-0.5 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          Kota Bandung
        </span>
      </div>
    </Link>
  )
}
