import { ChevronDown } from "lucide-react"
import Link from "next/link"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { currentLanguageLabel, languages } from "@/config/site"
import { cn } from "@/lib/utils"

interface LanguageSwitcherProps {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  return (
    <div className={cn("relative", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="inline-flex cursor-pointer appearance-none items-center bg-transparent p-0 type-caption text-current outline-none data-[state=open]:[&>svg]:rotate-180"
          >
            {currentLanguageLabel}
            <ChevronDown
              size={24}
              className="transition-transform duration-300"
              aria-hidden="true"
            />
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent side="top" align="start" className="min-w-0">
          {languages.map((language) => (
            <DropdownMenuItem key={language.label} asChild>
              <Link href={language.href}>{language.label}</Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
