// components/layout/navigation/sidebar/NavNodeRow.tsx
// Satu node menu: folder (label seksi + anak-anaknya) atau halaman (link).

import Link from "next/link"
import type { IconSvgElement } from "@hugeicons/react"
import { cn } from "@/lib/Utilitas"
import { isNavFolder, type NavNode } from "@/config/Navigasi"
import { getItemIcon } from "./types/Icons"
import { NavRowContent } from "./NavRow"
import { SECTION_LABEL, navRowClass } from "./types/Styles"
import type { ActiveInfo } from "./types/Tipe"
import { isPending, nodeKey } from "./types/Utilitas"

type Props = {
  node: NavNode
  active: ActiveInfo
  fallbackIcon: IconSvgElement
}

export function NavNodeRow({ node, active, fallbackIcon }: Props) {
  // Folder -> label seksi kecil, lalu anak-anaknya (boleh bersarang).
  if (isNavFolder(node)) {
    return (
      <li className="flex flex-col">
        <span className={cn(SECTION_LABEL, "pt-4 pb-1.5")}>{node.title}</span>
        <ul className="flex flex-col gap-0.5">
          {node.children.map((child, i) => (
            <NavNodeRow
              key={nodeKey(child, i)}
              node={child}
              active={active}
              fallbackIcon={fallbackIcon}
            />
          ))}
        </ul>
      </li>
    )
  }

  const isActive = node === active.item

  return (
    <li>
      <Link
        href={node.href}
        aria-current={isActive ? "page" : undefined}
        className={navRowClass(isActive)}
      >
        <NavRowContent
          icon={getItemIcon(node.title, fallbackIcon)}
          trailing={
            isPending(node) && (
              <span className="shrink-0 rounded-full border border-sidebar-border px-1.5 py-0.5 text-[10px] leading-none font-medium text-sidebar-foreground/70">
                Segera
              </span>
            )
          }
        >
          {node.title}
        </NavRowContent>
      </Link>
    </li>
  )
}
