"use client"

// Navbar PERUMDA Tirtawening. Tata letak & gaya sama dengan versi bergaya nextjs.org:
//   Desktop: [logo] [nama]  [chevron -> menu informasi]   Cek Tagihan  Lapor Meter  Pengaduan  Buka Dasbor
//   Mobile : [logo] [nama]            [Cek Tagihan] [tombol menu bulat]
//            -> menu layar penuh: kolom cari, tautan besar, grup yang bisa dibuka, pemilih tema.
import Image from "next/image"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import type { Dispatch, SetStateAction } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  ArrowDown01Icon,
  ArrowUpRight01Icon,
  Cancel01Icon,
  Menu01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"

import { FooterTema } from "@/components/landing/footer-tema"
import { BRAND, MENU, NAV, RUTE } from "@/lib/landing/content"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Tahap 1: data. Tautan utama (NAV) dan isi dropdown (MENU) diambil dari
// lib/landing/content.ts. Keduanya sengaja berisi tautan yang berbeda.
// ---------------------------------------------------------------------------
const NAV_INTERNAL = NAV
const NAV_LAIN = [{ label: "Buka Dasbor", href: RUTE.dasbor }] as const

// Tombol aksi cepat di header mobile (padanan tombol "Ask AI" di nextjs.org)
const AKSI_MOBILE = { label: "Cek Tagihan", href: RUTE.cekTagihan } as const

// Semua tautan dalam satu daftar datar: bahan untuk kolom cari di menu mobile
const SEMUA_TAUTAN: { label: string; href: string }[] = [
  ...NAV_INTERNAL,
  ...NAV_LAIN,
  ...MENU.flatMap((k) => k.item.map(({ label, href }) => ({ label, href }))),
]

const fokus =
  "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"

const ID_PANEL_LAYANAN = "panel-menu-layanan"
const ID_PANEL_MOBILE = "panel-menu-mobile"

// Jeda sebelum menu hover menutup (ms). Mencegah flash saat kursor melintas.
const JEDA_TUTUP = 150

// ---------------------------------------------------------------------------
// Tahap 2: potongan kecil (logo, menu dropdown, deteksi scroll).
// ---------------------------------------------------------------------------

// Deteksi scroll lewat useSyncExternalStore: benar sejak render pertama,
// termasuk saat halaman di-refresh dalam keadaan sudah ter-scroll.
function langgananScroll(onChange: () => void) {
  window.addEventListener("scroll", onChange, { passive: true })
  return () => window.removeEventListener("scroll", onChange)
}
const sudahScroll = () => window.scrollY > 0
const sudahScrollServer = () => false

function Logo() {
  // Logo PNG dari public/ + nama perusahaan sebagai wordmark.
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2.5 rounded-md text-base font-semibold tracking-tight text-foreground",
        fokus,
      )}
    >
      <Image src={BRAND.logo} alt="" width={32} height={32} priority unoptimized className="size-8 object-contain" />
      {BRAND.nama}
    </Link>
  )
}

