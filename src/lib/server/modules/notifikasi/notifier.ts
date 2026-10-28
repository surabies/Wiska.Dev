// server/modules/notifikasi/notifier.ts — lapisan pengirim notifikasi.
//
// Adapter-first: seluruh kode aplikasi memanggil `getNotifier().kirim(...)`
// tanpa tahu implementasinya. Default `NotifierLog` menulis ke inbox in-app
// (tabel Notifikasi) dan mencatat log — cukup berguna SEBELUM Firebase
// disiapkan. Saat `FCM_SERVICE_ACCOUNT` diisi, factory beralih ke
// `NotifierFcm` yang menulis inbox SEKALIGUS mengirim push ke perangkat
// terdaftar (PerangkatNotif). Mencolok FCM = mengisi env + melengkapi satu
// TODO di file ini; call site tidak berubah.
//
// Kontrak penting: kirim() TIDAK PERNAH melempar. Notifikasi adalah efek
// samping best-effort — kegagalannya tak boleh menggagalkan aksi utama
// (penugasan rute/tiket). Karena itu ia juga TIDAK menerima transaction
// client: dipanggil SETELAH aksi utama commit.
import { prisma } from "@db"

export interface IsiNotifikasi {
  judul: string
  isi: string
  /// Kategori untuk ikon/rute dalam-app, mis. "pengaduan" | "rute".
  tipe?: string
  /// Tautan dalam-app, mis. { tipe: "pengaduan", id: "..." } — disimpan
  /// sebagai JSON string di kolom Notifikasi.data dan dikirim sebagai data
  /// payload FCM.
  data?: Record<string, unknown>
}

export interface Notifier {
  kirim(userIds: string[], isi: IsiNotifikasi): Promise<void>
}

/// Tulis inbox in-app untuk sekumpulan user. Dipakai kedua implementasi.
async function tulisInbox(
  userIds: string[],
  isi: IsiNotifikasi,
): Promise<void> {
  if (!userIds.length) return
  await prisma.notifikasi.createMany({
    data: userIds.map((userId) => ({
      userId,
      judul: isi.judul,
      isi: isi.isi,
      tipe: isi.tipe ?? "umum",
      data: isi.data ? JSON.stringify(isi.data) : null,
    })),
  })
}

function bersihkan(userIds: string[]): string[] {
  return [...new Set(userIds.filter((id): id is string => !!id))]
}

/// Implementasi tanpa Firebase: inbox in-app + log. Push nyata tidak dikirim.
class NotifierLog implements Notifier {
  async kirim(userIds: string[], isi: IsiNotifikasi): Promise<void> {
    const target = bersihkan(userIds)
    if (!target.length) return
    try {
      await tulisInbox(target, isi)
    } catch (e) {
      console.error("[notifier] gagal menulis inbox:", e)
    }
    console.info(
      `[notifier] (log-only, FCM nonaktif) "${isi.judul}" → ${target.length} user`,
    )
  }
}

/// Kerangka implementasi FCM. Menulis inbox (sama seperti log) LALU mengirim
/// push ke token perangkat terdaftar. Bagian pengiriman sengaja disisakan
/// sebagai TODO sampai kredensial `FCM_SERVICE_ACCOUNT` + paket Admin SDK
/// disiapkan — sampai saat itu factory memakai NotifierLog, jadi kelas ini
/// tidak aktif dan tidak menambah dependensi runtime.
class NotifierFcm implements Notifier {
  constructor(private readonly serviceAccountJson: string) {}

  async kirim(userIds: string[], isi: IsiNotifikasi): Promise<void> {
    const target = bersihkan(userIds)
    if (!target.length) return
    try {
      await tulisInbox(target, isi)
    } catch (e) {
      console.error("[notifier] gagal menulis inbox:", e)
    }
    try {
      const perangkat = await prisma.perangkatNotif.findMany({
        where: { userId: { in: target } },
        select: { token: true, platform: true },
      })
      if (!perangkat.length) return
      // TODO(FCM): inisialisasi firebase-admin dengan `this.serviceAccountJson`
      // dan panggil messaging().sendEachForMulticast({
      //   tokens: perangkat.map(p => p.token),
      //   notification: { title: isi.judul, body: isi.isi },
      //   data: isi.data ? mapNilaiKeString(isi.data) : undefined,
      // }). Bersihkan token yang ditolak (UNREGISTERED) dari PerangkatNotif.
      console.info(
        `[notifier] (FCM stub) siap kirim "${isi.judul}" ke ${perangkat.length} perangkat`,
      )
    } catch (e) {
      console.error("[notifier] gagal mengirim FCM:", e)
    }
  }
}

let _notifier: Notifier | null = null

/// Notifier tunggal untuk seluruh proses. NotifierFcm hanya dipakai bila
/// `FCM_SERVICE_ACCOUNT` (JSON service account) di-set; selain itu NotifierLog.
export function getNotifier(): Notifier {
  if (_notifier) return _notifier
  const sa = process.env.FCM_SERVICE_ACCOUNT
  _notifier = sa && sa.trim() ? new NotifierFcm(sa) : new NotifierLog()
  return _notifier
}
