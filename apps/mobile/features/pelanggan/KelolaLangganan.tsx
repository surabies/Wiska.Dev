/**
 * kelola-langganan-screen.tsx — Kelola nomor langganan tertaut akun (padanan
 * kelola_langganan_screen.dart): lihat semua, tambah (maks 5, dibatasi server),
 * jadikan utama, lepas tautan. Setiap mutasi menyegarkan LanggananSayaCache
 * supaya beranda ikut terbarui.
 */
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { TriangleAlert } from 'lucide-react-native';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Field } from '@/components/ui/field';
import { Text as UIText } from '@/components/ui/text';
import { AppDialog } from '@/components/ui/app-dialog';
import { Badge } from '@/components/ui/badge';
import {
  AppScaffold,
  MasterPalette as P,
  SectionHeader,
  StatusBadge,
  useTheme,
} from '@/components';
import { ApiException, labelStatusPelanggan } from '@workspace/mobile-core';

import { PratinjauPelanggan } from './components/PratinjauPelanggan';
import { buatLanggananWargaRepository, LanggananSayaCache, type LanggananWargaModel } from './lib/RepositoryLangganan';

export function KelolaLanggananScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const [repo] = useState(buatLanggananWargaRepository);

  const [data, setData] = useState<LanggananWargaModel[] | null>(null);
  const [galatMuat, setGalatMuat] = useState<string | null>(null);
  const [nomorBaru, setNomorBaru] = useState('');
  const [galatTambah, setGalatTambah] = useState<string | null>(null);
  const [menambah, setMenambah] = useState(false);
  const [idSibuk, setIdSibuk] = useState<string | null>(null);
  const [hapusTarget, setHapusTarget] = useState<LanggananWargaModel | null>(null);
  const [galatDialog, setGalatDialog] = useState<string | null>(null);

  const muat = async (paksa = false) => {
    setGalatMuat(null);
    try {
      setData(await LanggananSayaCache.muat(paksa));
    } catch (e) {
      setGalatMuat(ApiException.is(e) ? e.message : 'Gagal memuat.');
    }
  };

  useEffect(() => {
    void muat(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tambah = async () => {
    if (!/^\d{11}$/.test(nomorBaru)) {
      setGalatTambah('Nomor langganan harus 11 digit angka.');
      return;
    }
    setMenambah(true);
    setGalatTambah(null);
    try {
      await repo.tambah(nomorBaru);
      setNomorBaru('');
      await muat(true);
    } catch (e) {
      setGalatTambah(ApiException.is(e) ? e.message : 'Gagal menautkan.');
    } finally {
      setMenambah(false);
    }
  };

  const jadikanUtama = async (l: LanggananWargaModel) => {
    setIdSibuk(l.id);
    try {
      await repo.jadikanUtama(l.id);
      await muat(true);
    } catch (e) {
      setGalatDialog(ApiException.is(e) ? e.message : 'Gagal.');
    } finally {
      setIdSibuk(null);
    }
  };

  const hapus = async (l: LanggananWargaModel) => {
    setHapusTarget(null);
    setIdSibuk(l.id);
    try {
      await repo.hapus(l.id);
      await muat(true);
    } catch (e) {
      setGalatDialog(ApiException.is(e) ? e.message : 'Gagal.');
    } finally {
      setIdSibuk(null);
    }
  };

  return (
    <AppScaffold
      title="Nomor Langganan"
      subtitle="Kelola langganan tertaut akun Anda"
      onBack={() => router.back()}
      body={
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {galatMuat != null ? (
            <>
              <Alert icon={TriangleAlert} variant="destructive">
                <AlertTitle>Gagal memuat</AlertTitle>
                <AlertDescription>{galatMuat}</AlertDescription>
              </Alert>
              <View style={styles.retry}>
                <Button variant="outline" onPress={() => muat()} className="h-11 w-full">
                  <UIText>Coba lagi</UIText>
                </Button>
              </View>
            </>
          ) : data == null ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <>
              <View style={styles.list}>
                {data.map((l) => (
                  <BarisLangganan
                    key={l.id}
                    langganan={l}
                    sibuk={idSibuk === l.id}
                    bisaHapus={data.length > 1}
                    onJadikanUtama={l.isUtama ? undefined : () => jadikanUtama(l)}
                    onHapus={() => setHapusTarget(l)}
                  />
                ))}
              </View>

              <SectionHeader judul="Tambah Nomor Langganan" />
              <Text style={[styles.penjelasan, { color: colors.mutedForeground }]}>
                Berlangganan lebih dari satu sambungan? Tautkan nomornya di sini supaya semuanya tampil di beranda.
              </Text>
              <View style={styles.tambahForm}>
                <Field
                  value={nomorBaru}
                  onChangeText={(t) => {
                    setNomorBaru(t.replace(/\D/g, '').slice(0, 11));
                    setGalatTambah(null);
                  }}
                  placeholder="11 digit nomor langganan"
                  keyboardType="number-pad"
                  error={galatTambah}
                />
                <PratinjauPelanggan nomor={nomorBaru} />
                <Button onPress={tambah} disabled={menambah || nomorBaru.length !== 11} className="h-11 w-full">
                  {menambah ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : (
                    <Ionicons name="add" size={18} color={colors.primaryForeground} />
                  )}
                  <UIText>{menambah ? 'Menautkan…' : 'Tautkan Nomor Ini'}</UIText>
                </Button>
              </View>
            </>
          )}
        </ScrollView>
      }
    >
      <AppDialog
        visible={hapusTarget != null}
        onDismiss={() => setHapusTarget(null)}
        title="Lepas Tautan Langganan?"
        description={
          hapusTarget != null
            ? `Nomor ${hapusTarget.nomorLangganan} (${hapusTarget.nama}) akan dilepas dari akun Anda. Data pelanggannya sendiri tidak berubah — Anda bisa menautkannya kembali kapan saja.`
            : ''
        }
        actions={
          <>
            <Button variant="destructive" onPress={() => hapusTarget && hapus(hapusTarget)} className="h-11 w-full">
              <UIText>Lepas Tautan</UIText>
            </Button>
            <Button variant="outline" onPress={() => setHapusTarget(null)} className="h-11 w-full">
              <UIText>Batal</UIText>
            </Button>
          </>
        }
      />
      <AppDialog
        visible={galatDialog != null}
        onDismiss={() => setGalatDialog(null)}
        title="Gagal"
        description={galatDialog ?? ''}
        actions={
          <Button onPress={() => setGalatDialog(null)} className="h-11 w-full">
            <UIText>Tutup</UIText>
          </Button>
        }
      />
    </AppScaffold>
  );
}

function BarisLangganan({
  langganan: l,
  sibuk,
  bisaHapus,
  onJadikanUtama,
  onHapus,
}: {
  langganan: LanggananWargaModel;
  sibuk: boolean;
  bisaHapus: boolean;
  onJadikanUtama?: () => void;
  onHapus: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card className="gap-0" style={styles.baris}>
      <View style={styles.barisTop}>
        <View style={styles.barisInfo}>
          <View style={styles.namaRow}>
            <Text style={[styles.nama, { color: colors.foreground }]} numberOfLines={1}>{l.nama}</Text>
            {l.isUtama ? <Badge><UIText>Utama</UIText></Badge> : null}
          </View>
          <Text style={[styles.nomor, { color: colors.mutedForeground }]}>{l.nomorLangganan}</Text>
          <Text style={[styles.alamat, { color: colors.mutedForeground }]} numberOfLines={1}>{l.alamatLengkap}</Text>
        </View>
        <StatusBadge
          label={labelStatusPelanggan[l.status] ?? l.status}
          tone={l.status === 'AKTIF' ? 'success' : 'warning'}
        />
      </View>
      <View style={styles.barisBawah}>
        {/* Netral, bukan merah/hijau: lihat catatan di kartu-langganan.tsx —
            angka "tunggakan" lama sebenarnya seluruh tagihan yang pernah
            terbit, karena data pembayaran belum pernah masuk. */}
        <Text style={[styles.tunggakan, { color: colors.mutedForeground }]} numberOfLines={2}>
          {`${l.jumlahTagihanBelumBayar} tagihan tercatat`}
        </Text>
        <View style={styles.barisAksi}>
          {onJadikanUtama != null ? (
            <Button variant="ghost" disabled={sibuk} onPress={onJadikanUtama} className="h-9">
              <UIText>Jadikan Utama</UIText>
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" disabled={sibuk || !bisaHapus} onPress={onHapus} className="h-9 w-9">
            {sibuk ? (
              <ActivityIndicator size="small" color={colors.destructive} />
            ) : (
              <Ionicons name="trash-outline" size={16} color={colors.destructive} />
            )}
          </Button>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 48 },
  retry: { marginTop: 12 },
  loading: { paddingVertical: 48, alignItems: 'center' },
  list: { gap: 10 },
  penjelasan: { fontSize: 13, lineHeight: 18 },
  tambahForm: { marginTop: 12, gap: 12 },
  baris: { padding: 14 },
  barisTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  barisInfo: { flex: 1 },
  namaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nama: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  nomor: { fontSize: 12.5, letterSpacing: 1.2, marginTop: 2 },
  alamat: { fontSize: 12, marginTop: 1 },
  barisBawah: { marginTop: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  tunggakan: { flex: 1, fontSize: 12, fontWeight: '600' },
  barisAksi: { flexDirection: 'row', alignItems: 'center' },
});