// State buka/tutup dipegang SiteNavbar (diangkat ke atas) supaya header bisa
// menyembunyikan border-nya saat menu terbuka.
function MenuProduk({
  terbuka,
  setTerbuka,
}: {
  terbuka: boolean
  setTerbuka: Dispatch<SetStateAction<boolean>>
}) {
  const wadah = useRef<HTMLDivElement>(null)
  // Jenis pointer terakhir yang menekan tombol (mouse / touch / pen).
  const tipePointer = useRef<string>("mouse")
  // Timer penutupan tertunda untuk hover.
  const timerTutup = useRef<ReturnType<typeof setTimeout> | null>(null)

  const batalkanTutup = useCallback(() => {
    if (timerTutup.current) {
      clearTimeout(timerTutup.current)
      timerTutup.current = null
    }
  }, [])

  const bukaSegera = useCallback(() => {
    batalkanTutup()
    setTerbuka(true)
  }, [batalkanTutup, setTerbuka])

  const tutupSegera = useCallback(() => {
    batalkanTutup()
    setTerbuka(false)
  }, [batalkanTutup, setTerbuka])

  const tutupTertunda = useCallback(() => {
    batalkanTutup()
    timerTutup.current = setTimeout(() => {
      timerTutup.current = null
      setTerbuka(false)
    }, JEDA_TUTUP)
  }, [batalkanTutup, setTerbuka])

  // Bersihkan timer saat komponen dilepas.
  useEffect(() => batalkanTutup, [batalkanTutup])

  // Tahap 2a: tutup dengan Escape atau klik di luar.
  useEffect(() => {
    if (!terbuka) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && tutupSegera()
    const onKlik = (e: MouseEvent) => {
      if (!wadah.current?.contains(e.target as Node)) tutupSegera()
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onKlik)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("mousedown", onKlik)
    }
  }, [terbuka, tutupSegera])

  return (
    // Tahap 2b: buka saat hover (hanya mouse) maupun klik/keyboard.
    // Panel adalah anak wadah ini, jadi kursor di panel tetap dihitung "di dalam".
    <div
      ref={wadah}
      className="relative flex h-full items-center"
      onPointerEnter={(e) => e.pointerType === "mouse" && bukaSegera()}
      onPointerLeave={(e) => e.pointerType === "mouse" && tutupTertunda()}
    >
      <button
        type="button"
        aria-label="Buka menu informasi"
        aria-expanded={terbuka}
        aria-controls={ID_PANEL_LAYANAN}
        onPointerDown={(e) => {
          tipePointer.current = e.pointerType
        }}
        onClick={(e) => {
          // Klik mouse (detail > 0): hover sudah membuka menu, jadi cukup pastikan
          // tetap terbuka. Keyboard (detail = 0) dan sentuh: toggle seperti biasa.
          if (e.detail > 0 && tipePointer.current === "mouse") bukaSegera()
          else setTerbuka((v) => !v)
        }}
        className={cn(
          "flex h-full w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground",
          fokus,
        )}
      >
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          size={14}
          aria-hidden
          className={cn("transition-transform duration-200", terbuka && "rotate-180")}
        />
      </button>

      {/* Tahap 2c: panel selebar layar. top-[63px] = tinggi navbar (64px) dikurangi border 1px,
          dan `before:` adalah jembatan tak terlihat yang menutup celah dengan area hover. */}
      {terbuka && (
        <div
          id={ID_PANEL_LAYANAN}
          className="fixed inset-x-0 top-16 z-30 border-b bg-background"
        >
          <div className="mx-auto flex w-full max-w-362 gap-x-10 px-6 pt-4 pb-8">
            {MENU.map((kelompok) => (
              <div key={kelompok.judul} className="min-w-55 shrink-0">
                {/* Judul kolom: kecil & abu-abu, jelas berbeda dari tautan di bawahnya. */}
                <p className="text-sm text-muted-foreground">{kelompok.judul}</p>
                <ul className="mt-2 flex flex-col">
                  {kelompok.item.map((t) => (
                    <li key={`${kelompok.judul}-${t.href}`}>
                      {t.deskripsi ? (
                        // Kartu untuk info terbaru (punya deskripsi).
                        <Link
                          href={t.href}
                          onClick={tutupSegera}
                          className={cn(
                            "block w-55 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/30",
                            fokus,
                          )}
                        >
                          <span className="block text-base font-medium text-foreground">{t.label}</span>
                          <span className="mt-2 block text-sm text-muted-foreground">{t.deskripsi}</span>
                        </Link>
                      ) : (
                        // Tautan: besar & hitam pekat; hover hanya memunculkan garis bawah.
                        <Link
                          href={t.href}
                          onClick={tutupSegera}
                          className={cn(
                            "block w-fit rounded-sm py-1 text-xl leading-7 tracking-tight text-foreground underline decoration-transparent decoration-1 underline-offset-[6px] transition-colors hover:decoration-foreground/50 focus-visible:decoration-foreground/50",
                            fokus,
                          )}
                        >
                          {t.label}
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tahap 3: menu mobile layar penuh (meniru menu mobile nextjs.org).
// Isi: kolom cari -> tautan besar -> grup yang bisa dibuka -> pemilih tema.
// Komponen ini hanya dirender saat menu terbuka, jadi isian cari dan grup yang
// terbuka otomatis kembali kosong setiap menu dibuka ulang.
// ---------------------------------------------------------------------------

// Satu baris tautan besar (24px). Panah ↗ dipakai untuk tujuan di luar alur pelanggan (dasbor).
const barisBesar =
  "flex w-fit items-center gap-1.5 rounded-sm py-2.5 text-2xl leading-6 tracking-tight text-foreground/80 transition-colors hover:text-foreground"

function PanelMobile({ onTutup }: { onTutup: () => void }) {
  const [kata, setKata] = useState("")
  const [grupTerbuka, setGrupTerbuka] = useState<string | null>(null)
  const q = kata.trim().toLowerCase()

  // Saat mengetik: tampilkan hasil sebagai daftar datar. Saat kosong: tampilan normal.
  const hasil = q ? SEMUA_TAUTAN.filter((t) => t.label.toLowerCase().includes(q)) : []

  return (
    <nav
      id={ID_PANEL_MOBILE}
      aria-label="Navigasi seluler"
      // Layar penuh di bawah header (header sudah sticky = posisi acuan), dengan latar sama seperti header
      className="absolute inset-x-0 top-full h-[calc(100dvh-4rem)] overflow-y-auto bg-background px-4 pt-3 pb-10 lg:hidden"
    >
      {/* TAHAP 3a — Kolom cari: 36px, border tipis, ikon kaca pembesar di kanan (ganti hint ⌘K) */}
      <div className="flex h-9 items-center rounded-md border border-border bg-background px-3 transition-shadow focus-within:border-foreground/40 focus-within:ring-2 focus-within:ring-ring/30">
        <input
          type="search"
          value={kata}
          onChange={(e) => setKata(e.target.value)}
          placeholder="Cari layanan…"
          aria-label="Cari layanan"
          autoComplete="off"
          className="h-full min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground max-[480px]:text-base [&::-webkit-search-cancel-button]:hidden"
        />
        {kata ? (
          <button
            type="button"
            aria-label="Hapus pencarian"
            onClick={() => setKata("")}
            className="flex size-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={14} aria-hidden />
          </button>
        ) : (
          <HugeiconsIcon icon={Search01Icon} size={16} aria-hidden className="text-muted-foreground" />
        )}
      </div>

      {q ? (
        // TAHAP 3b — Hasil pencarian
        <ul className="mt-5 flex flex-col" aria-live="polite">
          {hasil.length ? (
            hasil.map((t) => (
              <li key={`${t.label}-${t.href}`}>
                <Link href={t.href} onClick={onTutup} className={cn(barisBesar, fokus)}>
                  {t.label}
                </Link>
              </li>
            ))
          ) : (
            <li className="py-2.5 text-base text-muted-foreground">Tidak ada hasil untuk “{kata.trim()}”.</li>
          )}
        </ul>
      ) : (
        <>
          {/* TAHAP 3c — Tautan utama: besar, abu tua; "Buka Dasbor" diberi panah ↗ */}
          <ul className="mt-5 flex flex-col">
            {NAV_INTERNAL.map((n) => (
              <li key={n.href}>
                <Link href={n.href} onClick={onTutup} className={cn(barisBesar, fokus)}>
                  {n.label}
                </Link>
              </li>
            ))}
            {NAV_LAIN.map((n) => (
              <li key={n.href}>
                <Link href={n.href} onClick={onTutup} className={cn(barisBesar, fokus)}>
                  {n.label}
                  <HugeiconsIcon icon={ArrowUpRight01Icon} size={18} aria-hidden className="mt-0.5" />
                </Link>
              </li>
            ))}

            {/*
              TAHAP 3d — Grup yang bisa dibuka (padanan baris "Vercel OSS ⌄").
              Judul di kiri, chevron di ujung kanan yang berputar saat terbuka.
              Isi dibuka dengan transisi tinggi (grid-rows 0fr → 1fr); saat tertutup
              dibuat "inert" agar tautan di dalamnya tidak bisa difokus keyboard.
            */}
            {MENU.map((k) => {
              const buka = grupTerbuka === k.judul
              const idIsi = `isi-grup-${k.judul.replace(/\s+/g, "-").toLowerCase()}`
              return (
                <li key={k.judul}>
                  <button
                    type="button"
                    aria-expanded={buka}
                    aria-controls={idIsi}
                    onClick={() => setGrupTerbuka(buka ? null : k.judul)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-sm py-2.5 text-left text-2xl leading-6 tracking-tight text-foreground/80 transition-colors hover:text-foreground",
                      fokus,
                    )}
                  >
                    {k.judul}
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      size={20}
                      aria-hidden
                      className={cn("transition-transform duration-200", buka && "rotate-180")}
                    />
                  </button>
                  <div
                    id={idIsi}
                    inert={!buka}
                    className={cn(
                      "grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none",
                      buka ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <ul className="flex flex-col overflow-hidden">
                      {k.item.map((t) => (
                        <li key={`${k.judul}-${t.href}`}>
                          <Link href={t.href} onClick={onTutup} className={cn("block rounded-sm py-2", fokus)}>
                            <span className="block text-lg tracking-tight text-foreground/80">{t.label}</span>
                            {t.deskripsi ? (
                              <span className="mt-0.5 block text-sm text-muted-foreground">{t.deskripsi}</span>
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* TAHAP 3e — Pemilih tema di kanan, di bawah daftar */}
          <div className="mt-6 flex justify-end">
            <FooterTema />
          </div>
        </>
      )}
    </nav>
  )
}

// ---------------------------------------------------------------------------
// Tahap 4: navbar utama.
// ---------------------------------------------------------------------------
export function SiteNavbar() {
  const pathname = usePathname()
  // Menu mobile dianggap terbuka hanya jika dibuka di halaman yang sedang
  // aktif. Pindah halaman otomatis menutupnya, tanpa useEffect + setState.
  const [terbukaDi, setTerbukaDi] = useState<string | null>(null)
  const mobileTerbuka = terbukaDi === pathname

  // Menu dropdown (desktop) dipegang di sini agar border header bisa ikut berubah.
  const [layananTerbuka, setLayananTerbuka] = useState(false)

  const tergulir = useSyncExternalStore(langgananScroll, sudahScroll, sudahScrollServer)

  const aktif = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  // Saat salah satu menu terbuka, border header dihilangkan supaya menyatu dengan panel.
  const menuTerbuka = layananTerbuka || mobileTerbuka

  // Menu mobile terbuka: tutup dengan Escape dan kunci scroll halaman di belakangnya.
  useEffect(() => {
    if (!mobileTerbuka) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setTerbukaDi(null)
    document.addEventListener("keydown", onKey)
    const overflowAwal = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = overflowAwal
    }
  }, [mobileTerbuka])

  return (
    // Garis bawah tipis muncul saat halaman di-scroll (tanpa shadow, seperti nextjs.org),
    // dan hilang saat menu terbuka.
    <header
      className={cn(
        "sticky top-0 z-40 flex h-16 justify-center border-b bg-background transition-colors motion-reduce:transition-none",
        tergulir && !menuTerbuka ? "border-border" : "border-transparent",
      )}
    >
      {/* px-4 di mobile agar sejajar dengan isi menu mobile; px-2 di desktop seperti semula */}
      <div className="mx-auto flex w-full max-w-362 justify-between px-4 lg:px-2">
        {/* Kiri: logo / nama / menu dropdown (hanya di desktop) */}
        <div className="flex h-full min-w-0 select-none flex-row items-center">
          <Logo />
          <div className="hidden h-full items-center lg:flex">
            <MenuProduk terbuka={layananTerbuka} setTerbuka={setLayananTerbuka} />
          </div>
        </div>

        {/* Kanan (desktop): tautan utama */}
        <nav aria-label="Navigasi utama" className="hidden h-full lg:block">
          <ul className="flex h-full items-stretch">
            {NAV_INTERNAL.map((n) => (
              <li key={n.href} className="flex">
                <Link
                  href={n.href}
                  aria-current={aktif(n.href) ? "page" : undefined}
                  className={cn(
                    "flex h-full items-center px-3 text-sm text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground",
                    fokus,
                  )}
                >
                  {n.label}
                </Link>
              </li>
            ))}
            {NAV_LAIN.map((n) => (
              <li key={n.href} className="flex">
                <Link
                  href={n.href}
                  className={cn(
                    "flex h-full items-center gap-1 px-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
                    fokus,
                  )}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/*
          Kanan (mobile): tombol aksi cepat + tombol menu bulat (ikon berganti menu ↔ silang).
          Tombol aksi disembunyikan di layar sangat sempit (<380px) agar nama perusahaan tidak terpotong.
        */}
        <div className="flex shrink-0 items-center gap-2 self-center lg:hidden">
          <Link
            href={AKSI_MOBILE.href}
            className="hidden h-8 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted min-[380px]:inline-flex focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {AKSI_MOBILE.label}
          </Link>
          <button
            type="button"
            aria-label={mobileTerbuka ? "Tutup menu" : "Buka menu"}
            aria-expanded={mobileTerbuka}
            aria-controls={ID_PANEL_MOBILE}
            onClick={() => setTerbukaDi(mobileTerbuka ? null : pathname)}
            className="flex size-8 items-center justify-center rounded-full border border-border bg-background text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <HugeiconsIcon icon={mobileTerbuka ? Cancel01Icon : Menu01Icon} size={16} aria-hidden />
          </button>
        </div>
      </div>

      {mobileTerbuka && <PanelMobile onTutup={() => setTerbukaDi(null)} />}
    </header>
  )
}