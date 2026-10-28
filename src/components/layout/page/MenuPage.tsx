// src/components/layout/page/MenuPage.tsx
//
// Halaman TEMPLATE untuk menu yang modulnya belum dibangun.
// Satu komponen ini dipakai banyak route: cukup kirim `href` menu-nya, judul
// dan breadcrumb diambil otomatis dari `config/navigation.ts`.
//
// Contoh pemakaian (app/(dashboard)/jaringan/aset/page.tsx):
//
//   export default function Page() {
//     return <MenuPage href="/jaringan/aset" />
//   }
//
// Jika `href` tidak terdaftar di menu, akan tampil halaman 404.
//
// Saat modul sudah siap, JANGAN edit file ini. Buat halaman sungguhan di
// route-nya dan ganti pemakaian <MenuPage /> di route tersebut.

import { notFound } from "next/navigation"

import { findNavItem, getNavGroupHref } from "@/config/navigation"
import { PageContainer } from "./PageContainer"

// Label kartu ringkasan placeholder. Ubah di sini jika ingin mengganti isi.
const SUMMARY_LABELS = ["Total", "Hari ini", "Menunggu tindakan"] as const

export function MenuPage({ href }: { href: string }) {
  const found = findNavItem(href)
  if (!found) notFound() // notFound() bertipe `never`, jadi `found` aman di bawah

  // group : Direktorat tempat halaman berada
  // item  : halaman yang sedang dibuka
  // trail : (opsional) folder induk, mis. [Master & Pengolahan Data, ...]
  const { group, item } = found

  return (
    <PageContainer
      breadcrumbs={[
        // Level 1: Direktorat -> mengarah ke halaman pertama di dalamnya.
        // (Untuk menampilkan folder induk, sisipkan `found.trail` di sini.)
        { label: group.title, href: getNavGroupHref(group) },
        // Level terakhir: halaman aktif (tanpa href).
        { label: item.title },
      ]}
    >
      {/* Banner status pengembangan */}
      <div className="mb-6 border border-dashed border-sky-300/60 bg-sky-400/10 p-4 text-sm/6 text-sky-900 sm:mb-8 sm:p-5 dark:border-sky-300/30 dark:text-sky-200">
        <p className="font-medium">Halaman dalam tahap pengembangan</p>
        <p className="mt-1">
          Kerangka modul sudah tersedia. Konten dan integrasi data akan
          ditambahkan pada tahap berikutnya.
        </p>
      </div>

      {/* Kartu ringkasan (placeholder; "—" = data belum tersedia) */}
      <section aria-label={`Ringkasan ${item.title}`}>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {SUMMARY_LABELS.map((label) => (
            <div
              key={label}
              className="min-w-0 rounded-lg border bg-card p-4 sm:p-5"
            >
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-medium">&mdash;</p>
            </div>
          ))}
        </div>
      </section>

      {/* Area data (placeholder; ganti dengan tabel/grafik modul) */}
      <section className="mt-5 rounded-lg border bg-card p-4 sm:mt-6 sm:p-5">
        <h2 className="font-medium">Data {item.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Data untuk modul ini akan ditampilkan di sini.
        </p>
        <div
          aria-hidden="true"
          className="mt-4 h-48 rounded-md bg-muted/60 sm:h-64"
        />
      </section>
    </PageContainer>
  )
}