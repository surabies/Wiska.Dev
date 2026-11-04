import Link from "next/link"

import { HlsVideo } from "@/components/shared/HlsVideo"
import { PillButton } from "@/components/shared/PillButton"
import { SwipeHeading } from "@/components/shared/SwipeHeading"
import type { HeroContent } from "@/types/home"

interface HeroSectionProps {
  content: HeroContent
}

export function HeroSection({ content }: HeroSectionProps) {
  return (
    <section className="mx-auto w-full max-w-360 px-4 lg:px-12 pt-3 md:pt-3">
      <div className="flex flex-col md:grid md:grid-cols-2 md:grid-rows-[1fr] md:gap-x-12">
        <div className="flex flex-col justify-center gap-4.5 max-md:order-2 md:gap-6.25">
          <div className="mb-2 max-w-162">
            <SwipeHeading text={content.title} />
          </div>

          <p className="max-w-142.5 type-body text-neutral-700">{content.description}</p>

          <div className="flex justify-end md:block">
            <PillButton asChild className="inline-flex">
              <Link href={content.cta.href}>{content.cta.label}</Link>
            </PillButton>
          </div>
        </div>

        <div className="flex justify-end overflow-hidden rounded-4 max-md:order-1 max-md:mb-6 md:-mt-1 lg:-mt-2">
          <div className="relative text-[0px] leading-0 w-full flex justify-end">
            <HlsVideo
              src={content.videoSrc}
              className="relative aspect-4/5 h-auto w-full rounded-4 object-cover md:h-[calc(100vh-120px)] md:max-h-240 md:w-auto"
            />
          </div>
        </div>
      </div>
    </section>
  )
}
