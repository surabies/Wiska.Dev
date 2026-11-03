"use client"

// features/dashboard/pengguna/components/pengguna-dialog/BagianAkses.tsx —
// role, status, dan divisi.
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  LABEL_ROLE,
  LABEL_STATUS_USER,
} from "@/features/dashboard/lib/LabelPengguna"
import { Bagian, KELAS_SELECT, Medan } from "./TataLetakFormulir"
import { TANPA_DIVISI, type Divisi } from "../../types/TipeFormulirPengguna"
import type { IsiForm } from "../../hooks/UseFormulirPengguna"

export function BagianAkses({
  isi,
  set,
  divisi,
  diriSendiri,
}: {
  isi: IsiForm
  set: <K extends keyof IsiForm>(kunci: K, nilai: IsiForm[K]) => void
  divisi: Divisi[]
  diriSendiri: boolean
}) {
  return (
    <Bagian judul="Akses">
      <div className="grid gap-4 sm:grid-cols-2">
        <Medan id="pg-role" label="Role">
          <Select
            value={isi.role}
            onValueChange={(v) => set("role", v)}
            disabled={diriSendiri}
          >
            <SelectTrigger size="lg" id="pg-role" className={`w-full ${KELAS_SELECT}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LABEL_ROLE).map(([nilai, teks]) => (
                <SelectItem key={nilai} value={nilai}>
                  {teks}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Medan>

        <Medan id="pg-status" label="Status">
          <Select
            value={isi.status}
            onValueChange={(v) => set("status", v)}
            disabled={diriSendiri}
          >
            <SelectTrigger size="lg" id="pg-status" className={`w-full ${KELAS_SELECT}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(LABEL_STATUS_USER).map(([nilai, teks]) => (
                <SelectItem key={nilai} value={nilai}>
                  {teks}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Medan>
      </div>

      {/* Server menolak perubahan role/status atas diri sendiri supaya admin
          terakhir tidak bisa mengunci dirinya keluar. Dikunci di sini juga,
          dengan alasannya — bukan dibiarkan gagal di server. */}
      {diriSendiri && (
        <p className="text-xs text-muted-foreground">
          Role dan status akun Anda sendiri tidak bisa diubah dari sini.
        </p>
      )}

      <Medan id="pg-divisi" label="Divisi">
        <Select value={isi.divisiId} onValueChange={(v) => set("divisiId", v)}>
          <SelectTrigger size="lg" id="pg-divisi" className={`w-full ${KELAS_SELECT}`}>
            <SelectValue placeholder="Tanpa divisi" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TANPA_DIVISI}>Tanpa divisi</SelectItem>
            {divisi.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.nama}{" "}
                <span className="text-muted-foreground">({d.kode})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Medan>
    </Bagian>
  )
}
