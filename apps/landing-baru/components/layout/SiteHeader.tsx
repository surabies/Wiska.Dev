import Link from "next/link"

import { AutoHideHeader } from "@/components/layout/AutoHideHeader"
import { Logo } from "@/components/layout/Logo"
import { MobileMenu } from "@/components/layout/MobileMenu"
import { SearchExperience } from "@/components/layout/SearchExperience"
import { PillButton } from "@/components/shared/PillButton"
import { downloadAppLink, mainNavLinks } from "@/config/site"
import { topEventsContent } from "@/data/home"

export function SiteHeader() {
  return (
    <AutoHideHeader>
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-360 items-center p-4 lg:px-12 lg:py-6"
      >
        <Logo className="max-md:flex-1" />

        <SearchExperience events={topEventsContent.events} />

        <ul className="ml-auto hidden items-center md:flex">
          {mainNavLinks.map((link) => (
            <li key={link.href} className="mx-2.5 lg:mx-3 xl:mx-5">
              <Link
                href={link.href}
                className="relative block text-base leading-4.75 outline-none before:absolute before:inset-x-0 before:-top-2.5 before:h-px before:w-0 before:bg-current before:transition-[width] before:duration-150 before:ease-in-out hover:before:w-full focus-visible:before:w-full"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        <MobileMenu />

        <PillButton
          asChild
          className="mx-2.5 hidden h-8 px-3 last:mr-0 md:inline-flex lg:h-10 lg:px-5.5"
        >
          <Link href={downloadAppLink.href}>{downloadAppLink.label}</Link>
        </PillButton>
      </nav>
    </AutoHideHeader>
  )
}
