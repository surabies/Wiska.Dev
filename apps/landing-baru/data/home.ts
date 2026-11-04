import type {
  BenefitsContent,
  FeatureSectionContent,
  HeroContent,
  TicketingContent,
  TopEventsContent,
} from "@/types/home"

const PRISMIC_CDN = "https://dicewebsite.cdn.prismic.io/dicewebsite"

export const heroContent: HeroContent = {
  title: "Welcome to the alternative",
  description:
    "Incredible live shows. Upfront pricing. Relevant recommendations. DICE makes going out easy.",
  videoSrc: "/capped-1080p.mp4",
  cta: { label: "Get the app", href: "/download_the_app" },
}

/**
 * Di HTML hasil clone, daftar event kosong karena dimuat lewat API saat
 * runtime. Data di bawah hanya contoh — ganti dengan data dari API/DB.
 */
export const topEventsContent: TopEventsContent = {
  title: "Trending in your city",
  description:
    "Check out some of the most popular events coming up in your city, from club nights and gigs to artist signings and comedy shows.",
  cta: { label: "Browse events", href: "/browse" },
  events: [
    {
      id: "1",
      title: "Sample event one",
      venue: "Venue name",
      city: "City",
      date: "Fri 6 Nov",
      price: "$25.00",
      accentColor: "#f2ef1d",
    },
    {
      id: "2",
      title: "Sample event two",
      venue: "Venue name",
      city: "City",
      date: "Sat 7 Nov",
      price: "$18.50",
      accentColor: "#4bfa94",
    },
    {
      id: "3",
      title: "Sample event three",
      venue: "Venue name",
      city: "City",
      date: "Sun 8 Nov",
      price: "$32.00",
      accentColor: "#24afee",
    },
    {
      id: "4",
      title: "Sample event four",
      venue: "Venue name",
      city: "City",
      date: "Thu 12 Nov",
      price: "$15.00",
      accentColor: "#a783ff",
    },
    {
      id: "5",
      title: "Sample event five",
      venue: "Venue name",
      city: "City",
      date: "Fri 13 Nov",
      price: "$40.00",
      accentColor: "#00d8af",
    },
    {
      id: "6",
      title: "Sample event six",
      venue: "Venue name",
      city: "City",
      date: "Sat 14 Nov",
      price: "$22.00",
      accentColor: "#f2ef1d",
    },
  ],
}

/**
 * Gambar tiga kolom ini lazy-load di situs asli (hanya placeholder di HTML
 * clone). Simpan aset ke /public/images/home lalu isi field `image`.
 */
export const ticketingContent: TicketingContent = {
  title: "Weirdly easy ticketing",
  items: [
    { description: "Get tickets in less time\nthan it took to read this" },
    {
      description: "See the full price upfront, with no surprises at checkout",
    },
    { description: "Personalised recommendations on your unique Home feed" },
  ],
}

export const benefitsContent: BenefitsContent = {
  title: "What else?",
  items: [
    {
      title: "Get tickets to sold out shows",
      icon: { src: `${PRISMIC_CDN}/Z6tNz5bqstJ9-emG_ticket.svg`, alt: "" },
    },
    {
      title: "Invite friends in a few taps",
      icon: { src: `${PRISMIC_CDN}/Z6tN2pbqstJ9-emH_friends-add.svg`, alt: "" },
    },
    {
      title: "Access exclusive merch",
      icon: { src: `${PRISMIC_CDN}/Z6tN5pbqstJ9-emK_merch.svg`, alt: "" },
    },
  ],
}

export const featureSections: FeatureSectionContent[] = [
  {
    id: "partners",
    title: "A network of world-class venues and promoters",
    description:
      "We partner with the people and places that keep live music culture thriving around the world",
    media: {
      type: "image",
      src: "https://images.prismic.io/dicewebsite/ahCB3LK9tuLqEFdI_b2b-partners-logo-narrow.png?auto=format%2Ccompress&fit=max&w=3840",
      alt: "",
      width: 1080,
      height: 1350,
    },
    mediaPosition: "right",
    cta: { label: "Become a Partner", href: "/partners" },
  },
  {
    id: "artists",
    title: "Familiar favs, new crushes",
    description:
      "Easily find and follow your favourite artists, and we’ll recommend more based on your impeccable taste",
    media: {
      type: "video",
      src: `${PRISMIC_CDN}/Z6tTHZbqstJ9-eqd_B2C_Home_Artists-1-.mp4`,
    },
    mediaPosition: "left",
  },
  {
    id: "reviews",
    title: "Loved by millions",
    description:
      "You said, “ticket purchasing revolution, the best gig ticket app, refreshing, reassuring, stress-free, 10/10, kind, caring, outstanding, easy, best support, can’t praise this app enough”. We blush.",
    media: {
      type: "video",
      src: `${PRISMIC_CDN}/Z6tsYJbqstJ9-fMC_B2C_Home_Fans-1-.mp4`,
    },
    mediaPosition: "right",
    cta: { label: "Get the app", href: "/download_the_app" },
  },
]
