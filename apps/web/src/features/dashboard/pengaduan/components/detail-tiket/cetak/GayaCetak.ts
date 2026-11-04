// features/dashboard/pengaduan/components/detail-tiket/cetak/GayaCetak.ts —
// CSS cetak dokumen resmi A4 standar enterprise (Perumda Air Minum Tirtawening).
//
// Karakteristik:
// - Margin A4 terkontrol (10mm 12mm 12mm) untuk memaksimalkan ruang kerja dan
//   mencegah tumpahan halaman kedua yang kosong (blank page bug).
// - Font rendering tajam dengan color-adjust exact untuk stempel, badge, dan kop resmi.
// - Dukungan running header & running page numbering di level CSS Paged Media.
export const GAYA_CETAK = `
@page {
  size: A4 portrait;
  margin: 10mm 12mm 12mm 12mm;
  @bottom-right {
    content: "Halaman " counter(page) " dari " counter(pages);
    font-size: 7.5pt;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #64748b;
  }
  @bottom-left {
    content: "SIM Pengaduan Air · Perumda Air Minum Tirtawening";
    font-size: 7.5pt;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #94a3b8;
  }
}

#lembar-cetak-root {
  display: none;
}

@media print {
  *, *::before, *::after {
    box-sizing: border-box !important;
  }

  html, body {
    background: #ffffff !important;
    color: #0f172a !important;
    height: auto !important;
    min-height: 0 !important;
    margin: 0 !important;
    padding: 0 !important;
    overflow: visible !important;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased;
    font-size: 8.5pt;
    line-height: 1.35;
  }

  body > *:not(#lembar-cetak-root) {
    display: none !important;
  }

  #lembar-cetak-root {
    display: block !important;
    width: 100% !important;
    margin: 0 !important;
    padding: 0 !important;
  }

  #lembar-cetak-root * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  .cetak-blok {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }

  .cetak-tabel {
    border-collapse: collapse;
    width: 100%;
  }

  .cetak-tabel tr {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
  }
}
`
