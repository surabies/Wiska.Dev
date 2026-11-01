// components/layout/navigation/sidebar/useIsMac.ts
// Deteksi Mac tanpa setState di effect.
// - server: selalu false (HTML server = HTML awal client, tanpa hydration error)
// - client: dibaca dari userAgent, React render ulang otomatis bila hasilnya beda

"use client"

import * as React from "react"

const subscribe = () => () => {}
const getIsMac = () => /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent)
const getIsMacServer = () => false

export function useIsMac(): boolean {
  return React.useSyncExternalStore(subscribe, getIsMac, getIsMacServer)
}
