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
        aria-label="Navigasi Utama"
        className="mx-auto flex max-w-360 items-center justify-between p-4 flex-nowrap lg:px-12 lg:py-5"
      >
        <Logo className="shrink-0" />

        <SearchExperience events={topEventsContent.events} />

        <div className="ml-auto flex items-center shrink-0">
          <ul className="hidden items-center md:flex shrink-0">
            {mainNavLinks.map((link) => (
              <li key={link.href} className="mx-2 lg:mx-3 xl:mx-4 shrink-0">
                <Link
                  href={link.href}
                  className="relative block text-sm leading-none outline-none font-medium text-neutral-800 transition-colors hover:text-black dark:text-neutral-200 dark:hover:text-white whitespace-nowrap before:absolute before:inset-x-0 before:-top-2 before:h-0.5 before:w-0 before:bg-current before:transition-[width] before:duration-150 before:ease-in-out hover:before:w-full focus-visible:before:w-full"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <MobileMenu />

          <PillButton
            asChild
            className="ml-3.5 hidden last:mr-0 md:inline-flex shrink-0 whitespace-nowrap"
          >
            <Link href={downloadAppLink.href}>{downloadAppLink.label}</Link>
          </PillButton>
        </div>
      </nav>
    </AutoHideHeader>
  )
}
