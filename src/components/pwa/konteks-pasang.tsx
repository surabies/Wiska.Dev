"use client"

// components/pwa/konteks-pasang.tsx — seluruh keadaan "pasang aplikasi" di
// satu tempat, plus dialognya.
//
// KENAPA CONTEXT, BUKAN KOMPONEN LEPAS. Versi pertama fitur ini hanya berupa
// dialog otomatis sekali-tampil. Begitu pengguna menekan "Nanti saja", jeda
// 14 hari berlaku dan TIDAK ADA jalan lain untuk memasang — pengguna yang
// berubah pikiran mentok, dan itu justru kelompok yang paling ingin dilayani.
// Dialognya kini bisa dipanggil kapan saja lewat <TombolPasang> yang duduk
// permanen di header, menu mobile, dan footer; context inilah penghubungnya.
//
// Dua jalur pemasangan yang mungkin:
//   - Chromium (Android/desktop) -> browser menembakkan `beforeinstallprompt`.
//     Event itu ditahan (lihat tangkap-prompt-awal.tsx) dan dipakai tombol
//     "Pasang" untuk memanggil dialog pemasangan asli browser.
//   - Selain itu (Safari iOS, Chromium yang belum menembakkan event, dsb)
//     -> tidak ada API apa pun. Satu-satunya yang bisa diberikan adalah
//     panduan manual sesuai browsernya. Dialog ini WAJIB selalu punya
//     jawaban: dipanggil dari tombol permanen, "tidak ada yang bisa
//     ditampilkan" bukan hasil yang boleh terjadi.
import * as React from "react"
import Image from "next/image"
import { Share, SquarePlus, MoreVertical, MonitorDown } from "@/components/ui/hugeicons-compat"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { KUNCI_PROMPT_AWAL } from "./tangkap-prompt-awal"

/** Event non-standar milik Chromium; belum ada di lib.dom TypeScript. */
interface EventBeforeInstallPrompt extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/** Titipan dari skrip inline yang berjalan sebelum React hydrate. */
type WindowDenganPrompt = Window & {
  [KUNCI_PROMPT_AWAL]?: EventBeforeInstallPrompt
}

const KUNCI_TUTUP = "tirtawening:ajakan-pasang-ditutup"
// Berlaku HANYA untuk dialog yang muncul sendiri. Dialog yang dibuka pengguna
// lewat tombol tidak pernah dibatasi jeda ini.
const JEDA_TAWAR_ULANG_MS = 14 * 24 * 60 * 60 * 1000
// Halaman perlu sempat terbaca dulu; dialog yang menyembul bersamaan dengan
// render pertama langsung ditutup sebelum isinya sempat dibaca.
const JEDA_TAMPIL_MS = 2500

type Platform = "ios-safari" | "android" | "desktop" | "tak-didukung" | "server"

/// Dibaca lewat useSyncExternalStore, jadi WAJIB murni dan stabil: nilainya
/// tidak pernah berubah sepanjang umur halaman.
function deteksiPlatform(): Platform {
  const ua = navigator.userAgent
  // iPadOS 13+ menyamar sebagai Mac, jadi dikenali lewat layar sentuh.
  const ios =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)

  if (ios) {
    // Di iOS semua browser memakai WebKit, tapi hanya Safari yang punya menu
    // "Tambahkan ke Layar Utama". Memberi panduan Safari kepada pengguna
    // Chrome iOS = menyuruh mencari tombol yang tidak ada.
    return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? "tak-didukung" : "ios-safari"
  }
  // Firefox desktop/Android tidak mendukung pemasangan PWA sama sekali.
  if (/Firefox/.test(ua)) return "tak-didukung"
  if (/Android/.test(ua)) return "android"
  return "desktop"
}

const berlanggananPlatform = () => () => {}

/// Sudah berjalan sebagai aplikasi terpasang, bukan di dalam tab browser.
function berlanggananTerpasang(saatBerubah: () => void) {
  const mql = window.matchMedia("(display-mode: standalone)")
  mql.addEventListener("change", saatBerubah)
  return () => mql.removeEventListener("change", saatBerubah)
}

