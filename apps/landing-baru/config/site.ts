import type {
  FooterNavGroup,
  LanguageOption,
  NavLink,
  SocialLink,
} from "@/types/site";

export const siteConfig = {
  name: "DICE",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  title: "DICE | Tickets for your kind of shows",
  description:
    "We’ll get you out more. We bring the best live events to people around the world. See what concerts, tours, and festivals are happening in your area.",
  keywords: [
    "DICE",
    "DICE App",
    "DICE FM",
    "Music",
    "Gigs",
    "Gig Tickets",
    "Concerts",
    "Ticketing",
    "Events",
    "iPhone app",
    "Android",
    "Festival",
  ],
  copyright: "© DICE FM Holdings Ltd",
  trademark:
    "DICE and The Fan logo are registered trademarks of DICE FM Holdings Ltd.",
  footerLogo: {
    src: "https://dice.fm/static/images/dice-fan.gif",
    alt: "DICE",
    width: 200,
    height: 244,
  },
} as const;

export const downloadAppLink: NavLink = {
  label: "Get the app",
  href: "/download_the_app",
};

export const mainNavLinks: NavLink[] = [
  { label: "Browse events", href: "/browse" },
  { label: "Get help", href: "/help" },
  { label: "Create events", href: "/partners" },
  { label: "Talk to sales", href: "/partners/contact" },
  { label: "Log in / Sign up", href: "/login" },
];

export const footerNavGroups: FooterNavGroup[] = [
  {
    title: "Our company",
    links: [
      { label: "About DICE", href: "/about" },
      { label: "Careers", href: "/jobs" },
      {
        label: "Diversity, equity & inclusion",
        href: "/diversity-equity-inclusion",
      },
    ],
  },
  {
    title: "Fan support",
    links: [
      { label: "Get help", href: "/help" },
      { label: "FAQs", href: "https://dicefm.zendesk.com/hc/", external: true },
      { label: "Request a refund", href: "/help/event_refund" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Artists", href: "/artists" },
      { label: "Venues", href: "/venues" },
      { label: "Blog", href: "/blog" },
      { label: "Press", href: "/press" },
      { label: "Partners", href: "/partners" },
    ],
  },
];

export const legalLinks: NavLink[] = [
  { label: "Privacy Policy", href: "/privacy_policy.html" },
  { label: "Terms of Use", href: "/terms_and_conditions.html" },
  { label: "Purchase Terms", href: "/ticket_purchase_terms.html" },
];

export const socialLinks: SocialLink[] = [
  {
    label: "Follow us on Instagram",
    href: "https://instagram.com/dicefm",
    platform: "instagram",
  },
  {
    label: "Follow us on TikTok",
    href: "https://www.tiktok.com/@dice.fm",
    platform: "tiktok",
  },
  {
    label: "Follow us on LinkedIn",
    href: "https://www.linkedin.com/company/dice-fm/",
    platform: "linkedin",
  },
];

export const appStoreLinks: NavLink[] = [
  {
    label: "iOS",
    href: "https://itunes.apple.com/app/id898358948",
    external: true,
  },
  {
    label: "Android",
    href: "https://play.google.com/store/apps/details?id=fm.dice",
    external: true,
  },
];

export const currentLanguageLabel = "English (United States)";

export const languages: LanguageOption[] = [
  { label: "English", href: "/" },
  { label: "English (United States)", href: "/" },
  { label: "English (Canada)", href: "/" },
  { label: "Français", href: "/?lng=fr" },
  { label: "Español", href: "/?lng=es" },
  { label: "Català", href: "/?lng=ca" },
  { label: "Italiano", href: "/?lng=it" },
  { label: "Português", href: "/?lng=pt" },
  { label: "Deutsch", href: "/?lng=de" },
];
