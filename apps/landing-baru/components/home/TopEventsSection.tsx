import Link from "next/link"

import { EventCard } from "@/components/home/EventCard"
import { Container } from "@/components/shared/Container"
import { PillButton } from "@/components/shared/PillButton"
import type { TopEventsContent } from "@/types/home"

interface TopEventsSectionProps {
  content: TopEventsContent
}

/** Path clip tiket (koordinat 0–1) — dipakai oleh `EventCard`. */
const TICKET_CLIP_PATH =
  "M0.4666666666666667 4.0797391304347825e-8C0.4666666666666667 0.01920994202898551 0.4822405797101449 0.034782608695652174 0.5014492753623189 0.034782608695652174C0.5206579710144927 0.034782608695652174 0.5362318840579711 0.01920994202898551 0.5362318840579711 4.6878840579710144e-8L0.9710144927536232 2.1097420289855072e-7C0.9870231884057972 2.1381420289855074e-7 1 0.012977449275362318 1 0.028985797101449273L1 0.9710144927536232C1 0.9870231884057972 0.9870231884057972 1 0.9710144927536232 1L0.5362318840579711 1C0.5362318840579711 0.980791304347826 0.5206579710144927 0.9652173913043478 0.5014492753623189 0.9652173913043478C0.4822405797101449 0.9652173913043478 0.4666666666666667 0.980791304347826 0.4666666666666667 1L0.028985507246376812 1C0.012977304347826088 1 4.1434202898550726e-8 0.9870231884057972 4.212376811594203e-8 0.9710144927536232L8.592260869565217e-8 0.028985507246376812C8.732231884057972e-8 0.012977304347826088 0.012977333333333332 3.9834202898550725e-8 0.028985507246376812 4.123391304347826e-8L0.4666666666666667 4.0797391304347825e-8Z"

export function TopEventsSection({ content }: TopEventsSectionProps) {
  return (
    <section aria-labelledby="top-events-title" className="py-18.75 md:py-37.5">
      <svg
        width="0"
        height="0"
        aria-hidden="true"
        focusable="false"
        className="absolute"
      >
        <clipPath id="ticket-clip-path" clipPathUnits="objectBoundingBox">
          <path d={TICKET_CLIP_PATH} />
        </clipPath>
      </svg>

      <Container>
        <h2
          id="top-events-title"
          className="mb-4.5 type-body font-bold lg:font-bold"
        >
          {content.title}
        </h2>
        <div className="mb-7.5 flex flex-col gap-4.5 md:flex-row md:gap-6.25">
          <p className="type-body md:flex-[0_0_60%]">{content.description}</p>
          <div className="flex w-full items-end justify-end">
            <PillButton asChild>
              <Link href={content.cta.href}>{content.cta.label}</Link>
            </PillButton>
          </div>
        </div>
      </Container>

      {/* Scrollbar disembunyikan dengan menggeser ke luar area overflow-hidden. */}
      <div className="overflow-hidden">
        <div className="-mb-25">
          <ul className="flex snap-x scrollbar-none gap-4 overflow-x-auto ps-[max(1rem,calc(100%-1000px)/2+1rem)] pe-4 pb-25">
            {content.events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
