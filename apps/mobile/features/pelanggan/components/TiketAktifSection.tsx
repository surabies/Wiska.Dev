/**
 * tiket-aktif-section.tsx — blok "Tiket Aktif" di beranda (padanan
 * widgets/tiket_aktif_section.dart). Menjawab pertanyaan pertama pengguna app
 * pengaduan: "bagaimana laporan saya?".
 *
 * Hanya tiket yang masih berjalan, maks 2 baris (beranda = ringkasan). Baris
 * membuka /lacak-tiket. Anonim/kosong = tidak tampil. Sesi kedaluwarsa TIDAK
 * ditampilkan merah — beranda cukup diam (layar Laporan Saya menangani "masuk
 * lagi").
 */
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  GlassPanel,
  SectionHeader,
  StatusBadge,
  toneStatusPengaduan,
  useTheme,
} from '@/components';
import {
  ApiException,
  labelDari,
  labelJenisPengaduan,
  labelStatusPengaduanWarga,
  SesiWarga,
  type ComplaintTicketModel,
} from '@workspace/mobile-core';

import { LaporanSayaCache } from '../lib/RepositoryLaporanWarga';

const MAKS_TAMPIL = 2;

export function TiketAktifSection() {
  const router = useRouter();
  const { colors } = useTheme();
  const [data, setData] = useState<ComplaintTicketModel[] | null>(null);

  const muat = useCallback(async (paksa: boolean) => {
    if (!SesiWarga.sudahMasuk) {
      setData(null);
      return;
    }
    try {
      await LaporanSayaCache.muat(paksa);
      setData(LaporanSayaCache.aktif);
    } catch (e) {
      // Sesi kedaluwarsa → diam (bukan galat merah di beranda).
      if (!(ApiException.is(e) && e.isUnauthorized)) setData(null);
    }
  }, []);

  // Muat ulang tiap kali beranda kembali fokus (status bisa berubah di layar
  // Lacak Tiket).
  useFocusEffect(
    useCallback(() => {
      void muat(false);
    }, [muat]),
  );

  if (!SesiWarga.sudahMasuk || data == null || data.length === 0) return null;

  const tampil = data.slice(0, MAKS_TAMPIL);

  return (
    <View style={styles.wrap}>
      <SectionHeader
        judul="Tiket Aktif"
        aksi={
          <Pressable onPress={() => router.push('/LaporanSaya')} style={styles.lihat} hitSlop={6}>
            <Text style={[styles.lihatTeks, { color: colors.primary }]}>Lihat semua</Text>
            <Ionicons name="chevron-forward" size={14} color={colors.primary} />
          </Pressable>
        }
      />
      <View style={styles.list}>
        {tampil.map((t) => (
          <Pressable key={t.id} onPress={() => router.push(`/LacakTiket?nomor=${t.nomorTiket}`)}>
            <GlassPanel padding={14}>
              <View style={styles.head}>
                <Text style={[styles.nomor, { color: colors.mutedForeground }]}>{t.nomorTiket}</Text>
                <StatusBadge label={labelDari(labelStatusPengaduanWarga, t.status)} tone={toneStatusPengaduan(t.status)} />
              </View>
              <Text style={[styles.judul, { color: colors.foreground }]} numberOfLines={1}>{t.judul}</Text>
              <Text style={[styles.jenis, { color: colors.mutedForeground }]}>{labelDari(labelJenisPengaduan, t.jenis)}</Text>
            </GlassPanel>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  lihat: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  lihatTeks: { fontSize: 13, fontWeight: '600' },
  list: { gap: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nomor: { flex: 1, fontSize: 12.5 },
  judul: { fontSize: 15, fontWeight: '700', marginTop: 4 },
  jenis: { fontSize: 12.5, marginTop: 2 },
});
