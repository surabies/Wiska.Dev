import type { TicketEvent } from "@/types/home"

interface EventCardProps {
  event: TicketEvent
}

/** Kartu event berbentuk tiket (memakai clipPath `#ticket-clip-path`). */
export function EventCard({ event }: EventCardProps) {
  return (
    <li className="w-65 shrink-0 snap-start md:w-75">
      <article className="grid aspect-square grid-cols-2 overflow-hidden bg-black text-white [clip-path:url(#ticket-clip-path)]">
        <div
          aria-hidden="true"
          style={{ backgroundColor: event.accentColor }}
        />
        <div className="flex flex-col justify-between p-4">
          <div>
            <p className="text-xs font-bold tracking-[0.06em] uppercase">
              {event.date}
            </p>
            <h3 className="mt-2 text-base leading-5 font-medium">
              {event.title}
            </h3>
          </div>
          <div className="text-xs leading-4">
            <p>{event.venue}</p>
            <p className="text-white/60">{event.city}</p>
            <p className="mt-2 font-bold">{event.price}</p>
          </div>
        </div>
      </article>
    </li>
  )
}
