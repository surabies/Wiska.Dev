/**
 * daftar-rute-screen.tsx — Baca Meter LANGKAH 1: pilih rute yang dikerjakan
 * hari ini. Padanan `daftar_pelanggan_screen.dart`.
 *
 * Petugas bisa memegang beberapa rute; layar ini menampilkannya sebagai kartu
 * (kode, seksi, progres per rute). Ketuk satu rute → daftar pelanggannya urut
 * nomor urut.
 *
 * Tombol unduh = TARIK ULANG paket rute dari server lalu simpan ke SQLite.
 * Membuka layar ini TIDAK menembak jaringan — ia membaca cache, supaya
 * berpindah layar tetap instan di sinyal yang buruk.
 *
 * TIDAK ADA auto-upload di sini. Hasil catat menunggu di antrean sampai
 * petugas menekan Upload — model Aurora, yang memberi petugas kendali atas
 * kapan kuota dan foto besarnya terkirim.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  CloudDownload,
  CloudUpload,
  Map as MapIcon,
  MapPinOff,
  RotateCw,
  TriangleAlert,
  Database,
} from 'lucide-react-native';
import {
  ApiException,
  formatWaktuLokal,
  labelPeriode,
  type RuteRingkas,
  type RuteSaya,
} from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Text as UIText } from '@/components/ui/text';
import {
  Radius,
  Berat,
  GlassPanel,
  Kelas,
  MasterPalette as P,
  Spasi,
  Teks,
  TinggiBaris,
  TinggiKontrol,
  UkuranIkon,
  useTheme,
  Tekan,
} from '@/components';
import { IsiStrip, LayarGradasi } from '@/features/pencatat/components/LayarGradasi';
import { jumlahTertunda, periodeCatatSekarang, ruteSaya } from './lib/RepositoryBacaMeter';

export function DaftarRuteScreen({
  onBack,
  onBukaRute,
  onBukaAntrean,
}: {
  /** Opsional: sebagai TAB akar, layar ini tidak punya tempat kembali. */
  onBack?: () => void;
  onBukaRute: (kodeRute: string) => void;
  onBukaAntrean: () => void;
}) {
  const { colors } = useTheme();
  const [paket, setPaket] = useState<RuteSaya | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  const [tertunda, setTertunda] = useState(0);
  const [memuat, setMemuat] = useState(false);

  const muat = useCallback(async (paksa = false) => {
    setMemuat(true);
    setGalat(null);
    try {
      const hasil = await ruteSaya({ segarkan: paksa });
      setPaket(hasil);
      setTertunda(await jumlahTertunda());
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal memuat rute.');
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat(false);
  }, [muat]);

  // Kembali dari layar rute: progres bisa berubah karena baru saja mencatat.
  useFocusEffect(
    useCallback(() => {
      void muat(false);
    }, [muat]),
  );

  const periode = paket?.periode ?? periodeCatatSekarang();

  const targetRute = (r: RuteRingkas) =>
    (paket?.pelanggan ?? []).filter((p) => p.ruteKode === r.kode).length;
  const terbacaRute = (r: RuteRingkas) =>
    (paket?.pelanggan ?? []).filter((p) => p.ruteKode === r.kode && p.sudahDicatat).length;

  const terbacaTotal = paket?.terbaca ?? 0;
  const targetTotal = paket?.target ?? 0;

  return (
    <LayarGradasi
      judul="Baca Meter"
      subjudul={`Pilih rute · ${labelPeriode(periode)}`}
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
      kanan={
        <Tekan
          onPress={() => void muat(true)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Segarkan"
          style={({ pressed }) => pressed && styles.ditekan}
        >
          <RotateCw size={UkuranIkon.sedang} color="#FFFFFF" />
        </Tekan>
      }
      // Strip meringkas seluruh beban kerja hari ini dalam satu baris, jadi
      // petugas tahu posisinya tanpa membaca kartu ringkasan di bawah.
      strip={
        paket != null && paket.rutes.length > 0 ? (
          <IsiStrip
            kiri={`${paket.rutes.length} rute · ${targetTotal} sambungan`}
            kanan={`${terbacaTotal}/${targetTotal}`}
          />
        ) : null
      }
      onSegarkan={() => void muat(true)}
      sedangMuat={memuat}
    >
      {paket == null && galat == null ? (
        <View style={styles.tengah}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : galat != null && paket == null ? (
        <View>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Gagal mengunduh rute</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
          <Button variant="outline" onPress={() => void muat(true)} className={`mt-3 ${Kelas.tombol}`}>
            <RotateCw size={UkuranIkon.kecil} color={colors.foreground} />
            <UIText className={Kelas.tombolTeks}>Coba Lagi</UIText>
          </Button>
        </View>
      ) : paket != null && paket.rutes.length === 0 ? (
        <View style={styles.kosong}>
          <MapPinOff size={UkuranIkon.kosong} color={colors.mutedForeground} />
          <Text style={[styles.kosongTeks, { color: colors.mutedForeground }]}>
            Rute belum ditugaskan ke akun Anda. Penugasan diatur admin di dashboard web (menu
            Pemetaan Rute) — hubungi admin bila belum ada, lalu tarik-segarkan halaman ini.
          </Text>
        </View>
      ) : paket != null ? (
        <>
          <RingkasanCatat paket={paket} tertunda={tertunda} onBukaAntrean={onBukaAntrean} />
          <Text style={[styles.subjudulDaftar, { color: colors.foreground }]}>
            Rute Anda hari ini
          </Text>
          {paket.rutes.map((rute) => (
            <KartuRute
              key={rute.id}
              rute={rute}
              target={targetRute(rute)}
              terbaca={terbacaRute(rute)}
              onPress={() => onBukaRute(rute.kode)}
            />
          ))}
        </>
      ) : null}
    </LayarGradasi>
  );
}

function RingkasanCatat({
  paket,
  tertunda,
  onBukaAntrean,
}: {
  paket: RuteSaya;
  tertunda: number;
  onBukaAntrean: () => void;
}) {
  const { colors } = useTheme();
  const rasio = paket.target === 0 ? 0 : paket.terbaca / paket.target;

  return (
    <GlassPanel padding={14}>
      <View style={styles.ringkasanBaris}>
        <View style={[styles.pilRute, { backgroundColor: P.emerald600 }]}>
          <Text style={styles.pilRuteTeks}>{paket.rutes.length} rute</Text>
        </View>
        {/* "Tersimpan", BUKAN "Offline". `dariCache` hanya berarti barisnya
            dibaca dari SQLite — dan itu jalur NORMAL: layar sengaja membaca
            simpanan lebih dulu supaya berpindah layar tidak menembak jaringan
            (lihat `segarkan: false` di repository.ts). Menyebutnya "Offline"
            membuat petugas mengira sinyalnya putus padahal koneksinya sehat,
            lalu ragu apakah hasil kerjanya terkirim. Aplikasi TIDAK tahu ia
            offline di sini; yang ia tahu hanya dari mana datanya datang. */}
        {paket.dariCache ? <ChipKecil ikon={Database} label="Tersimpan" /> : null}
        {/*
          Pressable, BUKAN <Text onPress> yang membungkus chip. ChipKecil
          adalah View, dan View di dalam Text (inline view) wajib berdimensi
          eksplisit di Android — tanpa itu chip "n antre" gepeng dan menimpa
          tetangganya. Pressable memberi perilaku ketuk yang sama tanpa
          menyeret chip ke dalam konteks teks.
        */}
        {tertunda > 0 ? (
          <Tekan onPress={onBukaAntrean} style={({ pressed }) => pressed && styles.ditekan}>
            <ChipKecil ikon={CloudUpload} label={`${tertunda} antre`} />
          </Tekan>
        ) : null}
        <View style={styles.dorong} />
        <Text style={[styles.ringkasanAngka, { color: colors.mutedForeground }]}>
          {paket.terbaca} dari {paket.target} target
        </Text>
      </View>

      <BarProgres rasio={rasio} />

      {paket.diunduhPada != null ? (
        <Text style={[styles.jejakUnduh, { color: colors.mutedForeground }]}>
          Terunduh {formatWaktuLokal(paket.diunduhPada)}
          {paket.dariCache ? ' · dari simpanan, tarik ke bawah untuk menyegarkan' : ''}
        </Text>
      ) : null}
    </GlassPanel>
  );
}

function KartuRute({
  rute,
  target,
  terbaca,
  onPress,
}: {
  rute: RuteRingkas;
  target: number;
  terbaca: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const selesai = target > 0 && terbaca >= target;
  const rasio = target === 0 ? 0 : terbaca / target;

  return (
    <GlassPanel padding={14} onPress={onPress} style={styles.kartuRute}>
      <View style={styles.ruteBaris}>
        <View
          style={[
            styles.ikonRute,
            { backgroundColor: selesai ? P.emerald600 : colors.secondary },
          ]}
        >
          {selesai ? (
            <BadgeCheck size={UkuranIkon.besar} color="#FFFFFF" />
          ) : (
            <MapIcon size={UkuranIkon.besar} color={colors.mutedForeground} />
          )}
        </View>
        <View style={styles.ruteTeks}>
          <Text style={[styles.ruteKode, { color: colors.foreground }]}>Rute {rute.kode}</Text>
          {rute.seksiCater != null ? (
            <Text numberOfLines={1} style={[styles.ruteSeksi, { color: colors.mutedForeground }]}>
              {rute.seksiCater}
            </Text>
          ) : null}
        </View>
        <Text
          style={[
            styles.ruteAngka,
            { color: selesai ? P.emerald600 : colors.foreground },
          ]}
        >
          {terbaca}/{target}
        </Text>
        <ChevronRight size={UkuranIkon.sedang} color={colors.mutedForeground} />
      </View>
      <BarProgres rasio={rasio} />
    </GlassPanel>
  );
}

/**
 * Bar progres sederhana. Sengaja tidak memakai komponen Progress bersama:
 * yang dibutuhkan di sini hanya dua View, dan menariknya lewat primitif
 * beranimasi menambah kerja render di daftar yang bisa berisi puluhan rute.
 */
export function BarProgres({ rasio }: { rasio: number }) {
  const { colors } = useTheme();
  const lebar = `${Math.round(Math.min(1, Math.max(0, rasio)) * 100)}%` as const;
  return (
    <View style={[styles.jalurBar, { backgroundColor: colors.muted }]}>
      <View style={[styles.isiBar, { width: lebar, backgroundColor: P.emerald600 }]} />
    </View>
  );
}

function ChipKecil({
  ikon: Ikon,
  label,
  bahaya = false,
}: {
  ikon: typeof Database;
  label: string;
  bahaya?: boolean;
}) {
  const { colors } = useTheme();
  const warna = bahaya ? colors.destructive : colors.mutedForeground;
  return (
    <View style={[styles.chip, { backgroundColor: colors.muted, borderColor: colors.border }]}>
      <Ikon size={UkuranIkon.kecil - 2} color={warna} />
      <Text style={[styles.chipTeks, { color: warna }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tengah: { paddingVertical: Spasi.xxl + Spasi.lg, alignItems: 'center' },
  kosong: { paddingVertical: Spasi.xxl, alignItems: 'center', gap: Spasi.md },
  kosongTeks: { fontSize: Teks.sm, textAlign: 'center', lineHeight: TinggiBaris.sm },
  ditekan: { opacity: 0.6 },

  ringkasanBaris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.sm,
    marginBottom: Spasi.md,
  },
  pilRute: { paddingHorizontal: Spasi.sm, paddingVertical: Spasi.xs, borderRadius: Radius.kontrol },
  pilRuteTeks: { color: '#FFFFFF', fontSize: Teks.xs, fontWeight: Berat.tebal },
  dorong: { flex: 1 },
  ringkasanAngka: { fontSize: Teks.xs },
  jejakUnduh: { fontSize: Teks.xs, marginTop: Spasi.sm },

  subjudulDaftar: {
    fontSize: Teks.base,
    fontWeight: Berat.tebal,
    marginTop: Spasi.xl,
    marginBottom: Spasi.md,
  },
  kartuRute: { marginBottom: Spasi.md },
  ruteBaris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    marginBottom: Spasi.md,
  },
  ikonRute: {
    width: TinggiKontrol.baku,
    height: TinggiKontrol.baku,
    borderRadius: Radius.kontrol,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ruteTeks: { flex: 1 },
  ruteKode: { fontSize: Teks.sm, fontWeight: Berat.tebal },
  ruteSeksi: { fontSize: Teks.xs, marginTop: 1 },
  ruteAngka: { fontSize: Teks.sm, fontWeight: Berat.tebal },

  // Bar setinggi 10 (dari 8): satu-satunya indikator progres di layar ini,
  // dan dilihat sekilas sambil berjalan.
  jalurBar: { height: 10, borderRadius: Radius.kontrol, overflow: 'hidden' },
  isiBar: { height: '100%', borderRadius: Radius.kontrol },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.xs,
    paddingHorizontal: Spasi.sm,
    paddingVertical: Spasi.xs,
    borderRadius: Radius.bundar,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipTeks: { fontSize: Teks.xs, fontWeight: Berat.semi },
});
