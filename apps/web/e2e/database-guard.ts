export function requireE2EDatabaseUrl(): string {
  const connectionString = process.env.E2E_DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "E2E_DATABASE_URL wajib diatur. E2E tidak akan memakai DATABASE_URL sebagai fallback.",
    )
  }

  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    throw new Error("E2E_DATABASE_URL bukan URL database yang valid.")
  }

  if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") {
    throw new Error("Database E2E wajib menggunakan PostgreSQL.")
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1))
  if (!/(^|[-_])(e2e|test)([-_]|$)/i.test(databaseName)) {
    throw new Error(
      `Nama database E2E "${databaseName}" harus memuat segmen "e2e" atau "test".`,
    )
  }

  if (
    process.env.DATABASE_URL &&
    process.env.DATABASE_URL === connectionString &&
    !/(^|[-_])(e2e|test)([-_]|$)/i.test(databaseName)
  ) {
    throw new Error("E2E_DATABASE_URL tidak boleh menunjuk database aplikasi.")
  }

  return connectionString
}
