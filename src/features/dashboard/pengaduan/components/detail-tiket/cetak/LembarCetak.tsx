"use client"

// features/dashboard/pengaduan/components/detail-tiket/cetak/LembarCetak.tsx
// — Dokumen A4 resmi standar enterprise untuk Berita Acara & Lembar Disposisi
// Penanganan Pengaduan Air (Perumda Air Minum Tirtawening).
//
// Karakteristik:
// - Kop surat resmi dengan logo perusahaan, kontak call center, dan nomor registrasi tiket.
// - Kartu ringkasan eksekutif KPI (Status, Prioritas SLA, Target Selesai, Petugas Lapangan).
// - Matriks data pelanggan, titik koordinat, dan uraian duduk perkara terstruktur.
// - Dokumentasi visual terkontrol (foto sebelum & sesudah) dengan tinggi proporsional.
// - Tabel riwayat audit tindak lanjut berdesain elegan, kontras tinggi, dan bebas tumpahan halaman.
// - Lembar pengesahan resmi 3 kolom (Pelapor, Petugas Pelaksana, Supervisor).
import { createPortal } from "react-dom"
import {
  LABEL_JENIS_PENGADUAN,
  formatSisaWaktu,
  formatWaktu,
} from "@/features/public/lib/Format"
import {
  LABEL_PRIORITAS_PENGADUAN,
  statusPengaduanStaf,
} from "@/features/dashboard/lib/LabelPengaduan"
import { LABEL_AKSI } from "@/features/dashboard/pengaduan/components/LinimasaStaf"
import type { PengaduanDetail } from "@/features/dashboard/pengaduan/types/TipePengaduan"
import { GAYA_CETAK } from "./GayaCetak"

const waktu = (v: string | null) => (v ? `${formatWaktu(v)} WIB` : "—")

function SeksiJudul({ judul, nomor }: { judul: string; nomor?: string }) {
  return (
    <div className="mb-2 mt-3.5 flex items-center gap-2 border-b-1.5 border-slate-700 pb-1">
      {nomor && (
        <span className="flex size-4.5 items-center justify-center rounded-xs bg-slate-800 text-[7pt] font-bold text-white">
          {nomor}
        </span>
      )}
      <h2 className="text-[9.5pt] font-bold tracking-tight text-slate-900 uppercase">
        {judul}
      </h2>
    </div>
  )
}

function ItemData({
  label,
  children,
  lebar,
}: {
  label: string
  children: React.ReactNode
  lebar?: boolean
}) {
  return (
    <div className={lebar ? "col-span-2" : undefined}>
      <dt className="text-[7.5pt] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="text-[8.5pt] font-medium text-slate-900 break-words">
        {children}
      </dd>
    </div>
  )
}

