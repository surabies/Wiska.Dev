export interface NavLink {
  label: string
  href: string
  external?: boolean
}

export interface FooterNavGroup {
  title: string
  links: NavLink[]
}

export interface SocialLink {
  label: string
  href: string
  platform: "instagram" | "tiktok" | "linkedin"
}

export interface LanguageOption {
  label: string
  href: string
}
