// Data provenance rules for resolving competing customer data sources.
//
// MASALAH YANG DIPECAHKAN. Data pelanggan diisi oleh beberapa berkas luar
// (ProgresCater, master STI, PBPK, lapdatameter, r-nomor) dan oleh manusia.
// Dulu setiap importir menulis dengan aturannya sendiri dan tidak ada yang
// mencatat sebuah nilai datangnya dari mana — akibatnya hasil akhir ditentukan
// oleh URUTAN menjalankan impor, bukan oleh mutu datanya.
//
// Contoh nyata yang melahirkan berkas ini: 4.956 alamat di database tersimpan
// rusak (spasi hilang di sambungan kata — "JL.MERDEKANO 51" alih-alih
// "JL.MERDEKA NO 51") karena ProgresCater menimpanya tanpa syarat setiap kali
// seed jalan, padahal master STI menyimpan alamat yang utuh untuk nomor yang
// sama. Memperbaikinya lewat impor master hanya bertahan sampai seed
// berikutnya.
//
// CARA KERJA. Tiap kolom terjaga punya peringkat sumber. Sebuah sumber boleh
// menimpa nilai yang ada HANYA bila peringkatnya >= peringkat sumber yang
// menulisnya terakhir kali. Sumber berperingkat lebih rendah tetap boleh
// MENGISI kolom yang masih kosong — mengisi lubang tidak pernah merusak.
// Dengan begitu urutan menjalankan impor tidak lagi menentukan hasil, dan
// aplikasi bisa menyembuhkan dirinya sendiri saat berkas luar rusak.
//
// Sumber yang TIDAK terdaftar di peringkat sebuah kolom berarti: boleh
// mengisi bila kosong, tidak pernah boleh menimpa. Itulah cara golongan tarif
// dijaga — penetapannya hasil survei petugas, keputusan manusia, dan tidak
// ada berkas ekspor yang berhak mengubahnya.

/// Sumber yang boleh menulis data pelanggan. MANUSIA = diinput sadar lewat
/// layar aplikasi; selalu peringkat tertinggi.
export const SUMBER_DATA = [
  "MANUSIA",
  "MASTER_STI",
  "PBPK",
  "LAPDATAMETER",
  "PROGRES_CATER",
  "R_NOMOR",
] as const

export type SumberData = (typeof SUMBER_DATA)[number]

/// Kolom Pelanggan yang asal-usulnya dicatat. Sengaja terbatas pada yang
/// benar-benar diperebutkan banyak sumber — bukan seluruh kolom.
export const KOLOM_TERJAGA = [
  "nama",
  "alamat",
  "rt",
  "rw",
  "notelp",
  "tarifGolonganId",
] as const

export type KolomTerjaga = (typeof KOLOM_TERJAGA)[number]

/// Makin besar makin tepercaya. Sumber yang tidak tercantum = boleh mengisi
/// kolom kosong, tidak pernah boleh menimpa.
///
/// ALASAN TIAP PERINGKAT:
/// - Identitas & alamat: master STI terbukti utuh pada berkas nyata,
///   sedangkan ProgresCater terbukti merusak spasi. PBPK di tengah — ia
///   membawa data pendaftaran asli, tapi hanya untuk sambungan baru.
/// - notelp: master STI TIDAK punya kolom telepon sama sekali, jadi ia tidak
///   ikut berperingkat di sini. ProgresCater justru paling lengkap.
/// - tarifGolonganId: HANYA manusia. Golongan menentukan rupiah yang ditagih
///   ke warga dan ditetapkan lewat survei bagian langganan. Berkas ekspor
///   boleh mengusulkan, tidak boleh menulis.
const PERINGKAT: Record<KolomTerjaga, Partial<Record<SumberData, number>>> = {
  nama: {
    MANUSIA: 100,
    MASTER_STI: 80,
    PBPK: 60,
    LAPDATAMETER: 40,
    PROGRES_CATER: 20,
  },
  alamat: {
    MANUSIA: 100,
    MASTER_STI: 80,
    PBPK: 60,
    LAPDATAMETER: 40,
    PROGRES_CATER: 20,
  },
  rt: { MANUSIA: 100, MASTER_STI: 80, PBPK: 60, PROGRES_CATER: 20 },
  rw: { MANUSIA: 100, MASTER_STI: 80, PBPK: 60, PROGRES_CATER: 20 },
  notelp: { MANUSIA: 100, PROGRES_CATER: 60, PBPK: 40, LAPDATAMETER: 20 },
  tarifGolonganId: { MANUSIA: 100 },
}

const KOLOM_SET: ReadonlySet<string> = new Set(KOLOM_TERJAGA)

function peringkat(
  kolom: KolomTerjaga,
  sumber: SumberData | null,
): number | null {
  if (sumber === null) return null
  return PERINGKAT[kolom][sumber] ?? null
}

/// Peta kolom -> sumber, sebagaimana disimpan di Pelanggan.sumberKolom.
export type PetaAsalUsul = Partial<Record<KolomTerjaga, SumberData>>

