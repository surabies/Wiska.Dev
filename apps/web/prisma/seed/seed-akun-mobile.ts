/**
 * prisma/seed/seed-akun-mobile.ts — Seed & Integrasi Akun Mobile Tirtawening:
 * 1. 9 Petugas Pembaca Meter Resmi dari database (PERIYADI, OMAY, IWAN, DIDIN, RUDY, DANI, EDI, AGUS, DADANG)
 *    Masing-masing dibuatkan akun User aktif (Role: PELAKSANA, JenisAkun: PETUGAS, Divisi: PELAYANAN),
 *    diberi kredensial login (username, email, password: Password123!), dan ditautkan ke record Pencatat
 *    sehingga bisa login di mobile dan langsung mengunduh paket rute lapangan yang ditugaskan.
 * 2. Petugas Penanganan Gangguan / Teknisi (teknisi@tirtawening.co.id / username: teknisi)
 * 3. Supervisor Lapangan (supervisor@tirtawening.co.id / username: supervisor)
 * 4. Warga / Pelanggan (warga@tirtawening.co.id / username: warga, terhubung ke Pelanggan aktif via LanggananWarga)
 *
 * Password default semua akun uji: Password123!
 */
import "dotenv/config"
import { hash } from "@node-rs/argon2"
import { prisma } from "../index"

const PASSWORD_DEFAULT = "Password123!"

/** 9 Petugas Pembaca Meter resmi yang sudah memiliki penugasan rute di database */
const SEMBILAN_PENCATAT = [
  {
    namaLapangan: "PERIYADI",
    username: "periyadi",
    email: "periyadi@tirtawening.co.id",
    namaLengkap: "Periyadi",
    nip: "198204122008011001",
    nik: "3273011204820001",
    jabatan: "Petugas Pembaca Meter (Pelayanan Wilayah)",
    telepon: "081220010001",
  },
  {
    namaLapangan: "OMAY",
    username: "omay",
    email: "omay@tirtawening.co.id",
    namaLengkap: "Omay Komarudin",
    nip: "198305142008011002",
    nik: "3273011405830002",
    jabatan: "Petugas Pembaca Meter (Pelayanan Wilayah)",
    telepon: "081220010002",
  },
  {
    namaLapangan: "IWAN",
    username: "iwan",
    email: "iwan@tirtawening.co.id",
    namaLengkap: "Iwan Setiawan",
    nip: "198406182009021003",
    nik: "3273011806840003",
    jabatan: "Petugas Pembaca Meter (Pelayanan Wilayah)",
    telepon: "081220010003",
  },
  {
    namaLapangan: "DIDIN",
    username: "didin",
    email: "didin@tirtawening.co.id",
    namaLengkap: "Didin Wahyudin",
    nip: "198507202010011004",
    nik: "3273012007850004",
    jabatan: "Petugas Pembaca Meter (Pelayanan Wilayah)",
    telepon: "081220010004",
  },
  {
    namaLapangan: "RUDY",
    username: "rudy",
    email: "rudy@tirtawening.co.id",
    namaLengkap: "Rudy Heryadi",
    nip: "198608222010021005",
    nik: "3273012208860005",
    jabatan: "Petugas Pembaca Meter (Pelayanan Wilayah)",
    telepon: "081220010005",
  },
  {
    namaLapangan: "DANI",
    username: "dani",
    email: "dani@tirtawening.co.id",
    namaLengkap: "Dani Ramdani",
    nip: "198709252011011006",
    nik: "3273012509870006",
    jabatan: "Petugas Pembaca Meter (Pelayanan Wilayah)",
    telepon: "081220010006",
  },
  {
    namaLapangan: "EDI",
    username: "edi",
    email: "edi@tirtawening.co.id",
    namaLengkap: "Edi Junaedi",
    nip: "198810282012021007",
    nik: "3273012810880007",
    jabatan: "Petugas Pembaca Meter (Pelayanan Wilayah)",
    telepon: "081220010007",
  },
  {
    namaLapangan: "AGUS",
    username: "agus",
    email: "agus@tirtawening.co.id",
    namaLengkap: "Agus Supriatna",
    nip: "198911302013011008",
    nik: "3273013011890008",
    jabatan: "Petugas Pembaca Meter (Pelayanan Wilayah)",
    telepon: "081220010008",
  },
  {
    namaLapangan: "DADANG",
    username: "dadang",
    email: "dadang@tirtawening.co.id",
    namaLengkap: "Dadang Suhendar",
    nip: "199012152014021009",
    nik: "3273011512900009",
    jabatan: "Petugas Pembaca Meter (Pelayanan Wilayah)",
    telepon: "081220010009",
  },
]

