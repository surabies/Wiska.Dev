// components/layout/navigation/SidebarNav.tsx
// Sidebar drill-down bergaya Vercel untuk aplikasi pemerintahan.
//
//  Puncak (selalu tampak) : kotak Cari menu (Ctrl/Cmd+K)
//  Tampilan root          : Dashboard / Analytics / Report, lalu daftar grup
//  Tampilan detail        : klik grup -> menu grup itu, baris "‹" untuk kembali
//
// File ini hanya merakit. Isinya ada di folder ./sidebar:
//   useSidebarDrilldown.ts  state & logika
//   SidebarSearch.tsx       kotak cari + shortcut
//   PrimaryNav.tsx          3 menu utama
//   GroupList.tsx           daftar grup
//   GroupDetail.tsx         isi satu grup
//   NavNodeRow.tsx          baris menu / folder
//   NavRow.tsx              isi baris, panah, pemisah
//   icons.ts / styles.ts / utils.ts / types.ts / Slide.tsx / useIsMac.ts

"use client"

import { cn } from "@/lib/utils"
import { GroupDetail } from "./sidebar/GroupDetail"
import { GroupList } from "./sidebar/GroupList"
import { RowSeparator } from "./sidebar/NavRow"
import { PrimaryNav } from "./sidebar/PrimaryNav"
import { SidebarSearch } from "./sidebar/SidebarSearch"
import { Slide } from "./sidebar/Slide"
import { useSidebarDrilldown } from "./sidebar/types/useSidebarDrilldown"

export function SidebarNav({ className }: { className?: string }) {
  const { active, activeGroupId, currentGroup, direction, openGroup, backToRoot } =
    useSidebarDrilldown()

  return (
    <div className={cn("-mt-6 flex flex-col gap-3", className)}>
      <SidebarSearch />

      <nav aria-label="Menu utama" className="overflow-hidden">
        {currentGroup ? (
          <Slide key={currentGroup.id} direction={direction}>
            <GroupDetail group={currentGroup} active={active} onBack={backToRoot} />
          </Slide>
        ) : (
          <Slide key="root" direction={direction}>
            <PrimaryNav />
            <RowSeparator />
            <GroupList activeGroupId={activeGroupId} onOpen={openGroup} />
          </Slide>
        )}
      </nav>
    </div>
  )
}