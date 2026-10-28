// lib/search-data.ts
// Tugas: sumber data pencarian (Ctrl+K). Dibangun dari config/navigation.ts,
// jadi menu baru otomatis bisa dicari.
import { navGroups, type NavItem } from "@/config/navigation"

export type SearchResult = { page: string; title: string; href: string }
export type SearchGroup = { category: string; results: SearchResult[] }

export function searchDocs(query: string): SearchGroup[] {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return []

  const groups: SearchGroup[] = []

  for (const group of navGroups) {
    // Support both NavGroup variants: { id, items } and { title, children }
    // Hanya grup yang punya `items` (bukan sub-grup tanpa id) yang dicari.
    const items = "items" in group ? group.items : []

    const pageResults: SearchResult[] = items
      .filter((entry): entry is NavItem =>
        "href" in entry && entry.href !== undefined,
      )
      .map((item) => ({
        page: item.title,
        title: item.description!,
        href: item.href,
      }))

    if (pageResults.length > 0) groups.push({ category: group.title, results: pageResults })
  }

  return groups
}
