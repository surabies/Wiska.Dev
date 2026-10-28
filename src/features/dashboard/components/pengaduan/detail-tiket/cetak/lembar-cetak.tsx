"use client";

// features/dashboard/components/pengaduan/detail-tiket/cetak/lembar-cetak.tsx
// — dokumen A4 untuk arsip / bahan dokumentasi petugas. Dirender lewat portal
// ke <body> HANYA saat mencetak (lihat use-cetak.ts & gaya-cetak.ts).
//
// Sengaja memakai warna tetap (hitam/abu di atas putih), BUKAN token tema:
// kalau petugas memakai tema gelap, teks berwarna --foreground (terang) akan
// tercetak tak terbaca. Lembar ini juga memuat catatan INTERNAL (diberi tanda)
// — dokumen untuk arsip petugas, bukan untuk dibagikan ke pelapor.
import { createPortal } from "react-dom";
import { LABEL_JENIS_PENGADUAN, formatSisaWaktu, formatWaktu } from "@/features/public/lib/format";
import { LABEL_PRIORITAS_PENGADUAN, statusPengaduanStaf } from "@/features/dashboard/lib/label";
import { LABEL_AKSI } from "@/features/dashboard/components/pengaduan/linimasa-staf";
import type { PengaduanDetail } from "@/features/dashboard/components/pengaduan/tipe";
import { GAYA_CETAK } from "./gaya-cetak";

const waktu = (v: string | null) => (v ? `${formatWaktu(v)} WIB` : "—");

function Seksi({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 break-inside-avoid-page">
      <h2 className="mb-2 border-b border-neutral-400 pb-1 text-[11pt] font-semibold">{judul}</h2>
      {children}
    </section>
  );
}

function Data({
  label,
  children,
  lebar,
}: {
  label: string;
  children: React.ReactNode;
  lebar?: boolean;
}) {
  return (
    <div className={lebar ? "col-span-2" : undefined}>
      <dt className="text-[8.5pt] text-neutral-600">{label}</dt>
      <dd className="wrap-break-word">{children}</dd>
    </div>
  );
}