function bacaTerpasang() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS tidak mendukung display-mode dan memakai properti sendiri.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function baruSajaDitutup() {
  try {
    const nilai = window.localStorage.getItem(KUNCI_TUTUP)
    if (!nilai) return false
    return Date.now() - Number(nilai) < JEDA_TAWAR_ULANG_MS
  } catch {
    // localStorage bisa melempar di mode privat/iframe terbatas. Anggap saja
    // belum pernah ditutup.
    return false
  }
}

function catatPenutupan() {
  try {
    window.localStorage.setItem(KUNCI_TUTUP, String(Date.now()))
  } catch {
    /* diabaikan, lihat catatan di baruSajaDitutup() */
  }
}

type NilaiKonteks = {
  /** Aplikasi sudah terpasang — pemakai context sebaiknya menyembunyikan diri. */
  terpasang: boolean
  /** Buka dialog atas permintaan pengguna, mengabaikan jeda 14 hari. */
  bukaDialog: () => void
}

const KonteksPasang = React.createContext<NilaiKonteks | null>(null)

/**
 * Dipakai <TombolPasang>. Mengembalikan null bila providernya tidak ada,
 * supaya komponen yang dirender di luar provider (mis. di tes) tidak meledak.
 */
export function usePasang() {
  return React.useContext(KonteksPasang)
}

