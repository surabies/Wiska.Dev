// features/dashboard/components/pengaduan/detail-tiket/cetak/use-cetak.ts —
// alur cetak: tombol → lembar cetak dirender → tunggu foto selesai dimuat →
// window.print() → lembar dibuang setelah dialog cetak ditutup.
import * as React from "react";

export function useCetak() {
  const [mencetak, setMencetak] = React.useState(false);
  const [tanggalCetak, setTanggalCetak] = React.useState("");

  const mulai = React.useCallback(() => {
    // Dicatat saat tombol ditekan (bukan saat render) supaya render tetap murni.
    setTanggalCetak(new Date().toISOString());
    setMencetak(true);
  }, []);

  React.useEffect(() => {
    if (!mencetak) return;
    let batal = false;
    const selesai = () => setMencetak(false);
    window.addEventListener("afterprint", selesai, { once: true });

    void (async () => {
      // Foto yang belum selesai dimuat akan tercetak kosong.
      const gambar = Array.from(document.querySelectorAll<HTMLImageElement>("#lembar-cetak img"));
      await Promise.all(
        gambar.map((g) =>
          g.complete
            ? null
            : new Promise<void>((ok) => {
                g.onload = g.onerror = () => ok();
              }),
        ),
      );
      if (!batal) window.print();
    })();

    return () => {
      batal = true;
      window.removeEventListener("afterprint", selesai);
    };
  }, [mencetak]);

  return { mencetak, tanggalCetak, mulai };
}
