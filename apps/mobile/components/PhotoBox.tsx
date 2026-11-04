/**
 * photo-box.tsx — kotak unggah + pratinjau SATU foto bukti (padanan
 * `KotakFotoBukti`). Dipakai BERSAMA layar Lapor Pengaduan & Lapor Meter
 * supaya ukurannya IDENTIK. Label/deskripsi dirender layar pemanggil; yang
 * disamakan hanya KOTAK-nya.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from './theme/ThemeContext';

/** Rasio cadangan sebelum ukuran asli foto diketahui (4:3, lazim dari kamera). */
const RASIO_BAWAAN = 4 / 3;

export interface PhotoBoxProps {
  /** URI berkas foto yang sudah diambil — null = belum ada foto. */
  uri: string | null;
  onPress?: () => void;
  /** Sedang mengompres/memproses foto (tampilkan spinner). */
  memproses?: boolean;
}

export function PhotoBox({ uri, onPress, memproses = false }: PhotoBoxProps) {
  const { colors, radius } = useTheme();
  const terisi = uri != null;

  /**
   * Rasio foto yang sebenarnya. Sebelumnya kotak ini dipatok setinggi 160 dp
   * dengan `cover`, jadi foto potret maupun lanskap sama-sama dipangkas jadi
   * pita — bagian yang justru penting (angka meter) kerap ikut terpotong.
   *
   * Ukurannya ditanyakan ke berkasnya sendiri lalu dipasang sebagai
   * `aspectRatio`, sehingga kotaknya selebar induk dan tingginya mengikuti
   * proporsi asli foto.
   */
  const [rasio, setRasio] = useState<number | null>(null);

  useEffect(() => {
    if (uri == null) {
      setRasio(null);
      return;
    }
    let aktif = true;
    Image.getSize(
      uri,
      (lebar, tinggi) => {
        if (aktif && tinggi > 0) setRasio(lebar / tinggi);
      },
      // Gagal membaca ukuran bukan alasan menyembunyikan foto — pakai rasio
      // cadangan dan tetap tampilkan.
      () => {
        if (aktif) setRasio(RASIO_BAWAAN);
      },
    );
    return () => {
      aktif = false;
    };
  }, [uri]);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.box,
        terisi ? { width: '100%', aspectRatio: rasio ?? RASIO_BAWAAN } : styles.boxKosong,
        {
          backgroundColor: colors.muted,
          borderColor: terisi ? colors.primary : colors.border,
          borderRadius: radius.sm,
        },
      ]}
    >
      {memproses ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : terisi ? (
        <>
          {/* `contain`, bukan `cover`: kotaknya sudah mengikuti rasio foto,
              jadi tidak ada yang perlu dipangkas. */}
          <Image source={{ uri }} style={styles.preview} resizeMode="contain" />
          <View style={styles.pita}>
            <Ionicons name="checkmark" size={12} color="#FFFFFF" />
            <Text style={styles.pitaText}>Ganti / hapus foto</Text>
          </View>
        </>
      ) : (
        <View style={styles.center}>
          <Ionicons name="camera" size={28} color={colors.mutedForeground} />
          <Text style={[styles.hint, { color: colors.mutedForeground }]}>Ambil foto</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  /** Tinggi tetap hanya dipakai saat KOSONG — di situ tidak ada rasio apa pun. */
  boxKosong: { height: 160 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  hint: { fontSize: 13 },
  preview: { width: '100%', height: '100%' },
  pita: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingVertical: 4,
    backgroundColor: '#000000B3',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  pitaText: { color: '#FFFFFF', fontSize: 11, fontWeight: '600' },
});
