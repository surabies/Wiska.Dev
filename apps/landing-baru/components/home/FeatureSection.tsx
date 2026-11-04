import Image from "next/image"
import Link from "next/link"

import { Container } from "@/components/shared/Container"
import { PillButton } from "@/components/shared/PillButton"
import { SwipeRevealMedia } from "@/components/shared/SwipeRevealMedia"
import { cn } from "@/lib/utils"
import type { FeatureMedia, FeatureSectionContent } from "@/types/home"

interface FeatureSectionProps {
  section: FeatureSectionContent
}

function FeatureMediaView({ media }: { media: FeatureMedia }) {
  if (media.type === "image") {
    return (
      <Image
        src={media.src}
        alt={media.alt}
        width={media.width}
        height={media.height}
        sizes="(min-width: 1280px) 516px, (min-width: 768px) 50vw, 100vw"
        className="h-auto w-full rounded-4 object-cover"
      />
    )
  }

  return (
    <video
      src={media.src}
      autoPlay
      loop
      muted
      playsInline
      aria-hidden="true"
      className="aspect-4/5 h-auto w-full rounded-4 object-cover"
    />
  )
}

/** Blok gambar/video + teks. Posisi media bergantian lewat `mediaPosition`. */
export function FeatureSection({ section }: FeatureSectionProps) {
  const { id, title, description, media, mediaPosition, cta } = section
  const titleId = `${id}-title`

  return (
    <section
      aria-labelledby={titleId}
      className="section-white relative bg-white py-20 text-black lg:py-30"
    >
      <Container>
        <div
          className={cn(
            "flex flex-col md:gap-21.75",
            mediaPosition === "right" ? "md:flex-row-reverse" : "md:flex-row"
          )}
        >
          <div className="mb-4 flex flex-1 overflow-hidden rounded-4 md:mb-0">
            <SwipeRevealMedia>
              <FeatureMediaView media={media} />
            </SwipeRevealMedia>
          </div>

          {/* Mobile: elemen "melebur" agar judul bisa tampil di atas media. */}
          <div className="contents md:flex md:flex-1 md:flex-col md:justify-center md:gap-6.25">
            <h2
              id={titleId}
              className="type-heading max-md:order-first max-md:mb-4"
            >
              {title}
            </h2>

            <p className="max-w-142.5 type-body whitespace-pre-line">
              {description}
            </p>

            {cta ? (
              <div className="flex justify-end max-md:mt-4.5 md:block">
                <PillButton asChild className="inline-flex">
                  <Link href={cta.href}>{cta.label}</Link>
                </PillButton>
              </div>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  )
}
