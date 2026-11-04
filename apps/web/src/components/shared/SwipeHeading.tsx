import type { CSSProperties } from "react"

import { cn } from "@/lib/utils"

interface SwipeHeadingProps {
  text: string
  as?: "h1" | "h2"
  className?: string
}

/**
 * Judul yang kata-katanya naik satu per satu saat halaman dimuat.
 * Murni CSS (server component) — delay diatur lewat variabel `--index`.
 */
export function SwipeHeading({
  text,
  as: Tag = "h1",
  className,
}: SwipeHeadingProps) {
  const words = text.split(" ")

  return (
    <Tag className={cn("m-0 max-w-125 type-display", className)}>
      {words.map((word, index) => (
        <span
          key={`${word}-${index}`}
          style={{ "--index": index + 1 } as CSSProperties}
          className="inline-block overflow-hidden whitespace-nowrap"
        >
          <span className="inline-block translate-y-full animate-swipe-up whitespace-pre motion-reduce:translate-y-0 motion-reduce:animate-none">
            {index < words.length - 1 ? `${word} ` : word}
          </span>
        </span>
      ))}
    </Tag>
  )
}
