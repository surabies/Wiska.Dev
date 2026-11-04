import type { ComponentProps } from "react"

import { cn } from "@/lib/utils"

/** Pembungkus lebar konten (max 1000px) dengan gutter 16px. */
export function Container({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-250 px-4", className)}
      {...props}
    />
  )
}
