// features/dashboard/components/pengguna/pengguna-dialog/use-form-pengguna.ts
// — state form + logika Simpan.
//
// TIGA ENDPOINT, SATU FORM. Server sengaja memisahkan role dan status dari
// PATCH /users/:id (lihat catatan di user.router.ts): keduanya punya endpoint
// sendiri supaya selalu melewati pengecekan self-modification dan audit
// khusus. Hook ini menyatukannya kembali untuk pemakainya — satu tombol
// Simpan — lalu mengirim ke tiga alamat yang benar, dan HANYA yang berubah.
//
// Perubahan role/status dikirim BELAKANGAN, setelah data dasar tersimpan.
// Kalau salah satunya ditolak server (mis. mengubah role sendiri), yang sudah
// tersimpan tidak ikut hilang: grid disegarkan, dan pesannya menyebut persis
// bagian mana yang sudah tersimpan dan mana yang gagal. Klik Simpan berikutnya
// membandingkan dengan keadaan TERBARU (awalRef), bukan baris lama — jadi
// field yang sudah tersimpan tidak dikirim ulang ke log audit.
import * as React from "react"
import { kirimJson, ApiError } from "@/features/dashboard/lib/api-client"
import { TANPA_DIVISI, type BarisPengguna } from "./tipe"

export interface IsiForm {
  nama: string
  email: string
  username: string
  sandi: string
  role: string
  status: string
  divisiId: string
}

export function useFormPengguna({
  pengguna,
  idSaya,
  roleSaya,
  onTersimpan,
  onTutup,
}: {
  /** null = mode TAMBAH; berisi baris = mode UBAH. */
  pengguna: BarisPengguna | null
  /** id akun yang sedang login — role & status dirinya sendiri dikunci. */
  idSaya?: string | null
  /** Reset sandi akun ORANG LAIN hanya untuk SUPER_ADMIN (user.router.ts). */
  roleSaya?: string | null
  onTersimpan: () => void
  onTutup: () => void
}) {
  const ubah = pengguna != null
  const diriSendiri = ubah && idSaya != null && pengguna.id === idSaya
  const bisaReset = ubah && !diriSendiri && roleSaya === "SUPER_ADMIN"

  const [isi, setIsi] = React.useState<IsiForm>({
    nama: pengguna?.name ?? "",
    email: pengguna?.email ?? "",
    username: pengguna?.username ?? "",
    sandi: "",
    role: pengguna?.role ?? "STAFF",
    status: pengguna?.status ?? "ACTIVE",
    divisiId: pengguna?.divisiId ?? TANPA_DIVISI,
  })
  const [mengirim, setMengirim] = React.useState(false)
  const [galat, setGalat] = React.useState<string | null>(null)
  const awalRef = React.useRef<BarisPengguna | null>(pengguna)

  function set<K extends keyof IsiForm>(kunci: K, nilai: IsiForm[K]) {
    setIsi((p) => ({ ...p, [kunci]: nilai }))
  }

  // Aturan server: password hanya bisa diset bila username ada, karena login
  // Credentials membutuhkan keduanya. Ditegakkan di sini juga supaya
  // pemakainya tahu SEBELUM menekan Simpan.
  const sandiTanpaUsername = isi.sandi.trim().length > 0 && isi.username.trim().length === 0
  const bisaSimpan =
    isi.nama.trim().length > 0 && isi.email.trim().length > 0 && !sandiTanpaUsername && !mengirim

  async function simpan(e?: React.FormEvent) {
    e?.preventDefault()
    if (!bisaSimpan) return

    setMengirim(true)
    setGalat(null)
    const nama = isi.nama.trim()
    const email = isi.email.trim()
    const username = isi.username.trim()
    const idDivisi = isi.divisiId === TANPA_DIVISI ? null : isi.divisiId

    const sudah: string[] = []
    let langkah = "data akun"
    try {
      const awal = awalRef.current
      if (!ubah || !awal) {
        await kirimJson("/users", "POST", {
          name: nama,
          email,
          username: username || null,
          password: isi.sandi.trim() || undefined,
          role: isi.role,
          status: isi.status,
          divisiId: idDivisi,
        })
      } else {
        // Hanya kirim yang benar-benar berubah — PATCH parsial, dan setiap
        // field yang ikut terkirim akan tercatat di AuditLog.
        const patch: Record<string, unknown> = {}
        if (nama !== (awal.name ?? "")) patch.name = nama
        if (email !== (awal.email ?? "")) patch.email = email
        if (username !== (awal.username ?? "")) patch.username = username || null
        if (idDivisi !== (awal.divisiId ?? null)) patch.divisiId = idDivisi
        if (Object.keys(patch).length > 0) {
          await kirimJson(`/users/${awal.id}`, "PATCH", patch)
          awalRef.current = { ...awalRef.current!, name: nama, email, username: username || null, divisiId: idDivisi }
          sudah.push("data akun")
        }

        if (isi.role !== awalRef.current!.role) {
          langkah = "role"
          await kirimJson(`/users/${awal.id}/role`, "PATCH", { role: isi.role })
          awalRef.current = { ...awalRef.current!, role: isi.role }
          sudah.push("role")
        }
        if (isi.status !== awalRef.current!.status) {
          langkah = "status"
          await kirimJson(`/users/${awal.id}/status`, "PATCH", { status: isi.status })
          awalRef.current = { ...awalRef.current!, status: isi.status }
          sudah.push("status")
        }
      }
      onTersimpan()
      onTutup()
    } catch (err) {
      const pesan = err instanceof ApiError ? err.message : "Gagal menyimpan. Coba lagi."
      if (sudah.length > 0) {
        // Sebagian sudah masuk — segarkan grid supaya tidak menampilkan data basi.
        onTersimpan()
        setGalat(`${sudah.join(" & ")} sudah tersimpan, tetapi ${langkah} gagal: ${pesan}`)
      } else {
        setGalat(pesan)
      }
      setMengirim(false)
    }
  }

  return { isi, set, ubah, diriSendiri, bisaReset, sandiTanpaUsername, bisaSimpan, mengirim, galat, simpan }
}
