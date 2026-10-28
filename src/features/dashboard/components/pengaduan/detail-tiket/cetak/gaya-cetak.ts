// features/dashboard/components/pengaduan/detail-tiket/cetak/gaya-cetak.ts —
// CSS cetak. Disuntikkan lewat <style> HANYA saat lembar cetak dirender, jadi
// tidak menyentuh globals.css dan tidak ada aturan cetak yang "bocor" ke
// halaman lain.
//
// Triknya: saat mencetak, semua anak langsung <body> (sidebar, topbar, toast,
// portal Radix, dst.) disembunyikan — kecuali lembar cetak. Hasilnya dokumen
// yang mengalir normal & bisa lebih dari satu halaman, tanpa halaman kosong
// seperti pada trik `visibility: hidden`.
export const GAYA_CETAK = `
@page {
  size: A4 portrait;
  margin: 14mm 14mm 16mm;
  @bottom-right {
    content: "Halaman " counter(page) " dari " counter(pages);
    font-size: 8pt;
    color: #555;
  }
}
#lembar-cetak-root { display: none; }
@media print {
  html, body {
    background: #fff !important;
    height: auto !important;
    overflow: visible !important;
  }
  body > *:not(#lembar-cetak-root) { display: none !important; }
  #lembar-cetak-root { display: block !important; }
  #lembar-cetak-root * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;
