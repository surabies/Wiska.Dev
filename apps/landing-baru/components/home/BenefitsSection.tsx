"use client"

import Image from "next/image"
import { useState } from "react"

import { Container } from "@/components/shared/Container"
import { ImageFrame } from "@/components/shared/ImageFrame"
import { MobileSlider } from "@/components/shared/MobileSlider"
import { cn } from "@/lib/utils"
import type { BenefitsContent } from "@/types/home"

interface BenefitsSectionProps {
  content: BenefitsContent
}

/**
 * Daftar keunggulan. Di ≥ md, item yang di-hover/fokus menjadi aktif dan
 * gambar di sebelahnya ikut berganti. Di mobile tampil sebagai slider.
 */
export function BenefitsSection({ content }: BenefitsSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  return (
    <section
      aria-labelledby="benefits-title"
      className="section-white relative bg-white py-20 text-black lg:py-30"
    >
      <Container>
        <div className="lg:flex lg:flex-row-reverse lg:items-center lg:gap-21.75">
          <div className="lg:w-full">
            <h2 id="benefits-title" className="mb-4 type-heading md:mb-6">
              {content.title}
            </h2>

            <MobileSlider>
              {content.items.map((item, index) => (
                <div
                  key={item.title}
                  tabIndex={0}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={() => setActiveIndex(index)}
                  className={cn(
                    "mb-7.5 last:mb-0 md:mb-0 md:cursor-pointer md:opacity-30 md:transition-opacity md:duration-150 md:ease-in",
                    index === activeIndex && "md:opacity-100"
                  )}
                >
                  <ImageFrame
                    image={item.image}
                    sizes="100vw"
                    className="mb-4 aspect-4/5 bg-placeholder md:hidden"
                  />

                  <div className="md:relative md:pl-10.5">
                    <h3 className="mb-5 block w-full text-center text-[15px] leading-5 font-normal md:mb-2.5 md:flex md:text-left md:text-[28px] md:leading-8.5">
                      <Image
                        src={item.icon.src}
                        alt={item.icon.alt}
                        width={32}
                        height={32}
                        unoptimized
                        className="hidden md:absolute md:top-0 md:left-0 md:block md:size-8"
                      />
                      <span className="whitespace-pre-line">{item.title}</span>
                    </h3>
                  </div>
                </div>
              ))}
            </MobileSlider>
          </div>

          {/* Gambar pendamping — hanya ≥ md; ditumpuk lalu cross-fade. */}
          <div className="hidden w-full md:grid">
            {content.items.map((item, index) => (
              <ImageFrame
                key={item.title}
                image={item.image}
                sizes="(min-width: 1280px) 516px, 50vw"
                className={cn(
                  "col-start-1 row-start-1 aspect-4/5 bg-placeholder transition-opacity duration-150 ease-in",
                  index === activeIndex ? "opacity-100" : "opacity-0"
                )}
              />
            ))}
          </div>
        </div>
      </Container>
    </section>
  )
}