export function LembarCetak({
  detail,
  tanggalCetak,
}: {
  detail: PengaduanDetail
  tanggalCetak: string
}) {
  const status = statusPengaduanStaf(detail.status)
  const wilayah = [detail.kelurahan?.nama, detail.kecamatan?.nama]
    .filter(Boolean)
    .join(", ")
  const adaLampiran = Boolean(detail.fotoUrl || detail.fotoPenyelesaianUrl)

  return createPortal(
    <>
      <style>{GAYA_CETAK}</style>
      <div id="lembar-cetak-root">
        <div id="lembar-cetak" className="w-full bg-white text-slate-900">
          {/* ========================================================= */}
          {/* 1. KOP SURAT RESMI PERUSAHAAN                             */}
          {/* ========================================================= */}
          <header className="cetak-blok border-b-2 border-sky-800 pb-2.5">
            <div className="flex items-start justify-between gap-4">
              {/* Identitas Korporat */}
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.png"
                  alt="Logo Tirtawening"
                  className="h-11 w-auto object-contain"
                />
                <div>
                  <h1 className="text-[11.5pt] font-black tracking-wider text-slate-950 uppercase">
                    Perumda Air Minum Tirtawening
                  </h1>
                  <p className="text-[8pt] font-bold text-sky-800 tracking-wide uppercase">
                    Direktorat Operasional & Pelayanan Teknik
                  </p>
                  <p className="text-[7pt] text-slate-600">
                    Unit Penanganan Gangguan Jaringan & Pelayanan Pelanggan Air
                    Bersih
                  </p>
                  <p className="text-[6.5pt] text-slate-500">
                    Jl. Badaksinga No. 10, Bandung · Call Center: (022) 2509030 ·
                    www.tirtawening.co.id
                  </p>
                </div>
              </div>

              {/* Box Nomor Tiket & Registrasi */}
              <div className="min-w-[48mm] rounded-sm border border-slate-300 bg-slate-50/80 p-2 text-right shadow-2xs">
                <span className="block text-[6.5pt] font-bold uppercase tracking-widest text-slate-500">
                  Lembar Disposisi Aduan
                </span>
                <span className="block font-mono text-[11.5pt] font-extrabold text-slate-900">
                  {detail.nomorTiket}
                </span>
                <span className="block text-[7pt] text-slate-600">
                  Dicetak: {waktu(tanggalCetak)}
                </span>
              </div>
            </div>
            {/* Garis aksen tipis ganda */}
            <div className="mt-2 h-0.5 w-full bg-slate-300" />
          </header>

          {/* ========================================================= */}
          {/* 2. RINGKASAN EKSEKUTIF KPI (4 KARTU)                     */}
          {/* ========================================================= */}
          <div className="cetak-blok mt-3 grid grid-cols-4 gap-2">
            <div className="rounded-sm border border-slate-300 bg-slate-50 p-2">
              <span className="block text-[7pt] font-bold uppercase text-slate-500">
                Status Tiket
              </span>
              <span className="block text-[8.5pt] font-bold text-slate-900">
                {status.label}
              </span>
            </div>
            <div className="rounded-sm border border-slate-300 bg-slate-50 p-2">
              <span className="block text-[7pt] font-bold uppercase text-slate-500">
                Prioritas SLA
              </span>
              <span className="block text-[8.5pt] font-bold text-slate-900">
                {LABEL_PRIORITAS_PENGADUAN[detail.prioritas] ?? detail.prioritas}
              </span>
            </div>
            <div className="rounded-sm border border-slate-300 bg-slate-50 p-2">
              <span className="block text-[7pt] font-bold uppercase text-slate-500">
                Target Selesai
              </span>
              <span className="block text-[8.5pt] font-bold text-slate-900">
                {waktu(detail.sla.targetSelesaiAt)}
              </span>
              {detail.sla.melanggar && (
                <span className="block text-[7pt] font-semibold text-rose-700">
                  Terlambat ({formatSisaWaktu(detail.sla.sisaMenit)})
                </span>
              )}
            </div>
            <div className="rounded-sm border border-slate-300 bg-slate-50 p-2">
              <span className="block text-[7pt] font-bold uppercase text-slate-500">
                Petugas Lapangan
              </span>
              <span className="block text-[8.5pt] font-bold text-slate-900">
                {detail.ditugaskanKe?.name ?? "Belum Ditugaskan"}
              </span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 3. SEKSI I: DATA PELANGGAN & LOKASI KEJADIAN             */}
          {/* ========================================================= */}
          <div className="cetak-blok">
            <SeksiJudul nomor="I" judul="Informasi Pelapor & Lokasi Kejadian" />
            <div className="rounded-sm border border-slate-200 bg-slate-50/50 p-2.5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                <ItemData label="Nama Pelapor">{detail.pelapor}</ItemData>
                <ItemData label="No. Kontak / Telepon">
                  {detail.kontakPelapor ?? "—"}
                </ItemData>
                <ItemData label="No. Langganan PDAM">
                  {detail.pelanggan
                    ? `${detail.pelanggan.nomorLangganan} (${detail.pelanggan.nama})`
                    : detail.nomorLangganan
                      ? `${detail.nomorLangganan} (Belum Terverifikasi)`
                      : "—"}
                </ItemData>
                <ItemData label="Wilayah Kelurahan / Kecamatan">
                  {wilayah || "—"}
                </ItemData>
                <ItemData label="Alamat Lengkap Lokasi Gangguan" lebar>
                  {detail.alamatKejadian ?? "—"}
                </ItemData>
              </dl>
            </div>
          </div>

          {/* ========================================================= */}
          {/* 4. SEKSI II: DUDUK PERKARA & RINCIAN GANGGUAN             */}
          {/* ========================================================= */}
          <div className="cetak-blok">
            <SeksiJudul nomor="II" judul="Uraian Perkara & Kronologi Gangguan" />
            <div className="rounded-sm border border-slate-200 bg-slate-50/50 p-2.5">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
                <ItemData label="Perihal / Pokok Aduan">{detail.judul}</ItemData>
                <ItemData label="Kategori Aduan">
                  {LABEL_JENIS_PENGADUAN[detail.jenis] ?? detail.jenis}
                </ItemData>
                <ItemData label="Waktu Masuk Aduan">
                  {waktu(detail.createdAt)}
                </ItemData>
                <ItemData label="Waktu Verifikasi">
                  {waktu(detail.verifikasiAt)}
                </ItemData>
                <ItemData label="Mulai Ditangani Petugas">
                  {waktu(detail.ditanganiMulai)}
                </ItemData>
                <ItemData label="Waktu Selesai Pengerjaan">
                  {waktu(detail.selesaiAt)}
                </ItemData>
              </dl>

              {/* Kotak Deskripsi */}
              <div className="mt-2.5 rounded-sm border-l-2 border-slate-700 bg-white p-2">
                <span className="block text-[7pt] font-bold uppercase tracking-wider text-slate-500">
                  Deskripsi Laporan Warga:
                </span>
                <p className="mt-1 text-[8.5pt] leading-relaxed text-slate-800 whitespace-pre-wrap">
                  {detail.deskripsi}
                </p>
              </div>

              {/* Data Eskalasi jika ada */}
              {detail.eskalasiKe && (
                <div className="mt-2 rounded-sm border border-rose-200 bg-rose-50/60 p-2 text-[8pt] text-rose-950">
                  <span className="font-bold">Eskalasi Manajemen:</span>{" "}
                  Dieskalasikan ke {detail.eskalasiKe.name ?? "—"} (
                  {detail.eskalasiKe.role}) pada {waktu(detail.eskalasiAt)}.
                  {detail.alasanEskalasi && (
                    <p className="mt-0.5 text-[7.5pt] italic text-rose-900">
                      Alasan: “{detail.alasanEskalasi}”
                    </p>
                  )}
                </div>
              )}

              {/* Catatan Penyelesaian jika ada */}
              {detail.catatanPenyelesaian && (
                <div className="mt-2 rounded-sm border border-emerald-200 bg-emerald-50/60 p-2 text-[8pt] text-emerald-950">
                  <span className="font-bold">Hasil Penanganan Lapangan:</span>{" "}
                  {detail.catatanPenyelesaian}
                  {detail.ratingKepuasan !== null && (
                    <span className="ml-2 font-semibold">
                      (Penilaian Pelanggan: {detail.ratingKepuasan}/5
                      {detail.komentarKepuasan
                        ? ` — “${detail.komentarKepuasan}”`
                        : ""}
                      )
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ========================================================= */}
          {/* 5. SEKSI III: DOKUMENTASI VISUAL LAPANGAN                */}
          {/* ========================================================= */}
          {adaLampiran && (
            <div className="cetak-blok">
              <SeksiJudul nomor="III" judul="Dokumentasi Visual Lapangan" />
              <div className="grid grid-cols-2 gap-3 rounded-sm border border-slate-200 bg-slate-50/40 p-2">
                {detail.fotoUrl && (
                  <div className="flex flex-col items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={detail.fotoUrl}
                      alt="Foto Pelapor"
                      className="max-h-[38mm] w-full rounded-xs border border-slate-300 object-contain bg-white"
                    />
                    <span className="mt-1 text-[7.5pt] font-semibold text-slate-700">
                      Kondisi Awal (Dokumentasi Pelapor)
                    </span>
                  </div>
                )}
                {detail.fotoPenyelesaianUrl && (
                  <div className="flex flex-col items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={detail.fotoPenyelesaianUrl}
                      alt="Foto Bukti Penyelesaian"
                      className="max-h-[38mm] w-full rounded-xs border border-slate-300 object-contain bg-white"
                    />
                    <span className="mt-1 text-[7.5pt] font-semibold text-slate-700">
                      Hasil Akhir (Dokumentasi Petugas)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* 6. SEKSI IV: MATRIKS RIWAYAT & TINDAK LANJUT              */}
          {/* ========================================================= */}
          <div className="cetak-blok">
            <SeksiJudul
              nomor={adaLampiran ? "IV" : "III"}
              judul="Matriks Riwayat & Log Tindak Lanjut"
            />
            {detail.riwayat.length === 0 ? (
              <p className="text-[8pt] italic text-slate-500">
                Belum ada riwayat tindak lanjut tercatat.
              </p>
            ) : (
              <table className="cetak-tabel border border-slate-300 text-[7.5pt]">
                <thead>
                  <tr className="border-b border-slate-400 bg-slate-800 text-left text-white">
                    <th className="w-[8mm] py-1 pl-1.5 font-bold text-center">
                      No
                    </th>
                    <th className="w-[28mm] py-1 px-1 font-bold">Waktu</th>
                    <th className="w-[32mm] py-1 px-1 font-bold">
                      Aksi / Transisi
                    </th>
                    <th className="w-[30mm] py-1 px-1 font-bold">
                      Pelaksana (Role)
                    </th>
                    <th className="w-[14mm] py-1 px-1 font-bold">Akses</th>
                    <th className="py-1 px-1.5 font-bold">Catatan Uraian</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.riwayat.map((e, idx) => (
                    <tr
                      key={e.id}
                      className={
                        idx % 2 === 0
                          ? "border-b border-slate-200 bg-white"
                          : "border-b border-slate-200 bg-slate-50/80"
                      }
                    >
                      <td className="py-1 pl-1.5 text-center text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-1 px-1 text-slate-700">
                        {waktu(e.createdAt)}
                      </td>
                      <td className="py-1 px-1 font-medium text-slate-900">
                        <span>{LABEL_AKSI[e.aksi] ?? e.aksi}</span>
                        {e.statusKe && (
                          <span className="block font-semibold text-slate-700">
                            → {statusPengaduanStaf(e.statusKe).label}
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-1 text-slate-800">
                        <span className="font-medium">{e.olehNama}</span>
                        {e.oleh?.role && (
                          <span className="block text-[7pt] text-slate-500">
                            {e.oleh.role}
                          </span>
                        )}
                      </td>
                      <td className="py-1 px-1">
                        <span
                          className={`rounded-xs px-1 py-0.2 text-[6.5pt] font-bold ${
                            e.isPublik
                              ? "bg-sky-100 text-sky-800 border border-sky-300"
                              : "bg-amber-100 text-amber-900 border border-amber-300"
                          }`}
                        >
                          {e.isPublik ? "Publik" : "Internal"}
                        </span>
                      </td>
                      <td className="py-1 px-1.5 text-slate-800">
                        <span className="whitespace-pre-wrap">
                          {e.catatan ?? "—"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* ========================================================= */}
          {/* 7. SEKSI V: LEMBAR PENGESAHAN & SERAH TERIMA               */}
          {/* ========================================================= */}
          <div className="cetak-blok mt-4 pt-2">
            <div className="grid grid-cols-3 gap-4 text-center">
              {/* Kolom Pelapor */}
              <div className="rounded-xs border border-slate-300 p-2 bg-slate-50/40">
                <span className="block text-[7.5pt] font-bold uppercase text-slate-700">
                  Pelapor / Pelanggan
                </span>
                <span className="block text-[7pt] text-slate-500">
                  (Yang Menyatakan)
                </span>
                <div className="my-7 border-b border-dashed border-slate-400" />
                <span className="block text-[8pt] font-semibold text-slate-900">
                  {detail.pelapor}
                </span>
              </div>

              {/* Kolom Petugas Lapangan */}
              <div className="rounded-xs border border-slate-300 p-2 bg-slate-50/40">
                <span className="block text-[7.5pt] font-bold uppercase text-slate-700">
                  Petugas Pelaksana
                </span>
                <span className="block text-[7pt] text-slate-500">
                  (Tim Distribusi / Perbaikan)
                </span>
                <div className="my-7 border-b border-dashed border-slate-400" />
                <span className="block text-[8pt] font-semibold text-slate-900">
                  {detail.ditugaskanKe?.name ?? "(..........................................)"}
                </span>
              </div>

              {/* Kolom Supervisor */}
              <div className="rounded-xs border border-slate-300 p-2 bg-slate-50/40">
                <span className="block text-[7.5pt] font-bold uppercase text-slate-700">
                  Supervisor Operasional
                </span>
                <span className="block text-[7pt] text-slate-500">
                  (Mengetahui / Menyetujui)
                </span>
                <div className="my-7 border-b border-dashed border-slate-400" />
                <span className="block text-[8pt] font-semibold text-slate-900">
                  (..........................................)
                </span>
              </div>
            </div>

            {/* Catatan Hukum Footer */}
            <p className="mt-3 border-t border-slate-200 pt-1.5 text-[6.5pt] text-slate-500 italic text-center">
              Dokumen resmi Sistem Informasi Manajemen Pengaduan Air Perumda Air
              Minum Tirtawening. Segala catatan yang ditandai [Internal] adalah
              arsip dinas dan tidak dibagikan kepada publik.
            </p>
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
