// src/config/navigation.ts
//
// ============================================================================
//  KONFIGURASI MENU APLIKASI — satu-satunya sumber data menu
// ============================================================================
// Dibaca oleh: navbar, sidebar, pencarian (Ctrl+K), breadcrumb, dan halaman
// template <MenuPage />. Menambah / mengubah / menghapus menu CUKUP di file ini.
//
// DAFTAR ISI
//   1. Tipe data ........ bentuk struktur menu
//   2. Data menu ........ `navGroups`  <-- EDIT DI SINI untuk ubah menu
//   3. Data turunan ..... index & daftar datar (dihitung otomatis)
//   4. Fungsi pencarian . findNavItem, findActiveNav, getNavGroupHref, ...
//   5. Konstanta lain ... navbarLinks, mobileMenuLinks, versions
//
// STRUKTUR ORGANISASI (sesuai organisasi.md):
//   Kuasa Pemilik Modal (KPM) & Dewan Pengawas  <- governance eksternal, TIDAK
//                                                  ditampilkan di sidebar
//   ├── Direktorat Utama
//   ├── Direktorat Teknik
//   ├── Direktorat Pelayanan
//   └── Direktorat Umum
//
// ATURAN PENTING (supaya tidak error lagi):
//   - Jangan mendeklarasikan `navGroups` / `allNavItems` lebih dari sekali.
//   - Data turunan (bagian 3) HARUS berada SETELAH `navGroups`, karena `const`
//     tidak bisa dipakai sebelum dideklarasikan.
// ============================================================================

// ----------------------------------------------------------------------------
// 1. TIPE DATA
// ----------------------------------------------------------------------------
// Hirarki tiga jenis node. Perbedaannya mudah dikenali dari properti kuncinya:
//
//   NavGroup   punya `items`     -> Direktorat (level paling atas, selalu `id`)
//   NavFolder  punya `children`  -> sub-menu / folder, TIDAK punya `href`.
//                                   Boleh bersarang ke folder lain.
//   NavItem    punya `href`      -> halaman nyata (daun / ujung hirarki)
//
//   NavGroup
//    └─ NavFolder | NavItem
//        └─ NavFolder | NavItem   (dst., rekursif lewat `children`)

/** Halaman menu (daun). Selalu punya `href`. */
export type NavItem = {
  title: string
  href: string
  description: string
  /** Kata kunci tambahan agar halaman ditemukan di pencarian Ctrl+K. */
  keywords?: string[]
}

/** Sub-menu / folder. Hanya menyusun anak, tidak punya `href`. */
export type NavFolder = {
  title: string
  description?: string
  keywords?: string[]
  children: NavNode[]
}

/** Anak dari sebuah grup atau folder: bisa halaman, bisa folder lagi. */
export type NavNode = NavItem | NavFolder

/** Grup puncak = satu Direktorat. */
export type NavGroup = {
  /** Slug unik, dipakai sebagai key & anchor (mis. "teknik"). */
  id: string
  title: string
  items: NavNode[]
}

/**
 * Satu baris di index datar: sebuah halaman beserta konteksnya.
 *  - group : Direktorat tempat halaman berada
 *  - item  : halaman itu sendiri
 *  - trail : rantai folder dari atas ke bawah (kosong jika item langsung di
 *            bawah grup). Berguna untuk breadcrumb bertingkat.
 */
export type NavEntry = {
  group: NavGroup
  item: NavItem
  trail: NavFolder[]
}

/** Type guard: true jika node adalah folder (punya `children`). */
export function isNavFolder(node: NavNode): node is NavFolder {
  return "children" in node
}

