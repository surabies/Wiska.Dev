import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Tombol pill khas DICE di atas `Button` shadcn.
 * Pakai `asChild` untuk membungkus `<Link>` / `<a>`.
 */
export function PillButton({
  className,
  ...props
}: ComponentProps<typeof Button>) {
  return (
    <Button
      className={cn(
        "h-10 rounded-[20px] border-2 border-transparent bg-black px-5.5 text-xs leading-4 font-bold tracking-[0.06em] text-white uppercase transition-opacity duration-200 hover:bg-black hover:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black",
        className
      )}
      {...props}
    />
  )
}
