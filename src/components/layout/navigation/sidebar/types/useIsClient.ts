// components/layout/navigation/sidebar/useIsClient.ts
// true hanya di browser (false saat render server). Dipakai agar createPortal
// (butuh `document`) tidak dijalankan di server dan tidak memicu hydration error.

"use client"

import * as React from "react"

const subscribe = () => () => {}
const getClient = () => true
const getServer = () => false

export function useIsClient(): boolean {
  return React.useSyncExternalStore(subscribe, getClient, getServer)
}