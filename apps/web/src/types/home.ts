export interface ImageAsset {
  src: string
  alt: string
}

export interface CtaLink {
  label: string
  href: string
}

export interface HeroContent {
  title: string
  description: string
  videoSrc: string
  cta: CtaLink
}

export interface TicketEvent {
  id: string
  title: string
  venue: string
  city: string
  date: string
  price: string
  accentColor: string
}

export interface TopEventsContent {
  title: string
  description: string
  cta: CtaLink
  events: TicketEvent[]
}

export interface TicketingItem {
  description: string
  image?: ImageAsset
}

export interface TicketingContent {
  title: string
  items: TicketingItem[]
}

export interface BenefitItem {
  title: string
  icon: ImageAsset
  image?: ImageAsset
}

export interface BenefitsContent {
  title: string
  items: BenefitItem[]
}

export type FeatureMedia =
  | { type: "image"; src: string; alt: string; width: number; height: number }
  | { type: "video"; src: string }

export interface FeatureSectionContent {
  id: string
  title: string
  description: string
  media: FeatureMedia
  mediaPosition: "left" | "right"
  cta?: CtaLink
}
