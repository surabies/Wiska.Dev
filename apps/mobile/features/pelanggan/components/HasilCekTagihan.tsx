/**
 * hasil-view.tsx — tampilan hasil cek tagihan (padanan cek_tagihan_hasil.dart):
 * kartu pelanggan + riwayat tagihan per periode dengan toggle rincian biaya.
 *
 * TIDAK MENAMPILKAN APA PUN TENTANG STATUS PEMBAYARAN — tidak lencana
 * lunas/belum, tidak ringkasan tunggakan. Alasannya di komentar dalam berkas
 * ini dan di features/public/components/hasil-tagihan/header.tsx pada app web:
 * basis data belum pernah menerima data pembayaran, jadi semua penanda itu
 * hanya pantulan hasil impor, bukan bukti bayar.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Text as UIText } from '@/components/ui/text';
import { useTheme } from '@/components';
import {
  type BillModel,
  type CekTagihanResult,
  type CustomerInfo,
  formatM3,
  formatRupiah,
  formatTanggalUtc,
} from '@workspace/mobile-core';

export function HasilCekTagihanView({ hasil }: { hasil: CekTagihanResult }) {
  const { colors } = useTheme();
  return (
    <View style={styles.stack}>
      <KartuPelanggan pelanggan={hasil.pelanggan} />
      {/* KARTU TUNGGAKAN DIHAPUS. `totalTunggakan` dari server adalah jumlah
          SELURUH tagihan berstatus BELUM_BAYAR/JATUH_TEMPO — dan karena data
          pembayaran belum pernah masuk, itu berarti seluruh riwayat tagihan
          warga. Kartunya menampilkannya merah lengkap dengan ancaman
          "pemutusan sambungan", kepada orang yang mungkin sudah lunas. */}
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
          {/* TIDAK ADA LENCANA STATUS PEMBAYARAN — sejajar dengan halaman
              cek-tagihan web. Basis data belum pernah menerima data
              pembayaran: RiwayatPembayaran kosong dan tanggalBayar null di
              seluruh tagihan, sehingga `status` hanyalah pantulan
              jumlahRekTunggak hasil impor, bukan bukti bayar. Menyebut
              "Lunas" pada yang belum membuat warga tidak membayar; menyebut
              "Belum dibayar" pada yang sudah adalah tuduhan. Yang tampil
              cukup periode, pemakaian, dan nominalnya. */}
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
          style={[styles.toggle, { color: colors.systemBlue }]}
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
  sectionTitle: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3, marginTop: 4 },
  kosong: { fontSize: 14, lineHeight: 20 },
  rincianWrap: { marginTop: 12 },
  tagihanBody: { marginTop: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  muted: { fontSize: 13 },
  totalNilai: { fontSize: 17, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  detail: { marginTop: 8 },
  divider: { height: StyleSheet.hairlineWidth, marginBottom: 8 },
  toggle: { fontSize: 14, fontWeight: '600', marginTop: 12, paddingVertical: 4 },
  baris: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 3 },
  barisLabel: { flex: 1, fontSize: 13 },
  barisNilai: { flex: 2, fontSize: 14, textAlign: 'right' },
});