export function LembarCetak({
  detail,
  tanggalCetak,
}: {
  detail: PengaduanDetail;
  tanggalCetak: string;
}) {
  const status = statusPengaduanStaf(detail.status);
  const wilayah = [detail.kelurahan?.nama, detail.kecamatan?.nama].filter(Boolean).join(", ");
  const adaLampiran = detail.fotoUrl || detail.videoUrl || detail.fotoPenyelesaianUrl;

  return createPortal(
    <>
      <style>{GAYA_CETAK}</style>
      <div id="lembar-cetak-root">
        <div id="lembar-cetak" className="bg-white text-[10pt] leading-snug text-black">
          {/* Kop */}
          <div className="flex items-start justify-between gap-6 border-b-2 border-black pb-3">
            <div>
              <p className="text-[9pt] text-neutral-600">Tirtawening</p>
              <h1 className="text-[15pt] font-semibold">Laporan Penanganan Pengaduan</h1>
            </div>
            <div className="text-right">
              <p className="font-mono text-[12pt] font-semibold">{detail.nomorTiket}</p>
              <p className="text-[8.5pt] text-neutral-600">Dicetak {waktu(tanggalCetak)}</p>
            </div>
          </div>

          {/* Ringkasan */}
          <Seksi judul="Ringkasan tiket">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              <Data label="Judul" lebar>
                {detail.judul}
              </Data>
              <Data label="Jenis">{LABEL_JENIS_PENGADUAN[detail.jenis] ?? detail.jenis}</Data>
              <Data label="Prioritas">{LABEL_PRIORITAS_PENGADUAN[detail.prioritas]}</Data>
              <Data label="Status">{status.label}</Data>
              <Data label="Ditugaskan ke">{detail.ditugaskanKe?.name ?? "Belum ditugaskan"}</Data>
              <Data label="Masuk">{waktu(detail.createdAt)}</Data>
              <Data label="Diverifikasi">{waktu(detail.verifikasiAt)}</Data>
              <Data label="Mulai ditangani">{waktu(detail.ditanganiMulai)}</Data>
              <Data label="Selesai">{waktu(detail.selesaiAt)}</Data>
              <Data label="Target penyelesaian">
                {waktu(detail.sla.targetSelesaiAt)}
                {detail.sla.melanggar && ` — ${formatSisaWaktu(detail.sla.sisaMenit)}`}
              </Data>
              {detail.jumlahDibukaKembali > 0 && (
                <Data label="Dibuka kembali">{detail.jumlahDibukaKembali}×</Data>
              )}
              {detail.jedaTotalMenit > 0 && <Data label="Total waktu dijeda">{detail.jedaTotalMenit} menit</Data>}
            </dl>
          </Seksi>

          {/* Pelapor & lokasi */}
          <Seksi judul="Pelapor & lokasi kejadian">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
              <Data label="Pelapor">{detail.pelapor}</Data>
              <Data label="Kontak">{detail.kontakPelapor ?? "—"}</Data>
              <Data label="Pelanggan">
                {detail.pelanggan
                  ? `${detail.pelanggan.nomorLangganan} · ${detail.pelanggan.nama}`
                  : detail.nomorLangganan
                    ? `${detail.nomorLangganan} (belum dicocokkan)`
                    : "—"}
              </Data>
              <Data label="Wilayah">{wilayah || "—"}</Data>
              <Data label="Alamat kejadian" lebar>
                {detail.alamatKejadian ?? "—"}
              </Data>
            </dl>
          </Seksi>

          <Seksi judul="Deskripsi pengaduan">
            <p className="whitespace-pre-wrap">{detail.deskripsi}</p>
          </Seksi>

          {detail.eskalasiKe && (
            <Seksi judul="Eskalasi">
              <p>
                Dieskalasi ke {detail.eskalasiKe.name ?? "—"} ({detail.eskalasiKe.role}) pada{" "}
                {waktu(detail.eskalasiAt)}.
              </p>
              {detail.alasanEskalasi && <p className="mt-1 whitespace-pre-wrap">{detail.alasanEskalasi}</p>}
            </Seksi>
          )}

          {(detail.catatanPenyelesaian || detail.ratingKepuasan !== null) && (
            <Seksi judul="Penyelesaian & penilaian">
              {detail.catatanPenyelesaian && (
                <p className="whitespace-pre-wrap">{detail.catatanPenyelesaian}</p>
              )}
              {detail.ratingKepuasan !== null && (
                <p className="mt-1">
                  Penilaian pelapor: {detail.ratingKepuasan}/5
                  {detail.komentarKepuasan && ` — “${detail.komentarKepuasan}”`}
                </p>
              )}
            </Seksi>
          )}

          {adaLampiran && (
            <Seksi judul="Lampiran">
              <div className="grid grid-cols-2 gap-4">
                {detail.fotoUrl && (
                  <figure className="break-inside-avoid">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={detail.fotoUrl} alt="" className="max-h-[70mm] w-full border border-neutral-400 object-contain" />
                    <figcaption className="mt-1 text-[8.5pt] text-neutral-600">Foto dari pelapor</figcaption>
                  </figure>
                )}
                {detail.fotoPenyelesaianUrl && (
                  <figure className="break-inside-avoid">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={detail.fotoPenyelesaianUrl}
                      alt=""
                      className="max-h-[70mm] w-full border border-neutral-400 object-contain"
                    />
                    <figcaption className="mt-1 text-[8.5pt] text-neutral-600">Foto bukti penyelesaian</figcaption>
                  </figure>
                )}
              </div>
              {detail.videoUrl && (
                <p className="mt-2 text-[8.5pt] break-all text-neutral-600">Video dari pelapor: {detail.videoUrl}</p>
              )}
            </Seksi>
          )}

          {/* Riwayat */}
          <Seksi judul="Riwayat tindak lanjut">
            {detail.riwayat.length === 0 ? (
              <p className="text-neutral-600">Belum ada tindak lanjut.</p>
            ) : (
              <table className="w-full border-collapse text-[9pt]">
                <thead>
                  <tr className="border-b border-neutral-500 text-left text-neutral-600">
                    <th className="w-[27mm] py-1 pr-2 font-medium">Waktu</th>
                    <th className="w-[34mm] py-1 pr-2 font-medium">Aksi</th>
                    <th className="w-[30mm] py-1 pr-2 font-medium">Oleh</th>
                    <th className="py-1 font-medium">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.riwayat.map((e) => (
                    <tr key={e.id} className="break-inside-avoid border-b border-neutral-300 align-top">
                      <td className="py-1.5 pr-2">{waktu(e.createdAt)}</td>
                      <td className="py-1.5 pr-2">
                        {LABEL_AKSI[e.aksi] ?? e.aksi}
                        {e.statusKe && (
                          <span className="block text-neutral-600">→ {statusPengaduanStaf(e.statusKe).label}</span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2">
                        {e.olehNama}
                        {e.oleh?.role && <span className="block text-neutral-600">{e.oleh.role}</span>}
                      </td>
                      <td className="py-1.5">
                        {!e.isPublik && (
                          <span className="mr-1 border border-neutral-500 px-1 text-[8pt] font-medium">Internal</span>
                        )}
                        <span className="whitespace-pre-wrap">{e.catatan ?? "—"}</span>
                        {e.fotoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={e.fotoUrl} alt="" className="mt-1 max-h-[35mm] border border-neutral-400" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Seksi>

          <p className="mt-6 border-t border-neutral-400 pt-2 text-[8pt] text-neutral-600">
            Dokumen internal petugas — memuat catatan yang ditandai “Internal”. Jangan dibagikan kepada
            pelapor.
          </p>
        </div>
      </div>
    </>,
    document.body,
  );
}
