/**
 * hasil-view.tsx — tampilan hasil cek tagihan (padanan cek_tagihan_hasil.dart):
 * kartu pelanggan + ringkasan tunggakan + riwayat tagihan per periode dengan
 * toggle rincian biaya. Nanti dipakai bersama layar petugas (Info Tagihan)
 * supaya rincian tampil identik di kedua aplikasi.
 */
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Text as UIText } from '@/components/ui/text';
import {
  Berat,
  Spasi,
  StatusBadge,
  Teks,
  TinggiBaris,
  toneStatusTagihan,
  useTheme,
} from '@/components';
import {
  type BillModel,
  type CekTagihanResult,
  type CustomerInfo,
  formatM3,
  formatRupiah,
  formatTanggalUtc,
  labelDari,
  labelStatusTagihan,
} from '@workspace/mobile-core';

export function HasilCekTagihanView({ hasil }: { hasil: CekTagihanResult }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stack}>
      <KartuPelanggan pelanggan={hasil.pelanggan} />
      <KartuTunggakan total={hasil.totalTunggakan} />
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Riwayat Tagihan</Text>
      {hasil.tagihan.length === 0 ? (
        <Text style={[styles.kosong, { color: colors.mutedForeground }]}>
          Belum ada tagihan tercatat untuk pelanggan ini.
        </Text>
      ) : (
        hasil.tagihan.map((t, i) => <KartuTagihan key={t.id ?? `${t.periode}-${i}`} tagihan={t} />)
      )}
    </View>
  );
}

function KartuPelanggan({ pelanggan }: { pelanggan: CustomerInfo }) {
  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <CardTitle>{pelanggan.nama}</CardTitle>
            <CardDescription>{`No. Langganan ${pelanggan.nomorLangganan}`}</CardDescription>
          </View>
          {pelanggan.status ? <Badge variant="outline"><UIText>{pelanggan.status}</UIText></Badge> : null}
        </View>
      </CardHeader>
      <CardContent>
        <View style={styles.rincianWrap}>
          <BarisRincian label="Alamat" nilai={pelanggan.alamat ?? '-'} />
          <BarisRincian label="RT / RW" nilai={`${pelanggan.rt ?? '-'} / ${pelanggan.rw ?? '-'}`} />
          <BarisRincian label="Golongan Tarif" nilai={pelanggan.tarifGolongan ?? '-'} />
        </View>
      </CardContent>
    </Card>
  );
}

function KartuTunggakan({ total }: { total: number }) {
  const { colors } = useTheme();
  const lunas = total === 0;
  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-center gap-3">
          <Ionicons
            name={lunas ? 'checkmark-circle' : 'warning'}
            size={28}
            color={lunas ? colors.success : colors.destructive}
          />
          <View className="flex-1">
            <CardTitle>{lunas ? 'Tidak Ada Tunggakan' : 'Total Tunggakan'}</CardTitle>
            <CardDescription>
              {lunas
                ? 'Semua tagihan sudah dibayar.'
                : 'Segera lakukan pembayaran untuk menghindari denda atau pemutusan sambungan.'}
            </CardDescription>
          </View>
          {lunas ? null : (
            <Text style={[styles.tunggakanNilai, { color: colors.destructive }]}>
              {formatRupiah(total)}
            </Text>
          )}
        </View>
      </CardHeader>
    </Card>
  );
}

/** Kartu satu periode tagihan dengan toggle rincian biaya. */
function KartuTagihan({ tagihan: t }: { tagihan: BillModel }) {
  const { colors } = useTheme();
  const [terbuka, setTerbuka] = useState(false);

  return (
    <Card>
      <CardHeader>
        <View className="flex-row items-start justify-between gap-3">
          <View className="flex-1">
            <CardTitle>{t.labelPeriodeTagihan}</CardTitle>
            <CardDescription>
              {t.pemakaianM3 == null ? 'Pemakaian -' : `Pemakaian ${formatM3(t.pemakaianM3)}`}
            </CardDescription>
          </View>
          <StatusBadge label={labelDari(labelStatusTagihan, t.status)} tone={toneStatusTagihan(t.status)} />
        </View>
      </CardHeader>
      <CardContent>
      <View style={styles.tagihanBody}>
        <View style={styles.totalRow}>
          <Text style={[styles.muted, { color: colors.mutedForeground }]}>Total Tagihan</Text>
          <Text style={[styles.totalNilai, { color: colors.foreground }]}>
            {formatRupiah(t.totalTagihan)}
          </Text>
        </View>

        {terbuka ? (
          <View style={styles.detail}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            {t.standLalu != null || t.standAkhir != null ? (
              <BarisRincian label="Stand Meter" nilai={`${t.standLalu ?? '-'} → ${t.standAkhir ?? '-'}`} />
            ) : null}
            {t.jmlHargaAir != null ? <BarisRincian label="Harga Air" nilai={formatRupiah(t.jmlHargaAir)} /> : null}
            {t.beaBeban != null ? <BarisRincian label="Bea Beban" nilai={formatRupiah(t.beaBeban)} /> : null}
            {t.beaAdmin != null ? <BarisRincian label="Bea Admin" nilai={formatRupiah(t.beaAdmin)} /> : null}
            {t.airKotor != null ? <BarisRincian label="Air Kotor" nilai={formatRupiah(t.airKotor)} /> : null}
            {t.lainLain != null && t.lainLain !== 0 ? (
              <BarisRincian label="Lain-lain" nilai={formatRupiah(t.lainLain)} />
            ) : null}
            {t.denda != null && t.denda !== 0 ? <BarisRincian label="Denda" nilai={formatRupiah(t.denda)} /> : null}
            {t.tanggalJatuhTempo != null ? (
              <BarisRincian label="Jatuh Tempo" nilai={formatTanggalUtc(t.tanggalJatuhTempo)} />
            ) : null}
            {t.tanggalBayar != null ? (
              <BarisRincian label="Tanggal Bayar" nilai={formatTanggalUtc(t.tanggalBayar)} />
            ) : null}
          </View>
        ) : null}

        <Text
          onPress={() => setTerbuka((v) => !v)}
          style={[styles.toggle, { color: colors.primary }]}
          suppressHighlighting
        >
          {terbuka ? 'Tutup Rincian  ▲' : 'Lihat Rincian  ▼'}
        </Text>
      </View>
      </CardContent>
    </Card>
  );
}

function BarisRincian({ label, nilai }: { label: string; nilai: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.baris}>
      <Text style={[styles.barisLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.barisNilai, { color: colors.foreground }]}>{nilai}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  sectionTitle: { fontSize: Teks.base, fontWeight: '700', letterSpacing: -0.3, marginTop: Spasi.xs },
  kosong: { fontSize: Teks.sm, lineHeight: TinggiBaris.sm },
  rincianWrap: { marginTop: Spasi.md },
  tunggakanNilai: { fontSize: Teks.base, fontWeight: '700' },
  tagihanBody: { marginTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { fontSize: Teks.sm },
  totalNilai: { fontSize: Teks.base, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  detail: { marginTop: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 8 },
  toggle: { fontSize: Teks.sm, fontWeight: '600', marginTop: Spasi.md, paddingVertical: Spasi.xs },
  baris: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3 },
  barisLabel: { flex: 1, fontSize: Teks.sm },
  barisNilai: { flex: 2, fontSize: Teks.sm, textAlign: 'right' },
});
