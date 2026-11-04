import Image from "next/image"

import { cn } from "@/lib/utils"
import type { ImageAsset } from "@/types/home"

interface ImageFrameProps {
  image?: ImageAsset
  sizes: string
  className?: string
}

/**
 * Bingkai gambar dengan rasio tetap. Tanpa `image`, tampil sebagai blok
 * placeholder sehingga layout tidak bergeser.
 */
export function ImageFrame({ image, sizes, className }: ImageFrameProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-[5px]", className)}>
      {image ? (
        <Image
          src={image.src}
          alt={image.alt}
          fill
          unoptimized
          sizes={sizes}
          className="object-cover"
        />
      ) : null}
    </div>
  )
}