// ----------------------------------------------------------------------------
// 2. DATA MENU
// ----------------------------------------------------------------------------
// CARA MENAMBAH MENU
//   - Halaman baru  : tambahkan objek { title, href, description, keywords? }
//                     ke `items` (grup) atau `children` (folder) yang sesuai.
//   - Folder baru   : tambahkan objek { title, description?, keywords?,
//                     children: [...] } TANPA `href`.
//   - Direktorat    : tambahkan objek { id, title, items: [...] } baru, lalu
//                     (jika perlu) tambahkan link-nya di `navbarLinks`.
//   - Halaman yang belum dibangun: beri description "Belum ada halaman
//     (pending)." supaya mudah dicari saat tahap pengembangan.
// CATATAN: `href` sebaiknya unik di seluruh menu. Cek dengan
//   findDuplicateHrefs() (bagian 4).
//
export const navGroups: NavGroup[] = [
  {
    id: "master",
    title: "Master",
    items: [
      {
        title: "Otorisasi Menu",
        href: "/master/otorisasi",
        description: "Pengelolaan otorisasi akses menu per role.",
        keywords: ["otorisasi", "menu", "hak akses"],
      },
      {
        title: "Kelainan",
        href: "/master/kelainan",
        description: "Daftar kelainan meter, anomali, dan kondisi menyimpang.",
        keywords: ["kelainan", "anomali", "kerusakan"],
      },
      {
        title: "Pengguna",
        href: "/master/pengguna",
        description: "Pengelolaan akun pengguna sistem.",
        keywords: ["user", "akun", "akun pengguna"],
      },
      {
        title: "Petugas",
        href: "/master/petugas",
        description: "Pengelolaan data petugas cater lapangan.",
        keywords: ["petugas", "cater", "staff"],
      },
      {
        title: "Pemetaan Rute",
        href: "/master/urut",
        description: "Menyusun urutan rute baca meter per petugas.",
        keywords: ["rute", "pengurutan", "petugas"],
      },
      {
        title: "Penggabungan Rute",
        href: "/master/gabung",
        description: "Menggabungkan rute baca meter.",
        keywords: ["rute", "penggabungan"],
      },
      {
        title: "Pindah Rute",
        href: "/master/pindah",
        description: "Pindah rute baca meter antar petugas.",
        keywords: ["rute", "pindah", "pindah rute"],
      },
      {
        title: "Pindah Rute Monitoring",
        href: "/master/monitoring",
        description: "Monitoring aktivitas pindah rute.",
        keywords: ["monitoring", "rute"],
      },
    ],
  },
  {
    id: "pengolahan-data",
    title: "Pengolahan Data",
    items: [
      {
        title: "Daftar Pencatatan Meter",
        href: "/verifikasi/baca-petugas",
        description: "Pembacaan meter per wilayah layanan (CHN 1-6).",
        keywords: ["meter", "baca meter", "wilayah", "cater"],
      },
      {
        title: "Baca Meter Pelanggan",
        href: "/verifikasi/baca-pelanggan",
        description: "Verifikasi pembacaan meter oleh pelanggan mandiri.",
        keywords: ["verifikasi", "mandiri", "pembacaan meter"],
      },
      {
        title: "Info Pelanggan",
        href: "/info-pelanggan",
        description: "Data pelanggan, sambungan, golongan.",
        keywords: ["pelanggan", "info", "data pelanggan"],
      },
      {
        title: "Mutasi PBPK",
        href: "/pelanggan/mutasi",
        description: "Mutasi pembayaran dan pemasangan baru.",
        keywords: ["mutasi", "pembayaran", "pemasangan"],
      },
      {
        title: "No HP Pelanggan",
        href: "/pelanggan/no-hp",
        description: "Update nomor HP pelanggan.",
        keywords: ["no hp", "telepon", "pelanggan"],
      },
      {
        title: "Pindah Jenis Pelanggan",
        href: "/pelanggan/jenis",
        description: "Pindah jenis pelanggan (rumah, usaha, dll).",
        keywords: ["pindah", "jenis", "pelanggan"],
      },
      {
        title: "Manual ADD",
        href: "/admin/input-data",
        description: "Input data manual satu item.",
        keywords: ["manual", "input", "data"],
      },
      {
        title: "Manual Add All",
        href: "/admin/import-backup",
        description: "Input data manual banyak item sekaligus.",
        keywords: ["manual", "bulk", "input"],
      },
      {
        title: "Hitung Rata-Rata",
        href: "/meter/hitung-rata-rata",
        description: "Hitung rata-rata stand meter 3 bulan.",
        keywords: ["rata-rata", "hitung", "meter"],
      },
      {
        title: "Cek Foto Petugas",
        href: "/meter/cek-foto",
        description: "Verifikasi foto petugas pada peta.",
        keywords: ["foto", "petugas", "cek"],
      },
    ],
  },
  {
    id: "peta",
    title: "Peta",
    items: [
      {
        title: "Peta Wilayah",
        href: "/peta-wilayah",
        description: "Peta wilayah layanan dan distribusi.",
        keywords: ["peta", "wilayah", "distribusi"],
      },
    ],
  },
  {
    id: "progres",
    title: "Progres",
    items: [
      {
        title: "Grafik Pelanggan",
        href: "/laporan",
        description: "Grafik perkembangan jumlah pelanggan.",
        keywords: ["grafik", "pelanggan", "perkembangan"],
      },
      {
        title: "Progres per Wilayah",
        href: "/laporan/progres-wilayah",
        description: "Tingkat pencatatan harian per wilayah.",
        keywords: ["progres", "wilayah", "cater"],
      },
      {
        title: "Progres Pencatat",
        href: "/progres/pencatat",
        description: "Tingkat pencatatan harian per petugas.",
        keywords: ["progres", "pencatat", "petugas"],
      },
      {
        title: "Presentase Koreksi",
        href: "/laporan/presentase-koreksi",
        description: "Presentase data yang dikoreksi/verifikasi.",
        keywords: ["koreksi", "presentase", "verifikasi"],
      },
      {
        title: "Ikhtisar Pemakaian Ekstrim",
        href: "/laporan/progres-ekstrim",
        description: "Ikhtisar pemakaian ekstrim (lonjakan/penurunan).",
        keywords: ["ekstra", "pemakaian", "ekstrim"],
      },
      {
        title: "Ikhtisar Pemakaian Turun",
        href: "/laporan/progres-turun",
        description: "Ikhtisar tren penurunan pemakaian.",
        keywords: ["turun", "pemakaian", "tren"],
      },
      {
        title: "Ikhtisar Pemakaian 0",
        href: "/laporan/progres-0",
        description: "Ikhtisar pemakaian nol (meter tidak terpasang).",
        keywords: ["pemakaian", "nol", "0"],
      },
      {
        title: "Hasil Foto Petugas",
        href: "/laporan/hasil-foto",
        description: "Koleksi hasil foto meter dari lapangan.",
        keywords: ["foto", "hasil", "petugas"],
      },
    ],
  },
  {
    id: "laporan",
    title: "Laporan",
    items: [
      {
        title: "Laporan DRD",
        href: "/laporan",
        description: "Laporan tagihan DRD (Daftar Tagihan).",
        keywords: ["laporan", "drd", "tagihan"],
      },
      {
        title: "Lap. Mutasi Pel",
        href: "/pelanggan/mutasi",
        description: "Laporan mutasi pelanggan.",
        keywords: ["laporan", "mutasi", "pelanggan"],
      },
      {
        title: "Lap. Mutasi PB-PK",
        href: "/pelanggan/mutasi",
        description: "Laporan mutasi pembayaran dan pemasangan baru.",
        keywords: ["laporan", "mutasi", "pembayaran"],
      },
      {
        title: "Lap. Periode Cater",
        href: "/laporan",
        description: "Laporan periode pencatatan cater.",
        keywords: ["laporan", "periode", "cater"],
      },
      {
        title: "Lap Data Meter",
        href: "/meter",
        description: "Laporan data meter.",
        keywords: ["laporan", "meter", "data meter"],
      },
      {
        title: "Lap Kelainan Meter",
        href: "/admin/log",
        description: "Laporan kelainan meter.",
        keywords: ["laporan", "kelainan", "meter"],
      },
      {
        title: "Lap Evaluasi",
        href: "/laporan",
        description: "Laporan evaluasi sistem.",
        keywords: ["laporan", "evaluasi"],
      },
      {
        title: "Lap Pelanggan",
        href: "/laporan/pelanggan",
        description: "Laporan data pelanggan.",
        keywords: ["laporan", "pelanggan", "data"],
      },
      {
        title: "Lap. Selisih Hari",
        href: "/laporan",
        description: "Laporan selisih hari pembacaan.",
        keywords: ["laporan", "selisih", "hari"],
      },
      {
        title: "Lap Data St. Awal & Akhir",
        href: "/laporan",
        description: "Laporan data stand awal dan akhir.",
        keywords: ["laporan", "stand", "awal", "akhir"],
      },
      {
        title: "Lap Data St. 0 (Nol)",
        href: "/laporan",
        description: "Laporan data stand 0 (meter nol).",
        keywords: ["laporan", "stand", "nol"],
      },
      {
        title: "Lap History",
        href: "/laporan",
        description: "Laporan riwayat perubahan.",
        keywords: ["laporan", "history", "riwayat"],
      },
      {
        title: "Lap Perubahan Pel",
        href: "/pelanggan/mutasi",
        description: "Laporan perubahan data pelanggan.",
        keywords: ["laporan", "perubahan", "pelanggan"],
      },
      {
        title: "Lap. Data dan Foto",
        href: "/laporan",
        description: "Laporan data dan foto meter.",
        keywords: ["laporan", "data", "foto"],
      },
      {
        title: "Lap. Monitoring Kubikasi Koreksi",
        href: "/laporan",
        description: "Laporan monitoring kubikasi dan koreksi.",
        keywords: ["laporan", "monitoring", "kubikasi"],
      },
    ],
  },
  {
    id: "tool-tutup-bulan",
    title: "Tool Tutup Bulan",
    items: [
      {
        title: "PBPK",
        href: "/admin/closing/pbpk",
        description: "Input data pasang baru & kontrak.",
        keywords: ["pbpk", "pasang baru", "kontrak"],
      },
      {
        title: "Stand Angkat",
        href: "/admin/closing/stand-angkat",
        description: "Input stand angkat meter.",
        keywords: ["stand", "angkat", "meter"],
      },
      {
        title: "Update Zonasi",
        href: "/admin/closing/zonasi",
        description: "Pembaruan zona layanan.",
        keywords: ["zonasi", "zona", "pembaruan"],
      },
      {
        title: "Posting Datameter",
        href: "/admin/closing/posting-datameter",
        description: "Posting pembacaan meter ke tagihan.",
        keywords: ["posting", "datameter", "tagihan"],
      },
      {
        title: "Create Closed DRD",
        href: "/admin/closing/closed-drb",
        description: "Membentuk DRD tutup.",
        keywords: ["drb", "closed", "tutup"],
      },
      {
        title: "Create Perbandingan",
        href: "/admin/closing/perbandingan",
        description: "Membuat perbandingan tagihan.",
        keywords: ["perbandingan", "tagihan"],
      },
      {
        title: "Create Bulan Baru",
        href: "/admin/closing/bulan-baru",
        description: "Memulai periode baru.",
        keywords: ["bulan baru", "perioda baru"],
      },
      {
        title: "Upload Master Pelanggan",
        href: "/admin/closing/upload-master",
        description: "Upload master data pelanggan.",
        keywords: ["upload", "pelanggan", "master"],
      },
      {
        title: "Sync Pelanggan Baru",
        href: "/admin/closing/sync-pelanggan",
        description: "Sinkronisasi pelanggan baru.",
        keywords: ["sync", "pelanggan", "baru"],
      },
      {
        title: "Update Data Pelanggan",
        href: "/admin/closing/update-pelanggan",
        description: "Pembaruan data pelanggan.",
        keywords: ["update", "pelanggan", "data"],
      },
      {
        title: "Cek Selisih Pelanggan",
        href: "/admin/closing/selisih-pelanggan",
        description: "Cek selisih data pelanggan.",
        keywords: ["cek", "selisih", "pelanggan"],
      },
      {
        title: "Monitoring Tutup Bulan",
        href: "/admin/closing/monitoring",
        description: "Monitoring status tutup bulan.",
        keywords: ["monitoring", "tutup", "bulan"],
      },
    ],
  },
  {
    id: "tools",
    title: "Tools",
    items: [
      {
        title: "Running Text",
        href: "/tools/running-text",
        description: "Running text system info.",
        keywords: ["running", "text", "info"],
      },
      {
        title: "Import Stand Angkat",
        href: "/tools/import-stand",
        description: "Import data stand angkat.",
        keywords: ["import", "stand", "angkat"],
      },
      {
        title: "Import PBPK",
        href: "/tools/import-pbpk",
        description: "Import data pembayaran dan pemasangan baru.",
        keywords: ["import", "pembayaran", "pemasangan"],
      },
      {
        title: "Proses PBPK",
        href: "/tools/proses-pbpk",
        description: "Proses pemasangan baru & kontrak.",
        keywords: ["proses", "pbpk", "pembayaran"],
      },
      {
        title: "Import Backup",
        href: "/tools/import-backup",
        description: "Import foto backup lapangan.",
        keywords: ["import", "backup", "foto"],
      },
      {
        title: "Import Backup Photo ",
        href: "/tools/import-photo",
        description: "Import foto backup GWM.",
        keywords: ["import", "backup", "foto", "gwm"],
      },
      {
        title: "Import Data SPT",
        href: "/tools/import-spt",
        description: "Import data SPT.",
        keywords: ["import", "spt", "data"],
      },
      {
        title: "Import Data Anomali",
        href: "/tools/import-anomali",
        description: "Import data anomali.",
        keywords: ["import", "anomali"],
      },
      {
        title: "Import Data GWM",
        href: "/tools/import-data",
        description: "Import data GWM.",
        keywords: ["import", "gwm"],
      },
      {
        title: "Import Tutup",
        href: "/tools/import-tutup",
        description: "Import data tutup bulan.",
        keywords: ["import", "tutup", "bulan"],
      },
    ],
  },
  {
    id: "sync-tutup-bulan",
    title: "Sync Tutup Bulan",
    items: [
      {
        title: "Sync (1) KIRIM MUTASI",
        href: "/sync/sync-mutasi",
        description: "Sinkronkan kirim data mutasi.",
        keywords: ["sync", "mutasi", "sinkronisasi"],
      },
      {
        title: "Sync (2) KIRIM DATAMETER",
        href: "/sync/sync-datameter",
        description: "Sinkronkan kirim data meter.",
        keywords: ["sync", "datameter", "meter"],
      },
      {
        title: "Sync (3) IMPORT STI",
        href: "/sync/sync-sti",
        description: "Import STI sinkronisasi.",
        keywords: ["sync", "sti", "import"],
      },
      {
        title: "Sync (4) BULAN BARU",
        href: "/sync/sync-bulan-baru",
        description: "Sinkronkan data bulan baru.",
        keywords: ["sync", "bulan baru"],
      },
    ],
  },
]
// ----------------------------------------------------------------------------
// 3. DATA TURUNAN (dihitung otomatis dari `navGroups` — jangan diisi manual)
// ----------------------------------------------------------------------------

