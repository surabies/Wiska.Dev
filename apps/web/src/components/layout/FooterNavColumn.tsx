"use client"

import { ChevronDown } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { useMediaQuery } from "@/hooks/use-media-query"
import { getLinkProps } from "@/lib/links"
import type { FooterNavGroup } from "@/types/site"

interface FooterNavColumnProps {
  group: FooterNavGroup
}

/** Akordeon di mobile, selalu terbuka di desktop (≥ 992px). */
export function FooterNavColumn({ group }: FooterNavColumnProps) {
  const [open, setOpen] = useState(false)
  const isDesktop = useMediaQuery("(min-width: 62rem)")

  return (
    <details open={isDesktop || open} className="group lg:ml-6 lg:w-50">
      <summary
        onClick={(event) => {
          event.preventDefault()
          setOpen((current) => !current)
        }}
        className="relative mb-6 flex h-6 cursor-pointer list-none items-center type-caption font-bold outline-none lg:pointer-events-none lg:mb-5 lg:p-0 [&::-webkit-details-marker]:hidden"
      >
        {group.title}
        <ChevronDown
          size={32}
          className="absolute inset-y-0 right-0 my-auto transition-transform duration-150 ease-in group-open:rotate-180 lg:hidden"
          aria-hidden="true"
        />
      </summary>

      <nav aria-label={group.title}>
        {group.links.map((link) => (
          <div key={link.label} className="my-6">
            <Link
              href={link.href}
              {...getLinkProps(link)}
              className="link-underline min-h-6 type-caption leading-6!"
            >
              {link.label}
            </Link>
          </div>
        ))}
      </nav>
    </details>
  )
}
