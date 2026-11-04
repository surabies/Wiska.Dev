import Link from "next/link"

import type { TicketEvent } from "@/types/home"

interface EventCardProps {
  event: TicketEvent
}

const URL_LAYANAN: Record<string, string> = {
  "1": "/cek-tagihan",
  "2": "/lapor-meter",
  "3": "/pengaduan-air",
  "4": "/peta-pengaduan",
  "5": "/pasang-baru",
  "6": "/info-gangguan",
}

/** Kartu event berbentuk tiket (memakai clipPath `#ticket-clip-path`). */
export function EventCard({ event }: EventCardProps) {
  const href = URL_LAYANAN[event.id] ?? "/cek-tagihan"

  return (
    <li className="w-65 shrink-0 snap-start md:w-75">
      <Link href={href} className="block group outline-none">
        <article className="grid aspect-square grid-cols-2 overflow-hidden bg-black text-white [clip-path:url(#ticket-clip-path)] transition-transform duration-200 group-hover:scale-[1.02]">
          <div
            aria-hidden="true"
            style={{ backgroundColor: event.accentColor }}
            className="transition-opacity group-hover:opacity-90"
          />
          <div className="flex flex-col justify-between p-4">
            <div>
              <p className="text-xs font-bold tracking-[0.06em] uppercase text-white/80">
                {event.date}
              </p>
              <h3 className="mt-2 text-base leading-5 font-semibold group-hover:underline">
                {event.title}
              </h3>
            </div>
            <div className="text-xs leading-4">
              <p className="font-medium">{event.venue}</p>
              <p className="text-white/60">{event.city}</p>
              <p className="mt-2 font-bold text-white/90">{event.price}</p>
            </div>
          </div>
        </article>
      </Link>
    </li>
  )
}
