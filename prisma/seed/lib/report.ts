// prisma/seed/lib/report.ts — pencatat progres & anomali seed, supaya
// setiap run bisa diaudit setelahnya (bukan cuma "sukses/gagal" di
// terminal). Ditulis ke file JSON lokal di prisma/seed/reports/ agar bisa
// diperiksa siapa pun tanpa harus scroll log terminal.

import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export type SeedIssueLevel = "warn" | "error"

export interface SeedIssue {
  step: string
  level: SeedIssueLevel
  message: string
  row?: number
  key?: string
}

export interface StatusChangeRecord {
  nomorLangganan: string
  from: string | null
  to: string
  reason: string
}

interface StepCounts {
  created: number
  updated: number
  unchanged: number
  skipped: number
}

export class SeedReport {
  private issues: SeedIssue[] = []
  private counts = new Map<string, StepCounts>()
  private statusChanges: StatusChangeRecord[] = []
  private readonly startedAt = new Date()

  private bucket(step: string): StepCounts {
    let c = this.counts.get(step)
    if (!c) {
      c = { created: 0, updated: 0, unchanged: 0, skipped: 0 }
      this.counts.set(step, c)
    }
    return c
  }

  created(step: string): void {
    this.bucket(step).created++
  }

  updated(step: string): void {
    this.bucket(step).updated++
  }

  unchanged(step: string): void {
    this.bucket(step).unchanged++
  }

  skipped(step: string): void {
    this.bucket(step).skipped++
  }

  warn(step: string, message: string, extra?: { row?: number; key?: string }): void {
    this.issues.push({ step, level: "warn", message, ...extra })
  }

  error(step: string, message: string, extra?: { row?: number; key?: string }): void {
    this.issues.push({ step, level: "error", message, ...extra })
  }

  /// Setiap perubahan status pelanggan (create ATAU update) dicatat di
  /// sini — laporan ini adalah jejak audit utama untuk menjawab
  /// "kenapa status pelanggan X berubah" pasca-import.
  statusChange(record: StatusChangeRecord): void {
    this.statusChanges.push(record)
  }

  get errorCount(): number {
    return this.issues.filter((i) => i.level === "error").length
  }

  get warnCount(): number {
    return this.issues.filter((i) => i.level === "warn").length
  }

  /// Baris Pemutusan yang berhasil masuk tapi pelanggannya MASIH berstatus
  /// AKTIF di database — sengaja TIDAK auto-diubah oleh seed script (lihat
  /// lib/status.ts). Daftar ini untuk ditinjau manusia via dashboard,
  /// bukan diproses otomatis lebih lanjut.
  private pemutusanNeedsReview: Array<{
    nomorLangganan: string
    jenis: string
    periode: number
  }> = []

  flagPemutusanReview(nomorLangganan: string, jenis: string, periode: number): void {
    this.pemutusanNeedsReview.push({ nomorLangganan, jenis, periode })
  }

  printSummary(): void {
    const durationSec = ((Date.now() - this.startedAt.getTime()) / 1000).toFixed(1)
    console.log("\n============================================================")
    console.log(`RINGKASAN SEED — selesai dalam ${durationSec}s`)
    console.log("============================================================")
    for (const [step, c] of this.counts) {
      console.log(
        `  ${step.padEnd(28)} dibuat=${c.created} diupdate=${c.updated} tetap=${c.unchanged} dilewati=${c.skipped}`
      )
    }
    console.log(`\nStatus pelanggan berubah: ${this.statusChanges.length} baris`)
    console.log(`Pemutusan perlu review manual (status masih AKTIF): ${this.pemutusanNeedsReview.length}`)
    console.log(`Warning: ${this.warnCount}   Error: ${this.errorCount}`)
    if (this.errorCount > 0) {
      console.log("\nContoh error (maks 20, lihat file laporan untuk semua):")
      for (const issue of this.issues.filter((i) => i.level === "error").slice(0, 20)) {
        console.log(`  [${issue.step}] ${issue.message}${issue.key ? ` (key=${issue.key})` : ""}`)
      }
    }
    console.log("============================================================\n")
  }

  writeToFile(): string {
    const dir = join(process.cwd(), "prisma", "seed", "reports")
    mkdirSync(dir, { recursive: true })
    const filename = `seed-${this.startedAt.toISOString().replace(/[:.]/g, "-")}.json`
    const path = join(dir, filename)
    const payload = {
      startedAt: this.startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      counts: Object.fromEntries(this.counts),
      statusChanges: this.statusChanges,
      pemutusanNeedsReview: this.pemutusanNeedsReview,
      issues: this.issues,
    }
    writeFileSync(path, JSON.stringify(payload, null, 2), "utf-8")
    return path
  }
}
