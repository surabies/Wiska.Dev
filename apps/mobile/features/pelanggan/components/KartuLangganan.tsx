/**
 * kartu-langganan.tsx — "kartu pelanggan" satu nomor langganan (padanan
 * widgets/kartu_langganan.dart): gradien HIJAU (rumpun Emerald, terang →
 * medium, tidak gelap) sesuai warna primer tema, disusun seperti kartu resmi
 * (kop berlogo, nomor sebagai tokoh utama, identitas & status di kaki).
 *
 * Lingkaran aksen memakai Slate — bukan warna gradien itu sendiri — supaya
 * ada kedalaman tanpa menambah hue baru di luar 3 warna yang dipakai.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MasterPalette as P } from '@/components';
import { labelStatusPelanggan } from '@workspace/mobile-core';

import type { LanggananWargaModel } from '../lib/RepositoryLangganan';

// Gradien hijau (rumpun Emerald): terang (kiri-atas) → medium (kanan-bawah),
// sengaja TIDAK gelap. Sesuai warna primer tema.
const HERO = [P.emerald400, P.emerald, P.emerald600] as const;

function nomorTerformat(nomor: string): string {
  if (nomor.length !== 11) return nomor;
  return `${nomor.slice(0, 5)} ${nomor.slice(5, 8)} ${nomor.slice(8)}`;
}

export function KartuLangganan({ langganan: l, onPress }: { langganan: LanggananWargaModel; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <LinearGradient colors={HERO} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.kartu}>
        {/* Aksen lingkaran — Slate, kanan-atas. */}
        <View style={styles.aksen} />

        {/* Nomor langganan — tokoh utama (kop brand dihapus; sudah diwakili
            oleh hero beranda). */}
        <View style={styles.nomorRow}>
          <Text style={styles.nomorLabel}>NOMOR LANGGANAN</Text>
          {l.isUtama ? (
            <View style={styles.chip}>
              <Text style={styles.chipTeks}>Utama</Text>
            </View>
          ) : null}
        </View>
        <Text style={styles.nomor} numberOfLines={1}>{nomorTerformat(l.nomorLangganan)}</Text>

        {/* Identitas */}
        <Text style={styles.nama} numberOfLines={1}>{l.nama}</Text>
        <Text style={styles.alamat} numberOfLines={1}>{l.alamatLengkap}</Text>

        {/* Kaki: status + golongan + tunggakan */}
        <View style={styles.kakiChips}>
          <View style={[styles.chip, l.status === 'AKTIF' ? styles.chipAktif : styles.chipNonaktif]}>
            <Text style={styles.chipTeks}>{labelStatusPelanggan[l.status] ?? l.status}</Text>
          </View>
          {l.golonganKode != null ? (
            <View style={styles.chip}>
              <Text style={styles.chipTeks}>Gol. {l.golonganKode}</Text>
            </View>
          ) : null}
        </View>
        {/* Dulu di sini "Tunggakan Rp X · N tagihan", merah. Angkanya adalah
            jumlah SELURUH tagihan yang pernah terbit — karena data pembayaran
            belum pernah masuk, tidak ada satu pun yang berstatus lunas. Yang
            tersisa kini fakta yang memang kita punya: berapa tagihan tercatat. */}
        <View style={styles.kakiTunggakan}>
          <Text style={styles.tunggakanLabel} numberOfLines={1}>
            Tagihan tercatat
          </Text>
          <Text style={[styles.tunggakanNilai, { color: P.slate200 }]} numberOfLines={1}>
            {l.jumlahTagihanBelumBayar} tagihan
          </Text>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  kartu: { borderRadius: 22, padding: 16, overflow: 'hidden' },
  aksen: { position: 'absolute', top: -60, right: -30, width: 200, height: 200, borderRadius: 100, backgroundColor: `${P.slate}66` },
  nomorRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nomorLabel: { fontSize: 9, fontWeight: '600', color: '#E0F2FE8C', letterSpacing: 1.4 },
  nomor: { fontSize: 19, letterSpacing: 2.4, fontWeight: '700', color: '#FFFFFF', marginTop: 3 },
  nama: { fontSize: 14.5, fontWeight: '700', color: '#FFFFFF', marginTop: 10 },
  alamat: { fontSize: 11.5, color: '#E0F2FE99', marginTop: 2 },
  kakiChips: { flexDirection: 'row', gap: 6, marginTop: 12 },
  kakiTunggakan: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FFFFFF1F', borderWidth: StyleSheet.hairlineWidth, borderColor: '#FFFFFF24' },
  chipAktif: { backgroundColor: '#10B98129' },
  chipNonaktif: { backgroundColor: '#F43F5E29' },
  chipTeks: { fontSize: 10.5, fontWeight: '600', color: P.sky100 },
  tunggakanLabel: { flex: 1, fontSize: 10.5, color: '#E0F2FE99' },
  tunggakanNilai: { fontSize: 15, fontWeight: '700', marginLeft: 8 },
});