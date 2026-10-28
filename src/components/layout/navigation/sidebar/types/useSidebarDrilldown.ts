// components/layout/navigation/sidebar/useSidebarDrilldown.ts
// Seluruh state sidebar: grup mana yang terbuka, arah animasi, halaman aktif.
// Komponen tampilan tidak perlu tahu cara kerjanya.

"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { findActiveNav, navGroups } from "@/config/navigation"
import type { ActiveInfo, Direction } from "./types"

export function useSidebarDrilldown() {
  const pathname = usePathname()
  const found = findActiveNav(pathname)
  const activeGroupId = found?.group.id
  const activeItem = found?.item
  const activeTrail = found?.trail

  const active = React.useMemo<ActiveInfo>(
    () => ({ item: activeItem, trail: activeTrail ?? [] }),
    [activeItem, activeTrail],
  )

  // null = tampilan root (daftar grup). Selain itu = id grup yang dibuka.
  const [openGroupId, setOpenGroupId] = React.useState<string | null>(
    activeGroupId ?? null,
  )
  const [direction, setDirection] = React.useState<Direction>("forward")

  // Sinkronisasi saat pengguna pindah ke grup lain (link / Ctrl+K).
  // Dilakukan saat render (bukan di useEffect) supaya tidak memicu render
  // berantai dan lolos aturan react-hooks/set-state-in-effect.
  const [prevActiveGroupId, setPrevActiveGroupId] = React.useState(activeGroupId)
  if (activeGroupId !== prevActiveGroupId) {
    setPrevActiveGroupId(activeGroupId)
    if (activeGroupId) {
      setDirection("forward")
      setOpenGroupId(activeGroupId)
    }
  }

  const openGroup = React.useCallback((groupId: string) => {
    setDirection("forward")
    setOpenGroupId(groupId)
  }, [])

  const backToRoot = React.useCallback(() => {
    setDirection("back")
    setOpenGroupId(null)
  }, [])

  const currentGroup = openGroupId
    ? navGroups.find((group) => group.id === openGroupId)
    : undefined

  return { active, activeGroupId, currentGroup, direction, openGroup, backToRoot }
}
