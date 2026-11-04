import Link from "next/link"

import { PillButton } from "@/components/shared/PillButton"
import { appStoreLinks } from "@/config/site"
import { getLinkProps } from "@/lib/links"
import { cn } from "@/lib/utils"

interface AppStoreButtonsProps {
  className?: string
  buttonClassName?: string
}

export function AppStoreButtons({
  className,
  buttonClassName,
}: AppStoreButtonsProps) {
  return (
    <div className={cn("flex flex-row", className)}>
      {appStoreLinks.map((store) => (
        <PillButton
          key={store.label}
          asChild
          className={cn(
            "mr-4 border-store-button bg-store-button px-4 py-2 last:mr-0 hover:bg-store-button",
            buttonClassName
          )}
        >
          <Link href={store.href} {...getLinkProps(store)}>
            {store.label}
          </Link>
        </PillButton>
      ))}
    </div>
  )
}
