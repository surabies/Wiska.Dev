"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ComputerIcon,
  HelpCircleIcon,
  Home07Icon,
  Logout01Icon,
  MoonIcon,
  SettingsIcon,
  SunIcon,
  DashboardSquare01Icon,
} from "@hugeicons/core-free-icons"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function inisial(nama: string | null, email: string): string {
  const sumber = nama?.trim() || email
  const kata = sumber.split(/[\s@.]+/).filter(Boolean)
  return (kata[0]?.[0] ?? "?").concat(kata[1]?.[0] ?? "").toUpperCase()
}

export function UserMenu({
  nama,
  email,
  role,
  image,
  onKeluar,
}: {
  nama: string | null
  email: string
  role: string
  image: string | null
  onKeluar: () => Promise<void>
}) {
  const { theme, setTheme } = useTheme()
  const tema = theme ?? "system"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Menu akun"
        >
          <Avatar className="size-8">
            {image && <AvatarImage src={image} alt="" />}
            <AvatarFallback className="text-xs font-medium">
              {inisial(nama, email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-72.5 min-w-72.5 rounded-xl border border-border bg-popover p-1.5 shadow-lg ring-1 ring-black/5"
      >
        <DropdownMenuLabel className="flex min-h-16 items-center gap-3 rounded-lg px-2 py-2 font-normal">
          <Avatar className="size-9 ring-1 ring-border">
            {image && <AvatarImage src={image} alt="" />}
            <AvatarFallback className="text-xs font-medium">
              {inisial(nama, email)}
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="truncate text-sm font-medium text-foreground">
              {nama?.trim() || email}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
              {email}
            </span>
            <span className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              {role.replaceAll("_", " ")}
            </span>
          </span>
          {role === "SUPER_ADMIN" && (
            <DropdownMenuItem
              asChild
              className="size-8 shrink-0 justify-center rounded-md p-0 text-muted-foreground"
            >
              <Link
                href="/admin/pengaturan"
                aria-label="Pengaturan"
                title="Pengaturan"
              >
                <HugeiconsIcon
                  icon={SettingsIcon}
                  strokeWidth={2}
                  className="size-4.5"
                />
              </Link>
            </DropdownMenuItem>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1.5" />
        <div className="flex h-10 items-center justify-between gap-2 px-2">
          <span className="text-[13px]">Tema</span>
          <div
            role="radiogroup"
            aria-label="Pilih tema"
            className="flex h-7.5 items-center gap-0.5 rounded-lg border border-border bg-muted/40 p-0.5"
          >
            {[
              { value: "light", label: "Terang", icon: SunIcon },
              { value: "system", label: "Sistem", icon: ComputerIcon },
              { value: "dark", label: "Gelap", icon: MoonIcon },
            ].map(({ value, label, icon }) => (
              <button
                key={value}
                type="button"
                aria-label={`Tema ${label.toLowerCase()}`}
                role="radio"
                aria-checked={tema === value}
                title={label}
                onClick={() => setTheme(value)}
                className={`inline-flex size-6 items-center justify-center rounded-md transition-colors ${
                  tema === value
                    ? "bg-background text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.12)] ring-1 ring-border/70"
                    : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                }`}
              >
                <HugeiconsIcon
                  icon={icon}
                  strokeWidth={2}
                  className="size-3.75"
                />
              </button>
            ))}
          </div>
        </div>
        <DropdownMenuSeparator className="my-1.5" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            asChild
            className="h-8 justify-between px-2 text-[13px] font-normal"
          >
            <Link href="/dashboard">
              Dashboard
              <HugeiconsIcon
                icon={DashboardSquare01Icon}
                strokeWidth={2}
                className="size-4.25 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className="h-8 justify-between px-2 text-[13px] font-normal"
          >
            <Link href="/">
              Beranda publik
              <HugeiconsIcon
                icon={Home07Icon}
                strokeWidth={2}
                className="size-4.25 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem
            asChild
            className="h-8 justify-between px-2 text-[13px] font-normal"
          >
            <Link href="/bantuan">
              Bantuan
              <HugeiconsIcon
                icon={HelpCircleIcon}
                strokeWidth={2}
                className="size-4.25 text-muted-foreground"
                aria-hidden="true"
              />
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator className="my-1.5" />
        <form action={onKeluar}>
          <DropdownMenuItem
            asChild
            className="h-8 justify-between px-2 text-[13px] font-normal text-destructive focus:text-destructive"
          >
            <button type="submit" className="w-full">
              Keluar
              <HugeiconsIcon
                icon={Logout01Icon}
                strokeWidth={2}
                className="size-4.25"
                aria-hidden="true"
              />
            </button>
          </DropdownMenuItem>
        </form>
        <div className="mt-1 flex h-9 items-center justify-between border-t border-border px-2 text-xs text-info">
          <span>Akun aktif</span>
          <span
            aria-hidden="true"
            className="size-2 rounded-full bg-info"
          />
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
