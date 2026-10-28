// components/layout/navigation/sidebar/utils.ts

import { isNavFolder, type NavItem, type NavNode } from "@/config/navigation"

/** Menu yang deskripsinya memuat kata "pending" ditandai badge "Segera". */
export function isPending(item: NavItem): boolean {
  return item.description.toLowerCase().includes("pending")
}

/** Key React yang stabil untuk daftar node (folder atau halaman). */
export function nodeKey(node: NavNode, index: number): string {
  return `${index}-${isNavFolder(node) ? "folder" : node.href}-${node.title}`
}

/** Menu utama aktif bila URL sama persis atau berada di bawahnya. */
export function isPrimaryActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}
