import * as React from "react"

import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "@/components/ui/hugeicons-compat"

/*
  CATATAN PEMAKAIAN: `className` menempel di PEMBUNGKUS <div>, bukan di
  <select>-nya. Kelas lebar (w-40, flex-1) memang kena sasaran karena <select>
  di dalamnya w-full — tapi kelas TINGGI ("h-9") diam saja tanpa efek, dan itu
  sempat membuat dropdown saringan 32px berjajar dengan kotak cari 36px di
  bilah yang sama. Pakai prop `size` untuk tinggi.
*/
type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  /** `lg` (36px) = ukuran sasaran sentuh untuk bilah saringan yang juga
   *  dipakai dari ponsel. */
  size?: "sm" | "default" | "lg"
}

function NativeSelect({
  className,
  size = "default",
  ...props
}: NativeSelectProps) {
  return (
    <div
      className={cn(
        "group/native-select relative w-fit has-[select:disabled]:opacity-50",
        className
      )}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select
        data-slot="native-select"
        data-size={size}
        /*
          `[&_option]` — INILAH yang membuat daftar pilihan ikut tema gelap.

          Peramban mewarnai <option> di popup native menurut background-color
          <select> induknya. Punya kita `bg-transparent`, jadi popup-nya jatuh
          ke putih bawaan peramban: di tema gelap, daftar saringan di SELURUH
          bilah alat dashboard terbuka sebagai kotak putih dengan teks terang
          yang nyaris tak terbaca. `color-scheme: dark` di globals.css tidak
          menolong justru KARENA warnanya sudah ditentukan penulis.

          Aturannya ditaruh di sini, bukan diserahkan ke tiap pemanggil.
          <NativeSelectOption> di bawah sudah membawa warna yang sama, tapi
          ia harus diingat — dan ternyata tidak: tujuh layar memakai <option>
          polos, sehingga perbaikannya tidak pernah sampai ke bilah alat mana
          pun. Dengan selector keturunan, <option> biasa pun ikut benar.
        */
        className="h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm text-foreground transition-colors outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=lg]:h-9 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-[size=sm]:py-0.5 [&_optgroup]:bg-popover [&_optgroup]:text-popover-foreground [&_option]:bg-popover [&_option]:text-popover-foreground dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
        {...props}
      />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none" aria-hidden="true" data-slot="native-select-icon" />
    </div>
  )
}

/*
  Warna opsi diambil dari token TEMA, bukan dari warna sistem.

  Sebelumnya `bg-[Canvas] text-[CanvasText]`: keduanya warna sistem operasi,
  yang tidak tahu-menahu soal kelas `.dark` aplikasi. Begitu tema aplikasi dan
  tema OS berbeda, daftar pilihan tampil dengan pasangan warna yang salah —
  teks gelap di atas latar gelap. Pasangan `popover`/`popover-foreground`
  memang sudah dijamin kontras di kedua tema.

  Pelengkapnya ada di globals.css: `color-scheme` membuat browser merender
  popup native-nya sendiri mengikuti tema aplikasi.
*/
function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-popover text-popover-foreground", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-popover text-popover-foreground", className)}
      {...props}
    />
  )
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption }
