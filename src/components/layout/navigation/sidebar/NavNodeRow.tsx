// components/layout/navigation/sidebar/NavNodeRow.tsx
// Satu node menu: folder (label seksi + anak-anaknya) atau halaman (link).

import Link from "next/link"
import type { IconSvgElement } from "@hugeicons/react"
import { cn } from "@/lib/utils"
import { isNavFolder, type NavNode } from "@/config/navigation"
import { getItemIcon } from "./types/icons"
import { NavRowContent } from "./NavRow"
import { SECTION_LABEL, navRowClass } from "./types/styles"
import type { ActiveInfo } from "./types/types"
import { isPending, nodeKey } from "./types/utils"

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
        <span className={cn(SECTION_LABEL, "pb-1.5 pt-4")}>{node.title}</span>
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
              <span className="shrink-0 rounded-full border border-sidebar-border px-1.5 py-0.5 text-[10px] font-medium leading-none text-sidebar-foreground/70">
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
