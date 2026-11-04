/**
 * pratinjau-pelanggan.tsx — kartu pratinjau "ini pelanggan Anda?" di bawah
 * input nomor langganan (padanan features/public/langganan/widgets/
 * pratinjau_pelanggan.dart). Dipakai form daftar akun & tambah langganan.
 *
 * Mengambil identitas lewat GET /api/public/pelanggan/:nomor BEGITU nomor
 * genap 11 digit (debounce 500 ms — endpoint di-rate-limit 20/5 menit per IP,
 * jangan fetch per ketukan). Respons untuk nomor lama tidak menimpa nomor baru.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Card } from '@/components/ui/card';
import { useTheme } from '@/components';
import { ApiException } from '@workspace/mobile-core';

import { buatLanggananWargaRepository, type PelangganRingkas } from '../lib/RepositoryLangganan';

export function PratinjauPelanggan({ nomor }: { nomor: string }) {
  const { colors } = useTheme();
  const [repo] = useState(buatLanggananWargaRepository);
  const [memuat, setMemuat] = useState(false);
  const [hasil, setHasil] = useState<PelangganRingkas | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  // Nomor terakhir di-fetch — respons terlambat untuk nomor lama diabaikan.
  const diproses = useRef<string | null>(null);

  const lengkap = nomor.length === 11 && /^\d{11}$/.test(nomor);

  useEffect(() => {
    if (!lengkap) {
      setMemuat(false);
      setHasil(null);
      setGalat(null);
      diproses.current = null;
      return;
    }
    setMemuat(true);
    setHasil(null);
    setGalat(null);
    const timer = setTimeout(async () => {
      diproses.current = nomor;
      try {
        const r = await repo.pratinjau(nomor);
        if (diproses.current !== nomor) return;
        setMemuat(false);
        setHasil(r);
      } catch (e) {
        if (diproses.current !== nomor) return;
        setMemuat(false);
        setGalat(ApiException.is(e) ? e.message : 'Gagal memeriksa nomor.');
      }
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomor]);

  if (!lengkap && !memuat && hasil == null && galat == null) return null;

  if (memuat) {
    return (
      <View style={styles.baris}>
        <ActivityIndicator size="small" color={colors.mutedForeground} />
        <Text style={[styles.teks, { color: colors.mutedForeground }]}>Memeriksa nomor langganan…</Text>
      </View>
    );
  }

  if (galat != null) {
    return (
      <View style={styles.baris}>
        <Ionicons name="alert-circle" size={16} color={colors.destructive} />
        <Text style={[styles.teks, { color: colors.destructive }]}>{galat}</Text>
      </View>
    );
  }

  if (hasil == null) return null;

  return (
    <Card className="gap-0" style={styles.kartu}>
      <View style={styles.kartuRow}>
        <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        <View style={styles.kartuTeks}>
          <Text style={[styles.nama, { color: colors.foreground }]} numberOfLines={1}>{hasil.nama}</Text>
          <Text style={[styles.alamat, { color: colors.mutedForeground }]} numberOfLines={1}>{hasil.alamat}</Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  baris: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  teks: { flex: 1, fontSize: 13 },
  kartu: { marginTop: 10, padding: 12 },
  kartuRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  kartuTeks: { flex: 1 },
  nama: { fontSize: 14, fontWeight: '700' },
  alamat: { fontSize: 12, marginTop: 1 },
});
