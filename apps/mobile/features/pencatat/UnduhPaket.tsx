/**
 * unduh-screen.tsx — Download Data: tarik paket rute + master tarif ke
 * perangkat untuk kerja offline. Padanan `download_data_screen.dart`
 * (`DownloadDataActivity` Aurora).
 *
 * Unduhan MENGGANTI paket rute yang tersimpan — itu memang tujuannya, karena
 * unduhan baru adalah kebenaran baru. Yang TIDAK pernah ikut terhapus adalah
 * ANTREAN KIRIM: itu hasil kerja petugas yang belum sampai server, dan
 * membuangnya karena seseorang menekan "unduh" tidak bisa diterima. Konfirmasi
 * di layar ini menyatakan itu secara eksplisit.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  CheckCircle2,
  ChevronLeft,
  CloudDownload,
  Database,
  Map as MapIcon,
  Receipt,
  TriangleAlert,
  Upload,
} from 'lucide-react-native';
import {
  ApiException,
  formatWaktuLokal,
  labelPeriode,
  type RuteSaya,
} from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Text as UIText } from '@/components/ui/text';
import {
  Berat,
  GlassPanel,
  Kelas,
  Spasi,
  Teks,
  TinggiBaris,
  UkuranIkon,
  useTheme,
  Tekan,
} from '@/components';
import { DialogKonfirmasi } from '@/features/pencatat/components/DialogKonfirmasi';
import { IsiStrip, LayarGradasi } from '@/features/pencatat/components/LayarGradasi';
import { type Ikon } from '@/features/pencatat/components/WorkspacePetugas';
import {
  jumlahTertunda,
  periodeCatatSekarang,
  ruteSaya,
  type ProgresUnduh,
} from './lib/RepositoryBacaMeter';
import { semuaTarif, unduhTarif } from './lib/TarifAir';

export function UnduhDataScreen({ onBack }: { onBack?: () => void }) {
  const { colors } = useTheme();
  const [paket, setPaket] = useState<RuteSaya | null>(null);
  const [jumlahTarif, setJumlahTarif] = useState(0);
  const [tertunda, setTertunda] = useState(0);
  const [mengunduh, setMengunduh] = useState(false);
  const [progres, setProgres] = useState<ProgresUnduh | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [hasil, setHasil] = useState<string | null>(null);
  const [tanyaGanti, setTanyaGanti] = useState(false);

  /**
   * Keadaan data lokal saat ini TANPA memaksa unduh, supaya layar tetap
   * informatif saat offline. Jumlah tarif dimuat terpisah: ia menyentuh cache
   * yang bisa lambat, dan tidak boleh menahan seluruh layar di balik spinner.
   */
  const muatKeadaan = useCallback(async () => {
    try {
      setPaket(await ruteSaya({ segarkan: false }));
      setTertunda(await jumlahTertunda());
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal membaca data lokal.');
    }
    try {
      setJumlahTarif((await semuaTarif()).size);
    } catch {
      // biarkan 0 — estimasi bukan inti layar ini.
    }
  }, []);

  useEffect(() => {
    void muatKeadaan();
  }, [muatKeadaan]);

  const unduh = async () => {
    setTanyaGanti(false);
    setMengunduh(true);
    setProgres(null);
    setGalat(null);
    setHasil(null);
    try {
      // Rute dulu (inti kerja), master tarif menyusul (pelengkap estimasi).
      // Tarif yang gagal TIDAK menggagalkan unduhan rute.
      const baru = await ruteSaya({ segarkan: true, onProgres: setProgres });
      let tarif = jumlahTarif;
      try {
        tarif = await unduhTarif();
      } catch {
        // estimasi tetap memakai cache lama — bukan penghalang.
      }
      setPaket(baru);
      setJumlahTarif(tarif);
      setHasil(
        baru.ruteKode == null
          ? 'Akun Anda belum ditugaskan rute — penugasan diatur admin di dashboard web (menu Pemetaan Rute). Hubungi admin, lalu unduh lagi.'
          : `Berhasil: ${baru.target} pelanggan ${
              baru.rutes.length > 1 ? `(${baru.rutes.length} rute)` : `rute ${baru.ruteKode}`
            }${tarif > 0 ? ` + ${tarif} golongan tarif` : ''} siap dipakai offline.`,
      );
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal mengunduh.');
    } finally {
      setMengunduh(false);
      setProgres(null);
    }
  };

  const adaRute = paket?.ruteKode != null;

  return (
    <LayarGradasi
      judul="Download Data"
      subjudul="Rute & master tarif untuk kerja offline"
      kiri={
        onBack ? (
          <Tekan
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            style={({ pressed }) => pressed && styles.ditekan}
          >
            <ChevronLeft size={22} color="#FFFFFF" />
          </Tekan>
        ) : null
      }
      // Strip menjawab pertanyaan yang membawa petugas ke layar ini: data di
      // perangkat masih segar atau sudah basi?
      strip={
        <IsiStrip
          kiri={
            paket?.diunduhPada != null
              ? `Terunduh ${formatWaktuLokal(paket.diunduhPada)}`
              : 'Belum pernah diunduh'
          }
          kanan={adaRute ? `${paket?.target ?? 0} SL` : null}
        />
      }
    >
      <GlassPanel padding={0} style={styles.kartu}>
        <BarisData
          ikon={MapIcon}
          judul="Paket rute"
          nilai={
            adaRute
              ? `${paket?.target ?? 0} pelanggan · ${paket?.rutes.length ?? 0} rute`
              : 'Belum diunduh'
          }
          keterangan={
            paket?.diunduhPada != null
              ? `Terunduh ${formatWaktuLokal(paket.diunduhPada)}`
              : null
          }
        />
        <Pemisah />
        <BarisData
          ikon={Receipt}
          judul="Master tarif"
          nilai={jumlahTarif > 0 ? `${jumlahTarif} golongan` : 'Belum diunduh'}
        />
        <Pemisah />
        <BarisData
          ikon={Upload}
          judul="Menunggu upload"
          nilai={`${tertunda} laporan`}
          keterangan={tertunda > 0 ? null : 'Semua hasil catat sudah terkirim.'}
          bahaya={tertunda > 0}
        />
        <Pemisah />
        <BarisData
          ikon={Database}
          judul="Periode kerja"
          nilai={labelPeriode(paket?.periode ?? periodeCatatSekarang())}
        />
      </GlassPanel>

      {hasil != null ? (
        <View style={styles.jarak}>
          <Alert icon={CheckCircle2}>
            <AlertTitle>Selesai</AlertTitle>
            <AlertDescription>{hasil}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {galat != null ? (
        <View style={styles.jarak}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Gagal mengunduh</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {/* PROGRES UNDUH. Fase simpan yang paling lama — menulis ribuan baris
          pelanggan ke SQLite — dan sekarang ia terhitung, bukan lagi spinner
          buta yang tak bisa dibedakan dari macet. */}
      {progres != null ? (
        <GlassPanel padding={Spasi.lg} style={styles.progresPanel}>
          <View style={styles.progresBaris}>
            <Text style={[styles.progresJudul, { color: colors.foreground }]}>
              {progres.fase === 'unduh' ? 'Mengambil dari server' : 'Menyimpan ke perangkat'}
            </Text>
            {progres.total > 0 ? (
              <Text style={[styles.progresAngka, { color: colors.mutedForeground }]}>
                {progres.selesai}/{progres.total}
              </Text>
            ) : null}
          </View>
          <Progress
            value={
              progres.total > 0 ? Math.round((progres.selesai / progres.total) * 100) : undefined
            }
            className="mt-2"
          />
        </GlassPanel>
      ) : null}

      <Button
        onPress={() => (adaRute ? setTanyaGanti(true) : void unduh())}
        disabled={mengunduh}
        className={`mt-4 ${Kelas.tombol}`}
      >
        {mengunduh ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <CloudDownload size={UkuranIkon.sedang} color={colors.primaryForeground} />
        )}
        <UIText className={Kelas.tombolTeks}>
          {mengunduh ? 'Mengunduh…' : adaRute ? 'Unduh Ulang' : 'Unduh Data'}
        </UIText>
      </Button>

      <Text style={[styles.catatan, { color: colors.mutedForeground }]}>
        Unduh saat masih ada sinyal bagus — di lapangan aplikasi bekerja penuh dari data ini.
      </Text>

      <DialogKonfirmasi
        visible={tanyaGanti}
        judul="Unduh Ulang Data?"
        deskripsi={
          'Data rute yang tersimpan akan diganti dengan yang terbaru dari server.' +
          (tertunda > 0
            ? `\n\n${tertunda} hasil catat yang belum terkirim TIDAK akan hilang — tapi kirim dulu lewat Upload Data bila ragu.`
            : '')
        }
        labelKonfirmasi="Unduh"
        onTutup={() => setTanyaGanti(false)}
        onKonfirmasi={unduh}
      />
    </LayarGradasi>
  );
}

function BarisData({
  ikon: IkonBaris,
  judul,
  nilai,
  keterangan,
  bahaya = false,
}: {
  ikon: Ikon;
  judul: string;
  nilai: string;
  keterangan?: string | null;
  bahaya?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.baris}>
      <IkonBaris size={UkuranIkon.besar} color={bahaya ? colors.destructive : colors.mutedForeground} />
      <View style={styles.barisTeks}>
        <Text style={[styles.barisJudul, { color: colors.mutedForeground }]}>{judul}</Text>
        <Text style={[styles.barisNilai, { color: bahaya ? colors.destructive : colors.foreground }]}>
          {nilai}
        </Text>
        <Text style={[styles.barisKeterangan, { color: colors.mutedForeground }]}>
          {keterangan}
        </Text>
      </View>
    </View>
  );
}

function Pemisah() {
  const { colors } = useTheme();
  return <View style={[styles.pemisah, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  progresPanel: { marginTop: Spasi.md },
  progresBaris: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progresJudul: { fontSize: Teks.sm, fontWeight: Berat.tebal },
  progresAngka: { fontSize: Teks.xs, fontVariant: ['tabular-nums'] },
  ditekan: { opacity: 0.7 },
  kartu: { paddingVertical: Spasi.xs },
  baris: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spasi.md,
    padding: Spasi.lg,
  },
  barisTeks: { flex: 1 },
  barisJudul: {
    fontSize: Teks.xs,
    fontWeight: Berat.semi,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  barisNilai: { fontSize: Teks.base, fontWeight: Berat.semi, marginTop: Spasi.xs },
  barisKeterangan: {
    fontSize: Teks.xs,
    marginTop: Spasi.xs,
    lineHeight: TinggiBaris.xs,
  },
  pemisah: { height: StyleSheet.hairlineWidth, marginHorizontal: Spasi.lg },
  jarak: { marginTop: Spasi.lg },
  catatan: {
    fontSize: Teks.xs,
    textAlign: 'center',
    marginTop: Spasi.md,
    lineHeight: TinggiBaris.xs,
  },
});
