---
description: "Use when creating or changing application files, React components, hooks, API adapters, types, domain helpers, or server modules. Defines feature-first folders and separation of concerns."
applyTo:
  - "src/**/*.ts"
  - "src/**/*.tsx"
  - "src/**/*.js"
  - "src/**/*.jsx"
  - "e2e/**/*.ts"
  - "prisma/**/*.ts"
  - "prisma/**/*.prisma"
---

# Struktur Kode dan Separation of Concerns

Ikuti [Panduan Struktur dan Pemisahan Tanggung Jawab Kode](../../docs/STRUKTUR-KODE.md) sebelum menambah atau memindahkan source file.

- Kelompokkan kode berdasarkan feature/domain; jangan menambah folder global yang mencampur banyak domain.
- Pisahkan UI, hook/state, API transport, tipe kontrak, helper murni, dan server use case berdasarkan tanggung jawab aktual.
- Beri file source buatan aplikasi—termasuk setiap file komponen React custom—nama PascalCase berbahasa Indonesia yang ringkas dan sesuai tanggung jawab, idealnya sesuai nama komponen utamanya (contoh: `BlokLokasi.tsx`, `VerifikasiLapangan.tsx`, bukan `blok-lokasi.tsx`). Pertahankan istilah domain/singkatan yang mapan, nama simbol TypeScript/React idiomatik, dan nama file framework/tool yang diwajibkan seperti `page.tsx` atau `route.ts`; jangan menerjemahkan nama API/ekspor eksternal.
- Di `src/app`, jangan mengganti nama file konvensi Next.js `page.tsx`/`layout.tsx`; beri default component nama PascalCase yang deskriptif seperti `DashboardPage`, bukan `Page`. Export metadata harus bernama lowercase `metadata` atau `generateMetadata`; import tipe hanya dari API publik `next` (`import type { Metadata } from "next"`), bukan jalur internal.
- Modularisasikan sesuai relevansi dan kompleksitas: pisahkan tanggung jawab yang memang mandiri, tetapi jangan memecah komponen sederhana menjadi banyak file kecil atau membuat abstraksi berlebihan.
- Untuk UI dan ikon, utamakan komponen shadcn/ui, HugeIcons, dan library UI lain yang sudah terpasang serta digunakan project. Periksa `package.json`, `src/components/ui`, ekspor yang tersedia, dan pola pemakaian lokal sebelum coding; jangan mengarang nama/API library atau komponen.
- Jangan membuat ulang primitive UI, menambah komponen bersama, atau menambah dependency UI bila yang tersedia sudah cukup. Komponen komposisi khusus feature boleh dibuat bila memang relevan dan menghindari file yang terlalu besar. Jika perlu primitive UI atau dependency baru yang belum diminta, jelaskan alternatif dan minta izin terlebih dahulu.
- Jangan membuat folder/file kosong untuk memenuhi template; hindari abstraksi generik dan duplikasi.
- Jaga arah dependensi, boundary server/client Next.js, validasi runtime, serta behavior saat refactor.
- Cari semua pemakai sebelum memindahkan simbol/file; pertahankan public entry point bila dipakai dari luar feature.
- Ikuti struktur Info Pelanggan yang didokumentasikan sebagai contoh migrasi bertahap; jangan meniru lokasi lama sebagai pola untuk feature baru.
- Baca panduan Next.js yang terpasang di `node_modules/next/dist/docs/` sebelum mengubah file/framework boundary Next.js.
