const fs = require('fs');
const path = require('path');

// Pastikan path mengarah ke struktur App Router Next.js (src/app/...)
const baseDir = path.join('src', 'app', '(dashboard)', 'tools-tutup');

const subFolders = [
  'pbpk',
  'stand-angkat',
  'update-zonasi',
  'posting-datameter',
  'create-closed-drd',
  'create-perbandingan',
  'create-bulan-baru',
  'upload-master-pelanggan',
  'sync-pelanggan-baru',
  'update-data-pelanggan',
  'cek-selisih-pelanggan',
  'monitoring-tutup-bulan'
];

// 1. Buat folder utama tools-tutup jika belum ada (tanpa layout.tsx & page.tsx root)
if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true });
}

// 2. Buat sub-folder dan file page.tsx masing-masing menu
subFolders.forEach(folder => {
  const dir = path.join(baseDir, folder);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Format judul (contoh: "stand-angkat" -> "Stand Angkat")
  const title = folder
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Konten file page.tsx sesuai format yang Anda inginkan
  const pageContent = `import { MenuPage } from "@/components/layout"

export const metadata = { title: "${title} · Tirtawening" }

export default function Page() {
  return <MenuPage href="/tools-tutup/${folder}" />
}
`;

  fs.writeFileSync(path.join(dir, 'page.tsx'), pageContent);
});

console.log('✅ Berhasil membuat seluruh sub-folder & file routing `MenuPage` di src/app/(dashboard)/tools-tutup!');