/** Menelusuri node secara rekursif dan mengisi `out` dengan semua halaman. */
function collectEntries(
  group: NavGroup,
  nodes: readonly NavNode[],
  trail: NavFolder[],
  out: NavEntry[],
): void {
  for (const node of nodes) {
    if (isNavFolder(node)) {
      collectEntries(group, node.children, [...trail, node], out)
    } else {
      out.push({ group, item: node, trail })
    }
  }
}

function buildNavIndex(groups: readonly NavGroup[]): NavEntry[] {
  const out: NavEntry[] = []
  for (const group of groups) collectEntries(group, group.items, [], out)
  return out
}

/**
 * Index datar semua halaman + konteksnya (grup & folder induk).
 * Dasar dari findNavItem, findActiveNav, dan allNavItems.
 */
export const navIndex: NavEntry[] = buildNavIndex(navGroups)

/** Daftar datar semua halaman (dipakai pencarian Ctrl+K). */
export const allNavItems: NavItem[] = navIndex.map((entry) => entry.item)

// ----------------------------------------------------------------------------
// 4. FUNGSI PENCARIAN
// ----------------------------------------------------------------------------

/**
 * Meratakan struktur bersarang menjadi daftar halaman.
 * Menerima daftar grup (`navGroups`) maupun daftar node (`group.items`).
 */
