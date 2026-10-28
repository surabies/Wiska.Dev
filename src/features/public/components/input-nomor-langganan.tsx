"use client"

// features/public/components/input-nomor-langganan.tsx — kotak "nomor
// langganan + tombol cari", SATU-SATUNYA definisi visualnya di seluruh
// halaman publik.
//
// Sebelum diekstrak ke sini, tab "Lapor meter" (lapor-meter-form.tsx) dan tab
// "Cek laporan" (cek-laporan-meter-form.tsx) menulis ulang kotak yang sama
// masing-masing sendiri-sendiri — dan perlahan menyimpang (h-10 vs tanpa
// tinggi eksplisit, tombol ikon persegi vs tombol teks lebar, teks bantuan
// berbeda kalimat). Kalau salah satu tab kelak BENAR-BENAR perlu tampil beda,
// itu tandanya keduanya harus diputuskan ulang bareng di sini, bukan salah
// satu diam-diam menulis ulang className sendiri lagi.
import * as React from "react"
import { Loader2, Search } from "@/components/ui/hugeicons-compat"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function InputNomorLangganan({
  id,
  nomor,
  onNomorChange,
  onCari,
  pending,
}: {
  id: string
  nomor: string
  /** Sudah dibersihkan (digit saja, maks 11 karakter) sebelum dipanggil. */
  onNomorChange: (digitBaru: string) => void
  onCari: (nomor: string) => void
  pending: boolean
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Nomor langganan</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={nomor}
          onChange={(e) => onNomorChange(e.target.value.replace(/\D/g, "").slice(0, 11))}
          onKeyDown={(e) => e.key === "Enter" && nomor.length === 11 && onCari(nomor)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="Contoh: 00401700010"
          maxLength={11}
          disabled={pending}
          className="h-10 rounded-xl font-mono"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl"
          onClick={() => onCari(nomor)}
          disabled={nomor.length !== 11 || pending}
          aria-label="Cari nomor pelanggan"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        {pending ? "Mencari nomor pelanggan…" : "11 digit, tertera di rekening Anda. Pencarian berjalan otomatis."}
      </p>
    </div>
  )
}
