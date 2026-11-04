import Image from "next/image"
import Link from "next/link"

import { AppStoreButtons } from "@/components/layout/AppStoreButtons"
import { FooterNavColumn } from "@/components/layout/FooterNavColumn"
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher"
import {
  InstagramIcon,
  LinkedinIcon,
  TiktokIcon,
} from "@/components/icons/SocialIcons"
import {
  footerNavGroups,
  legalLinks,
  siteConfig,
  socialLinks,
} from "@/config/site"
import type { SocialLink } from "@/types/site"

const socialIcons = {
  instagram: InstagramIcon,
  tiktok: TiktokIcon,
  linkedin: LinkedinIcon,
} satisfies Record<SocialLink["platform"], typeof InstagramIcon>

export function SiteFooter() {
  const { footerLogo } = siteConfig

  return (
    <footer className="bg-white px-4 pt-15 pb-8 text-black lg:p-12.5 border-t">
      {/* Footer utama */}
      <div className="mx-auto flex max-w-7xl flex-wrap pb-2 lg:pb-8">
        <div className="mb-15 w-full lg:w-auto">
          <Link href="/" className="block max-w-[220px]">
            <div className="flex items-center gap-3">
              <div className="relative size-12 shrink-0">
                <Image
                  src={footerLogo.src}
                  alt={footerLogo.alt}
                  fill
                  unoptimized
                  className="object-contain"
                />
              </div>
              <div>
                <p className="font-extrabold text-base tracking-tight leading-tight">
                  PERUMDA
                  <br />
                  TIRTAWENING
                </p>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                  Kota Bandung
                </p>
              </div>
            </div>
          </Link>
          <div className="mt-4 max-w-xs text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground">Kantor Pusat:</p>
            <p>Jl. Badaksinga No. 10, Coblong, Kota Bandung 40132</p>
            <p className="mt-1">Call Center: (022) 2509030 / 2509032</p>
            <p>WhatsApp: 0811-2260-656</p>
          </div>
        </div>

        <div className="flex w-full flex-col justify-end lg:mb-11 lg:w-auto lg:flex-1 lg:flex-row lg:pb-7.5">
          {footerNavGroups.map((group) => (
            <FooterNavColumn key={group.title} group={group} />
          ))}
        </div>

        <AppStoreButtons
          className="hidden w-full lg:flex"
          buttonClassName="normal-case"
        />
      </div>

      {/* Footer sekunder */}
      <div className="mx-auto flex max-w-7xl flex-col border-t border-placeholder pt-8 lg:flex-row lg:flex-wrap lg:items-center lg:pt-6">
        <LanguageSwitcher className="lg:mx-12.5" />

        <div className="flex flex-col lg:flex-1 lg:flex-row lg:items-center lg:justify-end">
          {legalLinks.map((link) => (
            <div key={link.href} className="mt-6 lg:mt-0 lg:mr-6">
              <Link href={link.href} className="type-caption">
                {link.label}
              </Link>
            </div>
          ))}
          <div className="mt-6 flex gap-2 lg:mt-0">
            {socialLinks.map((social) => {
              const Icon = socialIcons[social.platform]
              return (
                <a
                  key={social.platform}
                  href={social.href}
                  title={social.label}
                  aria-label={social.label}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-black/70 hover:text-black transition-colors"
                >
                  <Icon className="block size-6" />
                </a>
              )
            })}
          </div>
        </div>

        <AppStoreButtons
          className="my-8 lg:hidden"
          buttonClassName="uppercase"
        />

        <span className="my-3 block type-caption lg:order-first lg:m-0 font-medium">
          {siteConfig.copyright}
        </span>
        <span className="block w-full type-caption text-black/50 lg:mt-7">
          {siteConfig.trademark}
        </span>
      </div>
    </footer>
  )
}