export function flattenNavItems(nodes: readonly (NavNode | NavGroup)[]): NavItem[] {
  return nodes.flatMap((node): NavItem[] => {
    if ("items" in node) return flattenNavItems(node.items)
    if (isNavFolder(node)) return flattenNavItems(node.children)
    return [node]
  })
}

/**
 * Cari halaman berdasarkan `href` PERSIS SAMA.
 * Dipakai <MenuPage /> untuk memuat judul & breadcrumb.
 * Jika ada href ganda, yang pertama di urutan menu yang dikembalikan.
 */
export function findNavItem(href: string): NavEntry | undefined {
  return navIndex.find((entry) => entry.item.href === href)
}

/**
 * Tentukan halaman aktif dari alamat URL (untuk highlight sidebar/navbar).
 * Yang dipilih adalah `href` TERPANJANG yang cocok, sehingga
 * "/pelanggan/mutasi" -> "Mutasi", bukan "Data Pelanggan" ("/pelanggan").
 * Cocok jika pathname sama persis atau diawali `href + "/"`.
 */
export function findActiveNav(pathname: string): NavEntry | undefined {
  let best: NavEntry | undefined

  for (const entry of navIndex) {
    const { href } = entry.item
    const isMatch = pathname === href || pathname.startsWith(`${href}/`)
    if (isMatch && (!best || href.length > best.item.href.length)) {
      best = entry
    }
  }

  return best
}

