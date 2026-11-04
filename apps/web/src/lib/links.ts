import type { NavLink } from "@/types/site"

/** Atribut aman untuk link eksternal (tab baru + noopener). */
export function getLinkProps({ external }: Pick<NavLink, "external">) {
  return external
    ? ({ target: "_blank", rel: "noopener noreferrer" } as const)
    : {}
}
