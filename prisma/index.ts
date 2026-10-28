// Satu PrismaClient untuk aplikasi. Cache global mencegah hot reload
// development membuka pool koneksi baru pada setiap perubahan file.
import { PrismaClient } from "@generated";
import { PrismaPg } from "@prisma/adapter-pg";

// Export semua Type & Interface TypeScript dari Prisma
export type * from "@generated";

// Export runtime objects & enum values secara eksplisit
export {
  Prisma,
  AksiPengaduan,
  AlasanTaksir,
  GolonganTarif,
  JenisBiayaTetap,
  JenisMutasi,
  JenisPemutusan,
  JenisPengaduan,
  KlasifikasiPengaduan,
  JenisTagihanLain,
  KanalPembayaran,
  KategoriPembacaan,
  KodeDivisi,
  KondisiCatat,
  ObjekBayar,
  PrioritasPengaduan,
  Role,
  StatusDaftarCatat,
  StatusLaporanMandiri,
  StatusPasokanAir,
  StatusPelanggan,
  StatusPembayaran,
  StatusPengaduan,
  StatusPeriodePenagihan,
  StatusPotensi,
  StatusTagihan,
  SumberDaftarCatat,
  UkuranMeter,
  UserStatus,
} from "@generated";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL tidak ditemukan di environment — cek file .env di root project.",
  );
}

const url = new URL(connectionString);
const sslmode = url.searchParams.get("sslmode")?.toLowerCase();

if (sslmode === "prefer" || sslmode === "require" || sslmode === "verify-ca") {
  url.searchParams.set("sslmode", "verify-full");
}

const adapter = new PrismaPg({ connectionString: url.toString() });

const globalForPrisma = globalThis as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;