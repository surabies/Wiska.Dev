"use client"

import { ArrowLeft, ArrowRight } from "lucide-react"
import { Children, useState, type CSSProperties, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MobileSliderProps {
  children: ReactNode
  /** Layout untuk layar ≥ md (mis. `md:grid md:grid-cols-3 md:gap-10`). */
  className?: string
}

const arrowClassName =
  "pointer-events-auto size-[30px] rounded-full bg-white p-[3px] text-black opacity-60 hover:bg-white hover:opacity-75"

/**
 * Di mobile: slider horizontal dengan tombol panah.
 * Di ≥ md: slide dilepas dan anak-anaknya mengikuti `className`.
 */
export function MobileSlider({ children, className }: MobileSliderProps) {
  const slides = Children.toArray(children)
  const [index, setIndex] = useState(0)

  const move = (step: number) =>
    setIndex((current) => (current + step + slides.length) % slides.length)

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      className="relative max-w-full overflow-hidden"
    >
      <div
        style={
          {
            "--slide-count": slides.length,
            "--slide-offset": `${index * -100}%`,
          } as CSSProperties
        }
        className={cn(
          "max-md:ml-(--slide-offset) max-md:flex max-md:w-[calc(var(--slide-count)*100%)] max-md:flex-row max-md:transition-[margin-left] max-md:duration-200 max-md:*:flex-1 max-md:*:basis-0",
          className
        )}
      >
        {slides}
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-between p-2 md:hidden">
        <Button
          type="button"
          size="icon"
          aria-label="Previous"
          className={arrowClassName}
          onClick={() => move(-1)}
        >
          <ArrowLeft size={24} aria-hidden="true" />
        </Button>
        <Button
          type="button"
          size="icon"
          aria-label="Next"
          className={arrowClassName}
          onClick={() => move(1)}
        >
          <ArrowRight size={24} aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}