export async function seedAkunMobile() {
  console.info("=== Sinkronisasi Akun Mobile & 9 Petugas Baca Meter ===")
  const passwordHash = await hash(PASSWORD_DEFAULT)

  // Ambil data Divisi, Bagian, dan SubBagian resmi
  const divisiPelayanan = await prisma.divisi.findUnique({
    where: { kode: "PELAYANAN" },
  })
  const bagianPW4 = await prisma.bagian.findUnique({
    where: { kode: "BAGIAN-PW4" },
  })
  const subBagianCaterPW4 = await prisma.subBagian.findUnique({
    where: { kode: "SUB-PW4-CATER" },
  })

  const divisiTehnik = await prisma.divisi.findUnique({
    where: { kode: "TEHNIK" },
  })
  const bagianProd1 = await prisma.bagian.findUnique({
    where: { kode: "BAGIAN-PROD1" },
  })
  const subBagianPerpi = await prisma.subBagian.findUnique({
    where: { kode: "SUB-PROD1-PERPI" },
  })

  // 1. Hapus akun sementara "pencatat" jika ada
  const akunPencatatLama = await prisma.user.findFirst({
    where: {
      OR: [{ username: "pencatat" }, { email: "pencatat@tirtawening.co.id" }],
    },
  })
  if (akunPencatatLama) {
    // Lepaskan tautan dari tabel pencatat dulu
    await prisma.pencatat.updateMany({
      where: { userId: akunPencatatLama.id },
      data: { userId: null },
    })
    await prisma.user.delete({
      where: { id: akunPencatatLama.id },
    })
    console.info("✓ Akun sementara 'pencatat' berhasil dihapus.")
  }

  // 2. Buat / Perbarui 9 Akun Petugas Pembaca Meter Resmi
  console.info("\nMengaktifkan 9 Petugas Pembaca Meter resmi...")
  for (const pet of SEMBILAN_PENCATAT) {
    const user = await prisma.user.upsert({
      where: { email: pet.email },
      create: {
        username: pet.username,
        email: pet.email,
        name: pet.namaLengkap,
        passwordHash,
        role: "PELAKSANA",
        jenisAkun: "PETUGAS",
        nip: pet.nip,
        nik: pet.nik,
        jabatan: pet.jabatan,
        telepon: pet.telepon,
        divisiId: divisiPelayanan?.id ?? null,
        divisiKode: divisiPelayanan?.kode ?? "PELAYANAN",
        bagianId: bagianPW4?.id ?? null,
        subBagianId: subBagianCaterPW4?.id ?? null,
        subBagianKode: subBagianCaterPW4?.kode ?? null,
        status: "ACTIVE",
      },
      update: {
        username: pet.username,
        name: pet.namaLengkap,
        passwordHash,
        role: "PELAKSANA",
        jenisAkun: "PETUGAS",
        nip: pet.nip,
        nik: pet.nik,
        jabatan: pet.jabatan,
        telepon: pet.telepon,
        divisiId: divisiPelayanan?.id ?? null,
        divisiKode: divisiPelayanan?.kode ?? "PELAYANAN",
        bagianId: bagianPW4?.id ?? null,
        subBagianId: subBagianCaterPW4?.id ?? null,
        subBagianKode: subBagianCaterPW4?.kode ?? null,
        status: "ACTIVE",
      },
    })

    // Tautkan record Pencatat ke akun User ini
    const pencatatRecord = await prisma.pencatat.findUnique({
      where: { namaLapangan: pet.namaLapangan },
    })
    if (pencatatRecord) {
      await prisma.pencatat.update({
        where: { id: pencatatRecord.id },
        data: {
          userId: user.id,
          namaLengkap: pet.namaLengkap,
          nip: pet.nip,
          isAktif: true,
        },
      })
      console.info(
        `✓ [${pet.namaLapangan}] User: ${pet.username} | NIP: ${pet.nip} | Status: AKTIF & Terkoneksi`
      )
    } else {
      console.warn(`! Record Pencatat untuk namaLapangan ${pet.namaLapangan} tidak ditemukan.`)
    }
  }

  // 3. Akun Pendukung Lainnya: Teknisi, Supervisor, dan Warga
  console.info("\nMengaktifkan Akun Teknisi, Supervisor, dan Warga...")

  // Ambil sample pelanggan untuk akun warga
  const samplePelanggan = await prisma.pelanggan.findFirst({
    where: { status: "AKTIF" },
    select: { id: true, nomorLangganan: true, nama: true },
  })

  // Teknisi
  await prisma.user.upsert({
    where: { email: "teknisi@tirtawening.co.id" },
    create: {
      username: "teknisi",
      email: "teknisi@tirtawening.co.id",
      name: "Agus Pratama (Teknisi Gangguan)",
      passwordHash,
      role: "PELAKSANA",
      jenisAkun: "PETUGAS",
      nip: "198705202011021002",
      nik: "3273012005870002",
      jabatan: "Teknisi Gangguan & Distribusi Air",
      telepon: "081234567892",
      divisiId: divisiTehnik?.id ?? null,
      divisiKode: divisiTehnik?.kode ?? "TEHNIK",
      bagianId: bagianProd1?.id ?? null,
      subBagianId: subBagianPerpi?.id ?? null,
      subBagianKode: subBagianPerpi?.kode ?? null,
      status: "ACTIVE",
    },
    update: {
      username: "teknisi",
      name: "Agus Pratama (Teknisi Gangguan)",
      passwordHash,
      role: "PELAKSANA",
      jenisAkun: "PETUGAS",
      nip: "198705202011021002",
      nik: "3273012005870002",
      jabatan: "Teknisi Gangguan & Distribusi Air",
      telepon: "081234567892",
      divisiId: divisiTehnik?.id ?? null,
      divisiKode: divisiTehnik?.kode ?? "TEHNIK",
      bagianId: bagianProd1?.id ?? null,
      subBagianId: subBagianPerpi?.id ?? null,
      subBagianKode: subBagianPerpi?.kode ?? null,
      status: "ACTIVE",
    },
  })
  console.info("✓ Akun Teknisi: teknisi@tirtawening.co.id siap")

  // Supervisor
  await prisma.user.upsert({
    where: { email: "supervisor@tirtawening.co.id" },
    create: {
      username: "supervisor",
      email: "supervisor@tirtawening.co.id",
      name: "Hendra Wijaya (Supervisor)",
      passwordHash,
      role: "SUPERVISOR",
      jenisAkun: "PETUGAS",
      nip: "198003102005011003",
      nik: "3273011003800003",
      jabatan: "Supervisor Pengawasan Catat & Gangguan",
      telepon: "081234567893",
      divisiId: divisiPelayanan?.id ?? null,
      divisiKode: divisiPelayanan?.kode ?? "PELAYANAN",
      bagianId: bagianPW4?.id ?? null,
      subBagianId: subBagianCaterPW4?.id ?? null,
      subBagianKode: subBagianCaterPW4?.kode ?? null,
      status: "ACTIVE",
    },
    update: {
      username: "supervisor",
      name: "Hendra Wijaya (Supervisor)",
      passwordHash,
      role: "SUPERVISOR",
      jenisAkun: "PETUGAS",
      nip: "198003102005011003",
      nik: "3273011003800003",
      jabatan: "Supervisor Pengawasan Catat & Gangguan",
      telepon: "081234567893",
      divisiId: divisiPelayanan?.id ?? null,
      divisiKode: divisiPelayanan?.kode ?? "PELAYANAN",
      bagianId: bagianPW4?.id ?? null,
      subBagianId: subBagianCaterPW4?.id ?? null,
      subBagianKode: subBagianCaterPW4?.kode ?? null,
      status: "ACTIVE",
    },
  })
  console.info("✓ Akun Supervisor: supervisor@tirtawening.co.id siap")

  // Warga / Pelanggan
  const wargaUser = await prisma.user.upsert({
    where: { email: "warga@tirtawening.co.id" },
    create: {
      username: "warga",
      email: "warga@tirtawening.co.id",
      name: samplePelanggan?.nama ? `${samplePelanggan.nama} (Warga)` : "Siti Aminah (Warga)",
      passwordHash,
      role: "USER",
      jenisAkun: "PELANGGAN",
      nik: "3273015508900004",
      nomorPelanggan: samplePelanggan?.nomorLangganan ?? "00123456",
      jabatan: "Pelanggan Rumah Tangga",
      telepon: "081234567894",
      status: "ACTIVE",
    },
    update: {
      username: "warga",
      name: samplePelanggan?.nama ? `${samplePelanggan.nama} (Warga)` : "Siti Aminah (Warga)",
      passwordHash,
      role: "USER",
      jenisAkun: "PELANGGAN",
      nik: "3273015508900004",
      nomorPelanggan: samplePelanggan?.nomorLangganan ?? "00123456",
      jabatan: "Pelanggan Rumah Tangga",
      telepon: "081234567894",
      status: "ACTIVE",
    },
  })

  if (samplePelanggan) {
    await prisma.langgananWarga.upsert({
      where: {
        userId_pelangganId: {
          userId: wargaUser.id,
          pelangganId: samplePelanggan.id,
        },
      },
      create: {
        userId: wargaUser.id,
        pelangganId: samplePelanggan.id,
        isUtama: true,
      },
      update: {
        isUtama: true,
      },
    })
    console.info(`✓ Akun warga dikaitkan dengan Pelanggan: ${samplePelanggan.nomorLangganan}`)
  }

  console.info("\n=== Selesai! Semua 9 Petugas Pencatat & Akun Mobile Siap Digunakan ===")
}

seedAkunMobile()
  .catch((err) => {
    console.error("Gagal melakukan seed akun mobile:", err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
