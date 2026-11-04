/**
 * Rute /info-pelanggan?nomorLangganan=&kodeRute= — Info Pelanggan satu rumah,
 * pintu masuk ke layar catat.
 *
 * Pelanggan dan urutan kunjungannya dibaca dari CACHE LOKAL, bukan dioper
 * lewat parameter navigasi: objek pelanggan terlalu besar untuk URL, dan yang
 * lebih penting, membacanya ulang berarti layar ini selalu melihat status
 * TERBARU alih-alih salinan yang membeku saat layar dibuka.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { PelangganRute } from '@workspace/mobile-core';
import { Kelas, PremiumBackground, Spasi, Teks, TinggiBaris, useTheme } from '@/components';
import { Button } from '@/components/ui/button';
import { Text as UIText } from '@/components/ui/text';
import { InfoPelangganScreen } from '@/features/pencatat/InfoPelanggan';
import { ambilPelanggan, ruteSaya } from '@/features/pencatat/lib/RepositoryBacaMeter';

export default function InfoPelanggan() {
  const { nomorLangganan, kodeRute } = useLocalSearchParams<{
    nomorLangganan: string;
    kodeRute?: string;
  }>();
  const { colors } = useTheme();
  const [pelanggan, setPelanggan] = useState<PelangganRute | null>(null);
  const [urutan, setUrutan] = useState<PelangganRute[]>([]);
  const [siap, setSiap] = useState(false);
  /** Dinaikkan setelah urutan rute berubah — memaksa pembacaan ulang cache. */
  const [versi, setVersi] = useState(0);

  useEffect(() => {
    let batal = false;
    (async () => {
      const target = await ambilPelanggan(nomorLangganan ?? '').catch(() => null);
      const paket = await ruteSaya({ segarkan: false }).catch(() => null);
      if (batal) return;
      setPelanggan(target);
      /*
       * SELURUH rumah rute ini, bukan hanya yang belum dicatat — berbeda dari
       * layar catat yang sengaja melompati yang sudah selesai. Di sini
       * sebelumnya/berikutnya dipakai untuk MENELUSURI rute (termasuk kembali
       * memeriksa rumah yang tadi sudah dibaca), dan daftar yang menyusut
       * setiap satu rumah selesai membuat penelusuran itu mustahil.
       */
      const rute = kodeRute ?? target?.ruteKode ?? null;
      setUrutan((paket?.pelanggan ?? []).filter((p) => rute == null || p.ruteKode === rute));
      setSiap(true);
    })();
    return () => {
      batal = true;
    };
  }, [nomorLangganan, kodeRute, versi]);

  if (!siap) {
    return (
      <PremiumBackground>
        <View style={gaya.tengah}>
          <ActivityIndicator />
        </View>
      </PremiumBackground>
    );
  }

  // Nomor tidak ada di cache: rutenya belum diunduh, atau paketnya diganti
  // unduhan baru yang tidak lagi memuat pelanggan ini. Layar kosong tanpa
  // penjelasan adalah jalan buntu di lapangan — katakan apa yang terjadi dan
  // apa yang harus dilakukan.
  if (pelanggan == null) {
    return (
      <PremiumBackground>
        <View style={gaya.tengah}>
          <Text style={[gaya.pesan, { color: colors.foreground }]}>
            Pelanggan {nomorLangganan} tidak ada di data yang tersimpan di perangkat ini. Buka
            Download Data untuk mengunduh ulang rute Anda, lalu coba lagi.
          </Text>
          <Button variant="outline" onPress={() => router.back()} className={Kelas.tombolBaris}>
            <UIText className={Kelas.tombolTeks}>Kembali</UIText>
          </Button>
        </View>
      </PremiumBackground>
    );
  }

  return (
    <InfoPelangganScreen
      pelanggan={pelanggan}
      urutanKunjungan={urutan}
      onLanjutkan={() =>
        router.push({
          pathname: '/Catat',
          params: { nomorLangganan: pelanggan.nomorLangganan, kodeRute: kodeRute ?? '' },
        })
      }
      // Cache lokal sudah diperbarui repository; ini memaksa layar membacanya
      // ulang supaya nomor urut di kartu dan strip langsung ikut berubah.
      onUrutanBerubah={() => setVersi((v) => v + 1)}
      onPindah={(tujuan) =>
        // `replace`: menelusuri rumah tidak boleh menumpuk layar, kalau tidak
        // tombol kembali menelusuri ulang seluruh rute satu per satu.
        router.replace({
          pathname: '/InfoPelanggan',
          params: { nomorLangganan: tujuan, kodeRute: kodeRute ?? '' },
        })
      }
    />
  );
}

const gaya = StyleSheet.create({
  tengah: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spasi.lg,
    paddingHorizontal: Spasi.xxl,
  },
  pesan: { fontSize: Teks.sm, textAlign: 'center', lineHeight: TinggiBaris.sm },
});
