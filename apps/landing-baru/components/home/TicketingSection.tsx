import { Container } from "@/components/shared/Container"
import { ImageFrame } from "@/components/shared/ImageFrame"
import { MobileSlider } from "@/components/shared/MobileSlider"
import type { TicketingContent } from "@/types/home"

interface TicketingSectionProps {
  content: TicketingContent
}

export function TicketingSection({ content }: TicketingSectionProps) {
  return (
    <section
      aria-labelledby="ticketing-title"
      className="relative bg-black pt-7.5 pb-10 text-white md:pt-15 md:pb-20"
    >
      <Container>
        <h2
          id="ticketing-title"
          className="mb-4 text-center type-heading md:mb-6"
        >
          {content.title}
        </h2>

        <MobileSlider className="md:grid md:grid-cols-3 md:gap-10">
          {content.items.map((item) => (
            <figure
              key={item.description}
              className="m-0 block w-full text-center"
            >
              <ImageFrame
                image={item.image}
                sizes="(min-width: 1000px) 320px, 100vw"
                className="mb-4 aspect-square bg-neutral-800"
              />
              <figcaption className="type-body text-balance whitespace-pre-line">
                {item.description}
              </figcaption>
            </figure>
          ))}
        </MobileSlider>
      </Container>
    </section>
  )
}
