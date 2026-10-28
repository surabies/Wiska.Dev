// components/layout/navigation/sidebar/GroupList.tsx
// Tampilan root: daftar grup/direktorat. Satu baris per grup, panah di kanan.

import { navGroups } from "@/config/navigation"
import { getGroupIcon } from "./types/icons"
import { NavRowContent, RowChevron } from "./NavRow"
import { navRowClass } from "./types/styles"

type Props = {
  activeGroupId?: string
  onOpen: (groupId: string) => void
}

export function GroupList({ activeGroupId, onOpen }: Props) {
  return (
    <ul className="flex flex-col gap-0.5">
      {navGroups.map((group) => (
        <li key={group.id}>
          <button
            type="button"
            onClick={() => onOpen(group.id)}
            className={navRowClass(group.id === activeGroupId)}
          >
            <NavRowContent icon={getGroupIcon(group.id)} trailing={<RowChevron />}>
              {group.title}
            </NavRowContent>
          </button>
        </li>
      ))}
    </ul>
  )
}
