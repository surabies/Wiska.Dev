/**
 * repository.ts — sumber data ruang kerja Petugas Gangguan (tiket
 * pengaduan). Padanan `features/staff/pengaduan/pengaduan_staff_repository.dart`.
 *
 * SATU ATURAN YANG TIDAK BOLEH DILANGGAR: matriks transisi status TIDAK
 * pernah disalin ke sini. `transisiTersedia` selalu datang dari server pada
 * setiap detail tiket, dan tombol di layar dibangun dari daftar itu. Menyalin
 * aturannya ke aplikasi berarti dua sumber kebenaran yang akan menyimpang
 * diam-diam, dan petugas menekan tombol yang server tolak.
 *
 * `DITUTUP`/`DIBUKA_KEMBALI` tidak akan pernah muncul di daftar transisi
 * petugas — itu hak pelapor lewat jalur publik.
 */
import {
  ApiClient,
  ApiConfig,
  ComplaintTicketModel,
} from '@workspace/mobile-core';

/** Alias lokal — supaya layar tidak perlu tahu nama model bersama. */
export type TiketStaf = ComplaintTicketModel;

/**
 * Tiket yang ditugaskan ke petugas ini. Memakai `milikSaya=true`; JANGAN
 * menyalin id user sendiri ke filter `ditugaskanKeId` — server yang tahu
 * siapa pemegang token.
 */
export async function tiketSaya(): Promise<TiketStaf[]> {
  const hasil = await ApiClient.getList(`${ApiConfig.v1Path}/pengaduan`, {
    query: { milikSaya: true, pageSize: 100 },
    parseRow: ComplaintTicketModel.fromJson,
  });
  return hasil.rows;
}

/** Detail tiket — SATU-SATUNYA sumber `transisiTersedia`. */
export function detailTiket(id: string): Promise<TiketStaf> {
  return ApiClient.get(`${ApiConfig.v1Path}/pengaduan/${id}`, {
    parse: (data) =>
      ComplaintTicketModel.fromJson((data as Record<string, unknown>) ?? {}),
  });
}

/**
 * Pindahkan status tiket.
 *
 * `SELESAI` WAJIB menyertakan `catatanPenyelesaian` DAN
 * `fotoPenyelesaianUrl` (unggah dulu lewat [unggahFotoBukti]) — server
 * menolak tanpa keduanya. Itu disengaja: "selesai" tanpa bukti kerja adalah
 * klaim, bukan penyelesaian.
 */
export function ubahStatus(
  id: string,
  status: string,
  opsi: {
    catatan?: string | null;
    catatanPenyelesaian?: string | null;
    fotoPenyelesaianUrl?: string | null;
  } = {},
): Promise<void> {
  const body: Record<string, unknown> = { status };
  if (opsi.catatan) body['catatan'] = opsi.catatan;
  if (opsi.catatanPenyelesaian) body['catatanPenyelesaian'] = opsi.catatanPenyelesaian;
  if (opsi.fotoPenyelesaianUrl) body['fotoPenyelesaianUrl'] = opsi.fotoPenyelesaianUrl;
  return ApiClient.patch(`${ApiConfig.v1Path}/pengaduan/${id}/status`, {
    body,
    parse: () => undefined,
  });
}

/**
 * Unggah foto bukti hasil pekerjaan (isi divalidasi server lewat magic
 * bytes). Kembalikan URL untuk disertakan di [ubahStatus].
 */
export async function unggahFotoBukti(nomorTiket: string, pathFoto: string): Promise<string> {
  const form = new FormData();
  form.append('nomorTiket', nomorTiket);
  form.append('foto', {
    uri: pathFoto,
    name: pathFoto.split('/').pop() ?? 'bukti.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  return ApiClient.postMultipart(`${ApiConfig.v1Path}/pengaduan/foto`, {
    form,
    parse: (data) => {
      const url = (data as Record<string, unknown> | null)?.['url'];
      return typeof url === 'string' ? url : '';
    },
  });
}

/**
 * Catatan tindak lanjut TANPA mengubah status. `isPublik` bawaannya false —
 * kirim true hanya bila catatan itu memang untuk dibaca warga.
 */
export function tambahCatatan(
  id: string,
  catatan: string,
  opsi: { isPublik?: boolean } = {},
): Promise<void> {
  return ApiClient.post(`${ApiConfig.v1Path}/pengaduan/${id}/catatan`, {
    body: { catatan, isPublik: opsi.isPublik ?? false },
    parse: () => undefined,
  });
}

/**
 * Pesan CHAT ke pelapor — SELALU publik, tampil sebagai percakapan di
 * halaman pelacakan warga. Beda dari [tambahCatatan] yang bawaannya internal.
 */
export function kirimChat(id: string, pesan: string): Promise<void> {
  return ApiClient.post(`${ApiConfig.v1Path}/pengaduan/${id}/chat`, {
    body: { pesan },
    parse: () => undefined,
  });
}
