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
    <footer className="bg-white px-4 pt-15 pb-8 text-black lg:p-12.5">
      {/* Footer utama */}
      <div className="mx-auto flex max-w-7xl flex-wrap pb-2 lg:pb-8">
        <div className="mb-15 w-full lg:w-auto">
          <Link href="/" className="-ml-1.75 block w-15 lg:-ml-3 lg:w-22.5">
            <Image
              src={footerLogo.src}
              alt={footerLogo.alt}
              width={footerLogo.width}
              height={footerLogo.height}
              unoptimized
              className="block h-auto w-full"
            />
          </Link>
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
          <div className="mt-6 lg:mt-0 lg:mr-6">
            {/* TODO: sambungkan ke consent manager (mis. OneTrust/Cookiebot). */}
            <button type="button" className="cursor-pointer type-caption">
              Cookie Settings
            </button>
          </div>
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
                >
                  <Icon className="block size-7" />
                </a>
              )
            })}
          </div>
        </div>

        <AppStoreButtons
          className="my-8 lg:hidden"
          buttonClassName="uppercase"
        />

        <span className="my-3 block type-caption lg:order-first lg:m-0">
          {siteConfig.copyright}
        </span>
        <span className="block w-full type-caption text-black/50 lg:mt-7">
          {siteConfig.trademark}
        </span>
      </div>
    </footer>
  )
}