/// Membaca kolom JSON apa adanya jadi peta bertipe. Nilai asing diabaikan
/// diam-diam — kolom ini catatan bantu, bukan data resmi; isinya yang rusak
/// tidak boleh menggagalkan impor.
export function bacaAsalUsul(mentah: unknown): PetaAsalUsul {
  if (mentah === null || typeof mentah !== "object" || Array.isArray(mentah))
    return {}
  const hasil: PetaAsalUsul = {}
  for (const [k, v] of Object.entries(mentah as Record<string, unknown>)) {
    if (!KOLOM_SET.has(k)) continue
    if (typeof v !== "string") continue
    if (!(SUMBER_DATA as readonly string[]).includes(v)) continue
    hasil[k as KolomTerjaga] = v as SumberData
  }
  return hasil
}

/// Kosong = belum pernah diisi. String kosong dianggap kosong: berkas ekspor
/// lazim mengisi "" alih-alih membiarkan sel hilang.
function kosong(nilai: unknown): boolean {
  return (
    nilai === null ||
    nilai === undefined ||
    (typeof nilai === "string" && nilai.trim() === "")
  )
}

export interface KeputusanKolom {
  kolom: KolomTerjaga
  /// "TULIS" nilai baru diterima; "ISI_KOSONG" idem tapi karena kolomnya
  /// masih kosong; "TOLAK" sumbernya kalah peringkat; "SAMA" tidak ada beda.
  putusan: "TULIS" | "ISI_KOSONG" | "TOLAK" | "SAMA"
  sumberLama: SumberData | null
}

export interface HasilSaring<T> {
  /// Nilai yang BOLEH ditulis — sudah dibuang yang tertolak.
  data: Partial<T>
  /// Peta asal-usul baru; simpan ke Pelanggan.sumberKolom bila `data` terisi.
  asalUsul: PetaAsalUsul
  keputusan: KeputusanKolom[]
  ditolak: KolomTerjaga[]
  berubah: KolomTerjaga[]
}

/// Menyaring usulan perubahan terhadap peringkat sumber.
///
/// `usulan` hanya boleh memuat kolom terjaga; kolom lain diteruskan pemanggil
/// sendiri tanpa lewat sini. `nilaiLama` adalah isi baris sekarang di
/// database, `asalUsulLama` isi kolom sumberKolom-nya.
export function saringPerubahan<
  T extends Partial<Record<KolomTerjaga, unknown>>,
>(params: {
  usulan: T
  sumber: SumberData
  nilaiLama: Partial<Record<KolomTerjaga, unknown>>
  asalUsulLama: unknown
}): HasilSaring<T> {
  const { usulan, sumber, nilaiLama } = params
  const asalLama = bacaAsalUsul(params.asalUsulLama)

  const data: Partial<T> = {}
  const asalUsul: PetaAsalUsul = { ...asalLama }
  const keputusan: KeputusanKolom[] = []
  const ditolak: KolomTerjaga[] = []
  const berubah: KolomTerjaga[] = []

  for (const kolom of KOLOM_TERJAGA) {
    if (!(kolom in usulan)) continue
    const nilaiBaru = usulan[kolom]
    if (nilaiBaru === undefined) continue

    const sumberLama = asalLama[kolom] ?? null
    const lama = nilaiLama[kolom]

    if (nilaiBaru === lama) {
      // Nilainya memang sudah sama. Asal-usulnya tetap dicatat kalau belum
      // pernah ada — supaya kolom yang seumur hidup diisi satu sumber tidak
      // selamanya "tidak diketahui".
      if (sumberLama === null) asalUsul[kolom] = sumber
      keputusan.push({ kolom, putusan: "SAMA", sumberLama })
      continue
    }

    if (kosong(lama)) {
      // Mengisi lubang tidak pernah merusak — peringkat tidak berlaku.
      ;(data as Record<string, unknown>)[kolom] = nilaiBaru
      asalUsul[kolom] = sumber
      berubah.push(kolom)
      keputusan.push({ kolom, putusan: "ISI_KOSONG", sumberLama })
      continue
    }

    const pBaru = peringkat(kolom, sumber)
    const pLama = peringkat(kolom, sumberLama)

    // pBaru null = sumber ini tidak berhak menulis kolom ini sama sekali.
    // pLama null = kolom terisi tapi asal-usulnya tidak diketahui (data
    // warisan sebelum pencatatan ini ada). Isi yang tidak diketahui asalnya
    // BOLEH ditimpa oleh sumber mana pun yang berhak — kalau tidak, seluruh
    // baris lama akan membeku selamanya.
    const boleh = pBaru !== null && (pLama === null || pBaru >= pLama)
    if (!boleh) {
      ditolak.push(kolom)
      keputusan.push({ kolom, putusan: "TOLAK", sumberLama })
      continue
    }

    ;(data as Record<string, unknown>)[kolom] = nilaiBaru
    asalUsul[kolom] = sumber
    berubah.push(kolom)
    keputusan.push({ kolom, putusan: "TULIS", sumberLama })
  }

  return { data, asalUsul, keputusan, ditolak, berubah }
}