/**
 * Link tujuan sebuah Direktorat = halaman pertama di dalamnya.
 * Dipakai untuk breadcrumb level grup. Fallback "/" hanya jaga-jaga jika
 * grup kosong (secara data seharusnya tidak terjadi).
 */
export function getNavGroupHref(group: NavGroup): string {
  return flattenNavItems(group.items)[0]?.href ?? "/"
}

/**
 * Utilitas pengecekan data: daftar `href` yang muncul lebih dari sekali.
 * Tidak dipanggil otomatis. Contoh pemakaian di dev:
 *   console.warn("href ganda:", findDuplicateHrefs())
 */
export function findDuplicateHrefs(): string[] {
  const seen = new Set<string>()
  const duplicates = new Set<string>()
  for (const { item } of navIndex) {
    if (seen.has(item.href)) duplicates.add(item.href)
    seen.add(item.href)
  }
  return Array.from(duplicates)
}

// ----------------------------------------------------------------------------
// 5. KONSTANTA LAIN
// ----------------------------------------------------------------------------

/**
 * Menu utama di BAGIAN ATAS sidebar, di atas daftar grup/direktorat.
 * Halaman dashboard utama = "/dashboard". Ubah `href` di sini bila rute
 * Analytics / Report berbeda; ikonnya di sidebar/icons.ts (PRIMARY_ICONS).
 */
export const primaryNav: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    description: "Ringkasan utama aplikasi.",
    keywords: ["dashboard", "beranda", "ringkasan", "home"],
  },
  {
    title: "Analytics",
    href: "/analytics",
    description: "Analisis dan grafik data.",
    keywords: ["analytics", "analitik", "grafik", "statistik"],
  },
  {
    title: "Pengaduan",
    href: "/dashboard/pengaduan",
    description: "Laporan pengaduan pelanggan.",
    keywords: ["pengaduan", "laporan", "rekap"],
  },
]

/**
 * Link di navbar desktop (teks kecil). Hanya level Direktorat, bukan seluruh
 * hirarki. `href` menunjuk halaman landing tiap Direktorat.
 */
export const navbarLinks = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Pencatat", href: "/meter" },
  { label: "Langganan", href: "/pelanggan" },
  { label: "Zona", href: "/laporan" },
]

/** Link menu layar penuh di mobile: sama dengan navbar + Bantuan. */
export const mobileMenuLinks = [
  ...navbarLinks.map((link) => ({ name: link.label, href: link.href })),
  { name: "Bantuan", href: "/bantuan" },
]

/** Versi menu/aplikasi yang ditampilkan di UI. */
export const versions = ["v1.0"]