export function PenyediaPasang({ children }: { children: React.ReactNode }) {
  const platform = React.useSyncExternalStore(
    berlanggananPlatform,
    deteksiPlatform,
    () => "server" as const,
  )
  const terpasang = React.useSyncExternalStore(
    berlanggananTerpasang,
    bacaTerpasang,
    () => false,
  )

  const [promptTertunda, setPromptTertunda] = React.useState<EventBeforeInstallPrompt | null>(null)
  const [terbuka, setTerbuka] = React.useState(false)

  React.useEffect(() => {
    if (terpasang) return

    let timer: ReturnType<typeof setTimeout> | undefined

    // Dialok otomatis hanya untuk yang belum pernah menolak. Yang menolak
    // tetap bisa membukanya sendiri lewat <TombolPasang>.
    const bolehOtomatis = !baruSajaDitutup()

    const simpan = (event: EventBeforeInstallPrompt) => {
      setPromptTertunda(event)
      if (!bolehOtomatis) return
      clearTimeout(timer)
      timer = setTimeout(() => setTerbuka(true), JEDA_TAMPIL_MS)
    }

    // Event mungkin sudah lewat sebelum komponen ini mount — pungut titipan
    // skrip inline lebih dulu.
    const titipan = (window as WindowDenganPrompt)[KUNCI_PROMPT_AWAL]
    if (titipan) simpan(titipan)

    const tangkapPrompt = (event: Event) => {
      // Tanpa preventDefault, Chrome memakai prompt bawaannya sendiri dan
      // event-nya tidak bisa dipakai ulang nanti.
      event.preventDefault()
      simpan(event as EventBeforeInstallPrompt)
    }

    // iOS tidak pernah menembakkan beforeinstallprompt, jadi ajakannya harus
    // dijadwalkan sendiri — kalau tidak, pengguna iOS tak pernah diberi tahu.
    if (bolehOtomatis && platform === "ios-safari") {
      timer = setTimeout(() => setTerbuka(true), JEDA_TAMPIL_MS)
    }

    const setelahTerpasang = () => {
      clearTimeout(timer)
      delete (window as WindowDenganPrompt)[KUNCI_PROMPT_AWAL]
      setPromptTertunda(null)
      setTerbuka(false)
    }

    window.addEventListener("beforeinstallprompt", tangkapPrompt)
    window.addEventListener("appinstalled", setelahTerpasang)
    return () => {
      clearTimeout(timer)
      window.removeEventListener("beforeinstallprompt", tangkapPrompt)
      window.removeEventListener("appinstalled", setelahTerpasang)
    }
  }, [platform, terpasang])

  const bukaDialog = React.useCallback(() => setTerbuka(true), [])

  const nilai = React.useMemo<NilaiKonteks>(
    () => ({ terpasang, bukaDialog }),
    [terpasang, bukaDialog],
  )

  const pasang = async () => {
    if (!promptTertunda) return
    await promptTertunda.prompt()
    await promptTertunda.userChoice
    // Event beforeinstallprompt hanya boleh dipakai SEKALI. Apa pun pilihan
    // pengguna, dialog ditutup; kalau menolak, Chrome menembakkan event baru
    // pada kunjungan berikutnya.
    //
    // Ditutup lewat setTerbuka langsung, BUKAN tolak(): membuka dialog
    // pemasangan asli bukan penolakan, jadi jangan catat jeda 14 hari.
    delete (window as WindowDenganPrompt)[KUNCI_PROMPT_AWAL]
    setPromptTertunda(null)
    setTerbuka(false)
  }

  /// Semua jalan keluar dialog lewat sini (tombol, X, Esc, klik latar).
  const tolak = () => {
    catatPenutupan()
    setTerbuka(false)
  }

  return (
    <KonteksPasang.Provider value={nilai}>
      {children}
      <Dialog open={terbuka} onOpenChange={(o) => !o && tolak()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="items-center text-center">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={72}
              height={72}
              className="size-18 object-contain"
            />
            <DialogTitle className="mt-1 text-lg">Pasang aplikasi Tirtawening</DialogTitle>
            <DialogDescription className="text-balance">
              Cek tagihan, lapor meter, dan pengaduan langsung dari layar utama — tanpa membuka
              browser.
            </DialogDescription>
          </DialogHeader>

          {promptTertunda ? (
            <DialogFooter>
              <Button size="lg" variant="ghost" onClick={tolak}>
                Nanti saja
              </Button>
              <Button size="lg" onClick={pasang}>
                Pasang
              </Button>
            </DialogFooter>
          ) : (
            <>
              <Panduan platform={platform} />
              <DialogFooter>
                <Button size="lg" onClick={tolak}>
                  Mengerti
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </KonteksPasang.Provider>
  )
}

/// Panduan manual, dipakai saat browser tidak menyediakan prompt pemasangan.
function Panduan({ platform }: { platform: Platform }) {
  if (platform === "ios-safari") {
    return (
      <ol className="space-y-2.5 text-sm">
        <Langkah ikon={Share}>
          Ketuk tombol <b className="font-medium">Bagikan</b> di bilah bawah Safari.
        </Langkah>
        <Langkah ikon={SquarePlus}>
          Pilih <b className="font-medium">Tambahkan ke Layar Utama</b>, lalu ketuk{" "}
          <b className="font-medium">Tambah</b>.
        </Langkah>
      </ol>
    )
  }

  if (platform === "android") {
    return (
      <ol className="space-y-2.5 text-sm">
        <Langkah ikon={MoreVertical}>
          Buka menu tiga titik di pojok kanan atas browser.
        </Langkah>
        <Langkah ikon={SquarePlus}>
          Pilih <b className="font-medium">Pasang aplikasi</b> atau{" "}
          <b className="font-medium">Tambahkan ke Layar Utama</b>.
        </Langkah>
      </ol>
    )
  }

  if (platform === "desktop") {
    return (
      <ol className="space-y-2.5 text-sm">
        <Langkah ikon={MonitorDown}>
          Klik ikon pasang di ujung kanan bilah alamat browser.
        </Langkah>
        <Langkah ikon={MoreVertical}>
          Tidak ada ikonnya? Buka menu tiga titik, lalu cari{" "}
          <b className="font-medium">Pasang Tirtawening</b>.
        </Langkah>
      </ol>
    )
  }

  // "tak-didukung" dan "server". Yang terakhir tak pernah sampai ke layar
  // (dialog cuma terbuka di klien), tapi tetap butuh cabang agar tipenya utuh.
  return (
    <p className="text-sm leading-relaxed text-muted-foreground">
      Browser ini belum mendukung pemasangan aplikasi. Buka{" "}
      <b className="font-medium text-foreground">tirtawening</b> lewat Chrome (Android/komputer)
      atau Safari (iPhone/iPad), lalu coba lagi.
    </p>
  )
}

function Langkah({
  ikon: Ikon,
  children,
}: {
  ikon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>
  children: React.ReactNode
}) {
  return (
    <li className="flex gap-2.5">
      <Ikon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>{children}</span>
    </li>
  )
}
