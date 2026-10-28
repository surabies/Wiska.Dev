"use client"

// Form berlangganan email di footer (padanan form "Subscribe to our newsletter" di nextjs.org).
// Dibuat client component karena memakai state & onSubmit.
import { useState, type FormEvent } from "react"

type Props = { labelEmail: string; placeholder: string; tombol: string }

export function FooterBerlangganan({ labelEmail, placeholder, tombol }: Props) {
  const [pesan, setPesan] = useState("")

  function kirim(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // TODO: sambungkan ke API berlangganan (Hono) di sini, lalu ganti pesan sesuai hasilnya.
    // Selama API belum ada, tampilkan pesan yang jujur agar pengguna tidak mengira email tersimpan.
    setPesan("Layanan berlangganan belum aktif. Segera hadir.")
  }

  return (
    <>
      {/* Form: tinggi 32px (h-8), input melebar, tombol lebar tetap 90px — sama seperti aslinya */}
      <form onSubmit={kirim} className="mt-4 flex h-8 w-full gap-3">
        {/*
          Pembungkus input: border digambar dengan box-shadow 1px (bukan border) supaya saat
          hover/focus bisa berganti warna + muncul cincin 4px tanpa menggeser layout.
        */}
        <div className="flex max-w-full min-w-0 flex-1 overflow-hidden rounded-md text-sm font-normal shadow-[0_0_0_1px_var(--border)] transition-all duration-150 hover:shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_25%,transparent)] has-focus:shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_40%,transparent),0_0_0_4px_color-mix(in_oklab,var(--foreground)_16%,transparent)]! dark:has-focus:shadow-[0_0_0_1px_color-mix(in_oklab,var(--foreground)_40%,transparent),0_0_0_4px_color-mix(in_oklab,var(--foreground)_24%,transparent)]! [&>input]:h-8 [&>input]:px-3 max-[480px]:[&>input]:text-base">
          <input
            type="email"
            name="email"
            required
            aria-label={labelEmail}
            placeholder={placeholder}
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            data-1p-ignore="true"
            className="order-1 inline-flex w-full min-w-0 appearance-none border-none bg-background text-foreground outline-none placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {/* Tombol: latar putih + border tipis, lebar tetap 90px, hover sedikit menggelap */}
        <button
          type="submit"
          style={{ minWidth: 90, maxWidth: 90 }}
          className="relative flex h-8 cursor-pointer items-center justify-center rounded-md bg-background px-1.5 text-sm font-medium text-foreground shadow-[0_0_0_1px_var(--border)] transition-[background,color,box-shadow] duration-150 ease-in-out outline-none select-none hover:bg-foreground/5 focus-visible:shadow-[0_0_0_1px_var(--border),0_0_0_2px_var(--background),0_0_0_4px_var(--ring)]"
        >
          <span className="inline-block truncate px-1.5">{tombol}</span>
        </button>
      </form>

      {pesan ? (
        <p role="status" aria-live="polite" className="m-0 mt-2 text-sm text-foreground">
          {pesan}
        </p>
      ) : null}
    </>
  )
}