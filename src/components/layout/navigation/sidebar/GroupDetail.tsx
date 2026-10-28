// components/layout/navigation/sidebar/GroupDetail.tsx
// Tampilan detail: baris "‹ Nama Grup" untuk kembali, lalu menu grup itu.

import { cn } from "@/lib/utils"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import type { NavGroup } from "@/config/navigation"
import { getGroupIcon } from "./types/icons"
import { NavNodeRow } from "./NavNodeRow"
import { NavRowContent, RowSeparator } from "./NavRow"
import { navRowClass } from "./types/styles"
import type { ActiveInfo } from "./types/types"
import { nodeKey } from "./types/utils"

type Props = {
  group: NavGroup
  active: ActiveInfo
  onBack: () => void
}

export function GroupDetail({ group, active, onBack }: Props) {
  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onBack}
        aria-label={`Kembali ke daftar menu dari ${group.title}`}
        className={cn(navRowClass(false), "font-medium")}
      >
        <NavRowContent
          icon={ArrowLeft01Icon}
          iconClassName="transition-transform duration-200 group-hover/row:-translate-x-0.5 motion-reduce:transition-none"
        >
          {group.title}
        </NavRowContent>
      </button>

      <RowSeparator />

      <ul className="flex flex-col gap-0.5">
        {group.items.map((node, i) => (
          <NavNodeRow
            key={nodeKey(node, i)}
            node={node}
            active={active}
            fallbackIcon={getGroupIcon(group.id)}
          />
        ))}
      </ul>
    </div>
  )
}
