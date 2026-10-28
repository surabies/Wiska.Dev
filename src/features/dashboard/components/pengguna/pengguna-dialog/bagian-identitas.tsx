"use client"

// features/dashboard/components/pengguna/pengguna-dialog/bagian-identitas.tsx
// — nama, email, username, dan (hanya mode tambah) kata sandi awal.
import { Input } from "@/components/ui/input"
import { Bagian, KELAS_INPUT, Medan } from "./tata-letak-form"
import type { IsiForm } from "./use-form-pengguna"

export function BagianIdentitas({
  isi,
  set,
  ubah,
  sandiTanpaUsername,
}: {
  isi: IsiForm
  set: <K extends keyof IsiForm>(kunci: K, nilai: IsiForm[K]) => void
  ubah: boolean
  sandiTanpaUsername: boolean
}) {
  return (
    <Bagian judul="Identitas">
      <Medan id="pg-nama" label="Nama lengkap">
        <Input
          id="pg-nama"
          autoComplete="off"
          value={isi.nama}
          onChange={(e) => set("nama", e.target.value)}
          placeholder="mis. Wiska Prayoga"
          className={KELAS_INPUT}
          autoFocus
        />
      </Medan>

      <Medan id="pg-email" label="Email">
        <Input
          id="pg-email"
          type="email"
          autoComplete="off"
          value={isi.email}
          onChange={(e) => set("email", e.target.value)}
          placeholder="nama@tirtawening.co.id"
          className={KELAS_INPUT}
        />
      </Medan>

      <div className="grid gap-4 sm:grid-cols-2">
        <Medan id="pg-username" label="Username">
          <Input
            id="pg-username"
            autoComplete="off"
            value={isi.username}
            onChange={(e) => set("username", e.target.value)}
            placeholder="opsional"
            className={`${KELAS_INPUT} font-mono`}
          />
        </Medan>
        {!ubah && (
          <Medan id="pg-sandi" label="Kata sandi">
            {/* `new-password`, BUKAN "off". Chrome mengabaikan "off" pada
                kolom kata sandi, lalu mencari kolom "username" pasangannya di
                seluruh halaman — dan yang dipilihnya adalah kotak cari tabel
                di belakang dialog ini, yang lalu terisi nama akun tersimpan.
                `new-password` menyatakan ini sandi BARU, jadi tidak ada
                pasangan yang perlu dicari. */}
            <Input
              id="pg-sandi"
              type="password"
              autoComplete="new-password"
              value={isi.sandi}
              onChange={(e) => set("sandi", e.target.value)}
              placeholder="min. 8 karakter"
              className={KELAS_INPUT}
            />
          </Medan>
        )}
      </div>

      {/* Dijelaskan SEBELUM Simpan ditekan, bukan sebagai galat sesudahnya. */}
      <p className={sandiTanpaUsername ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
        {sandiTanpaUsername
          ? "Kata sandi butuh username — login dengan kata sandi memakai username, bukan email."
          : "Tanpa username & kata sandi, akun hanya bisa masuk lewat Google."}
      </p>
    </Bagian>
  )
}
