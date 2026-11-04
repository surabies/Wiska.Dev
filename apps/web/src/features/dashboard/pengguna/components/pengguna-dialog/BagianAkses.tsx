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
import {
  TANPA_DIVISI,
  TANPA_BAGIAN,
  TANPA_SUB_BAGIAN,
  type Divisi,
  type BagianItem,
  type SubBagianItem,
} from "../../types/TipeFormulirPengguna"
import type { IsiForm } from "../../hooks/UseFormulirPengguna"

export function BagianAkses({
  isi,
  set,
  divisi,
  bagian,
  subBagian,
  diriSendiri,
}: {
  isi: IsiForm
  set: <K extends keyof IsiForm>(kunci: K, nilai: IsiForm[K]) => void
  divisi: Divisi[]
  bagian: BagianItem[]
  subBagian: SubBagianItem[]
  diriSendiri: boolean
}) {
  // Filter Bagian berdasarkan Divisi yang dipilih (jika ada divisi terpilih)
  const bagianTersaring =
    isi.divisiId && isi.divisiId !== TANPA_DIVISI
      ? bagian.filter((b) => b.divisiId === isi.divisiId)
      : bagian

  // Filter SubBagian berdasarkan Bagian yang dipilih (jika ada bagian terpilih)
  const subBagianTersaring =
    isi.bagianId && isi.bagianId !== TANPA_BAGIAN
      ? subBagian.filter((s) => s.bagianId === isi.bagianId)
      : subBagian

  function handlePilihDivisi(idDiv: string) {
    set("divisiId", idDiv)
    // Jika bagian yang terpilih sebelumnya tidak cocok dengan divisi baru, reset
    if (isi.bagianId !== TANPA_BAGIAN) {
      const cocok = bagian.find((b) => b.id === isi.bagianId && b.divisiId === idDiv)
      if (!cocok) {
        set("bagianId", TANPA_BAGIAN)
        set("subBagianId", TANPA_SUB_BAGIAN)
      }
    }
  }

  function handlePilihBagian(idBag: string) {
    set("bagianId", idBag)
    if (idBag !== TANPA_BAGIAN) {
      const bag = bagian.find((b) => b.id === idBag)
      if (bag && isi.divisiId !== bag.divisiId) {
        set("divisiId", bag.divisiId)
      }
      // Jika subBagian tidak cocok dengan bagian baru, reset
      if (isi.subBagianId !== TANPA_SUB_BAGIAN) {
        const subCocok = subBagian.find((s) => s.id === isi.subBagianId && s.bagianId === idBag)
        if (!subCocok) {
          set("subBagianId", TANPA_SUB_BAGIAN)
        }
      }
    }
  }

  function handlePilihSubBagian(idSub: string) {
    set("subBagianId", idSub)
    if (idSub !== TANPA_SUB_BAGIAN) {
      const sub = subBagian.find((s) => s.id === idSub)
      if (sub) {
        set("bagianId", sub.bagianId)
        const bag = bagian.find((b) => b.id === sub.bagianId)
        if (bag) set("divisiId", bag.divisiId)
      }
    }
  }

  return (
    <Bagian judul="Akses & Penempatan Organisasi">
      <div className="grid gap-4 sm:grid-cols-3">
        <Medan id="pg-jenis-akun" label="Jenis Akun">
          <Select
            value={isi.jenisAkun}
            onValueChange={(v) => set("jenisAkun", v as "PETUGAS" | "PELANGGAN")}
          >
            <SelectTrigger size="lg" id="pg-jenis-akun" className={`w-full ${KELAS_SELECT}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PETUGAS">Petugas Internal</SelectItem>
              <SelectItem value="PELANGGAN">Warga / Pelanggan</SelectItem>
            </SelectContent>
          </Select>
        </Medan>

        <Medan id="pg-role" label="Role Jenjang">
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

        <Medan id="pg-status" label="Status Akun">
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

      {diriSendiri && (
        <p className="text-xs text-muted-foreground">
          Role dan status akun Anda sendiri tidak bisa diubah dari sini.
        </p>
      )}

      {/* Penempatan Organisasi: Direktorat/Divisi, Bagian, dan SubBagian */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Medan id="pg-divisi" label="Direktorat / Divisi">
          <Select value={isi.divisiId} onValueChange={handlePilihDivisi}>
            <SelectTrigger size="lg" id="pg-divisi" className={`w-full ${KELAS_SELECT}`}>
              <SelectValue placeholder="Tanpa divisi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TANPA_DIVISI}>Tanpa divisi</SelectItem>
              {divisi.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nama} <span className="text-muted-foreground">({d.kode})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Medan>

        <Medan id="pg-bagian" label="Bagian / Unit Kerja">
          <Select value={isi.bagianId} onValueChange={handlePilihBagian}>
            <SelectTrigger size="lg" id="pg-bagian" className={`w-full ${KELAS_SELECT}`}>
              <SelectValue placeholder="Tanpa bagian" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TANPA_BAGIAN}>Tanpa bagian</SelectItem>
              {bagianTersaring.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Medan>

        <Medan id="pg-subbagian" label="Sub Bagian / Fungsi">
          <Select value={isi.subBagianId} onValueChange={handlePilihSubBagian}>
            <SelectTrigger size="lg" id="pg-subbagian" className={`w-full ${KELAS_SELECT}`}>
              <SelectValue placeholder="Tanpa sub bagian" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TANPA_SUB_BAGIAN}>Tanpa sub bagian</SelectItem>
              {subBagianTersaring.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.nama}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Medan>
      </div>
    </Bagian>
  )
}
