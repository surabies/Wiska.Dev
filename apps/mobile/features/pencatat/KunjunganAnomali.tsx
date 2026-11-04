/**
 * kunjungan-screen.tsx — merekam hasil kunjungan ke satu sambungan anomali.
 *
 * BENTUKNYA SENGAJA MENIRU LAYAR CATAT METER. Begitu petugas bertemu penghuni
 * dan meternya ternyata bisa dibaca, yang ia kerjakan memang persis pekerjaan
 * pencatat: mengetik angka, memeriksa segel, memotret stand/segel/rumah. Kalau
 * layar ini memakai tata letak sendiri, satu orang yang mengerjakan dua peran
 * harus mengingat dua alur untuk satu tindakan yang sama — dan bukti yang
 * terkumpul jadi tidak setara saat verifikator membandingkannya.
 *
 * ANGKA METER TIDAK LANGSUNG JADI PEMBACAAN RESMI. Bila petugas berhasil
 * membaca meternya, angka itu masuk ANTREAN VERIFIKASI lewat jalur yang sama
 * dengan pencatatan biasa (ring V1->V2->V3). Alasannya ditulis di layar agar
 * petugas tidak mengira pekerjaannya belum tersimpan: angka ini mengubah
 * tagihan, dan satu orang di lapangan tidak boleh mengubah tagihan tanpa
 * pemeriksaan kedua.
 *
 * BEDA DARI CATAT METER, dan bedanya melekat pada pekerjaannya:
 *   - hasil kunjungan (8 pilihan) menentukan sisa layar; sebagian besar hasil
 *     TIDAK menuntut angka meter sama sekali;
 *   - tidak ada stand lalu, deviasi, maupun estimasi tagihan — sambungan ini
 *     berbulan-bulan tidak terbaca, jadi tidak ada pembanding yang jujur;
 *   - kunjungan dikirim SATU PER SATU (lihat catatan di repository.ts), jadi
 *     layar ini menunggu jaringan alih-alih menumpuk antrean.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  Check,
  ChevronLeft,
  CircleAlert,
  Images,
  MapPin,
  MapPinOff,
  Trash2,
  TriangleAlert,
} from 'lucide-react-native';
import { ApiConfig, ApiException, type JenisBerkas } from '@workspace/mobile-core';
import { LABEL_KATEGORI } from '@workspace/domain/anomali';

import {
  Berat,
  GlassPanel,
  Kelas,
  Radius,
  Spasi,
  Teks,
  TinggiBaris,
  UkuranIkon,
  useTheme,
  Tekan,
} from '@/components';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppDialog } from '@/components/ui/app-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select-field';
import { Textarea } from '@/components/ui/textarea';
import { Text as UIText } from '@/components/ui/text';
import { IsiStrip, LayarGradasi } from '@/features/pencatat/components/LayarGradasi';
import { MediaError, ambilFoto, type SumberMedia } from '@/features/shared/MediaLokal';
import { simpanSalinanFoto } from '@/features/pencatat/lib/BackupLokal';
import { pantauPosisi, posisiSekarang, type Posisi } from '@/features/pencatat/lib/LokasiPetugas';
import { kirimKunjungan, type BarisAnomali, type HasilKunjungan } from './lib/RepositoryAnomali';

/// Urutannya disengaja: yang PALING SERING terjadi di atas, supaya petugas
/// tidak menggulir untuk kasus yang biasa.
const PILIHAN_HASIL: { nilai: HasilKunjungan; label: string }[] = [
  { nilai: 'TETAP_TERKUNCI', label: 'Tetap terkunci' },
  { nilai: 'BERTEMU_TERBACA', label: 'Bertemu & meter terbaca' },
  { nilai: 'BERTEMU_TIDAK_TERBACA', label: 'Bertemu, meter tak terbaca' },
  { nilai: 'KOSONG_TERKONFIRMASI', label: 'Terkonfirmasi kosong' },
  { nilai: 'METER_DIPINDAH', label: 'Meter dipindah' },
  { nilai: 'PERLU_GANTI_METER', label: 'Perlu ganti meter' },
  { nilai: 'USUL_TUTUP_SEMENTARA', label: 'Usul tutup sementara' },
  { nilai: 'ALAMAT_TIDAK_DITEMUKAN', label: 'Alamat tidak ditemukan' },
];

/// Tiga slot yang SAMA dengan pencatatan rutin — bukan kemiripan kebetulan:
/// berkasnya menempuh endpoint yang sama dan berakhir di kolom yang sama.
/// Video sengaja tidak ada di sini: kunjungan anomali dikirim seketika, dan
/// menunggu unggahan video di gang tanpa sinyal menahan petugas di tempat.
const SLOT_FOTO: JenisBerkas[] = ['stand', 'segel', 'rumah'];

const LABEL_SLOT: Partial<Record<JenisBerkas, string>> = {
  stand: 'Stand Meter',
  segel: 'Segel',
  rumah: 'Rumah',
};

export function KunjunganAnomaliScreen({
  baris,
  periode,
  onBack,
  onSelesai,
}: {
  baris: BarisAnomali;
  periode: number;
  onBack: () => void;
  onSelesai: () => void;
}) {
  const { colors } = useTheme();

  const [hasil, setHasil] = useState<HasilKunjungan | null>(null);
  const [stand, setStand] = useState('');
  /** null = tidak diperiksa; true/false = kondisi segel yang ditemukan. */
  const [isSegel, setIsSegel] = useState<boolean | null>(null);
  const [catatan, setCatatan] = useState('');

  const [fotoPaths, setFotoPaths] = useState<Partial<Record<JenisBerkas, string>>>({});
  const [memproses, setMemproses] = useState<JenisBerkas | null>(null);
  const [slotDialog, setSlotDialog] = useState<JenisBerkas | null>(null);
  const [konfirmasi, setKonfirmasi] = useState<string | null>(null);

  const [posisi, setPosisi] = useState<Posisi | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [sukses, setSukses] = useState<string | null>(null);

  const lepasPantau = useRef<(() => void) | null>(null);

  const butuhStand = hasil === 'BERTEMU_TERBACA';
  /// Foto stand wajib HANYA saat meternya memang terbaca — foto itulah bukti
  /// angka yang kelak mengubah tagihan. Untuk hasil lain, memaksa foto stand
  /// berarti menyuruh memotret meter yang justru tidak bisa dilihat.
  const fotoStandWajib = butuhStand && !ApiConfig.isDemo;

  /**
   * Mengganti hasil MEMBUANG isian yang menyertai pembacaan. Angka, kondisi
   * segel, dan berkas bukti hanya tampil untuk "Bertemu & meter terbaca";
   * tanpa pembersihan ini, isian yang terlanjur diketik tetap ikut terkirim
   * dari balik layar yang sudah menyembunyikannya — kunjungan berbunyi "tetap
   * terkunci" sambil melampirkan foto stand meter yang katanya tak terlihat.
   */
  const pilihHasil = (nilai: HasilKunjungan) => {
    setHasil(nilai);
    if (nilai !== 'BERTEMU_TERBACA') {
      setStand('');
      setIsSegel(null);
      setFotoPaths({});
    }
  };

  // ── Lokasi ──────────────────────────────────────────────────────────

  const mulaiGps = useCallback(async () => {
    // Bukti kehadiran, bukan syarat. Izin ditolak atau GPS mati TIDAK boleh
    // membuang hasil kerja lapangan yang sudah benar.
    const awal = await posisiSekarang();
    if (awal != null) setPosisi(awal);
    lepasPantau.current?.();
    lepasPantau.current = await pantauPosisi(setPosisi);
  }, []);

  useEffect(() => {
    void mulaiGps();
    return () => {
      lepasPantau.current?.();
      lepasPantau.current = null;
    };
  }, [mulaiGps]);

  // ── Berkas bukti ────────────────────────────────────────────────────

  const ambilBerkas = async (jenis: JenisBerkas, sumber: SumberMedia) => {
    setSlotDialog(null);
    setMemproses(jenis);
    setGalat(null);
    try {
      const mentah = await ambilFoto(sumber);
      if (mentah == null) return;
      // Salinan di folder cadangan yang jadi path utama — cache picker bisa
      // dibersihkan OS sebelum unggahannya sempat jalan.
      const disalin = await simpanSalinanFoto({
        jenis,
        periode,
        nomorLangganan: baris.nomorLangganan,
        sumberPath: mentah,
      });
      setFotoPaths((f) => ({ ...f, [jenis]: disalin ?? mentah }));
    } catch (err) {
      setGalat(
        err instanceof MediaError ? err.message : 'Berkas tidak dapat diproses — coba ambil ulang.',
      );
    } finally {
      setMemproses(null);
    }
  };

  const hapusBerkas = (jenis: JenisBerkas) => {
    setSlotDialog(null);
    setFotoPaths((f) => {
      const salin = { ...f };
      delete salin[jenis];
      return salin;
    });
  };

  // ── Simpan ──────────────────────────────────────────────────────────

  const susunRingkasan = (): string => {
    const pilihan = PILIHAN_HASIL.find((p) => p.nilai === hasil);
    const rincian = [
      `${baris.nama} · ${baris.nomorLangganan}`,
      `Hasil: ${pilihan?.label ?? hasil}`,
    ];
    if (butuhStand) rincian.push(`Angka meter: ${stand} m³ (masuk antrean verifikasi)`);
    if (isSegel != null) rincian.push(`Segel: ${isSegel ? 'tersegel' : 'tidak tersegel'}`);
    rincian.push(`Titik lokasi: ${posisi != null ? 'terekam' : 'TIDAK terekam'}`);
    const berkas = Object.keys(fotoPaths) as JenisBerkas[];
    rincian.push(
      `Foto: ${berkas.length === 0 ? 'tidak ada' : berkas.map((j) => LABEL_SLOT[j]).join(', ')}`,
    );
    if (catatan.trim().length > 0) rincian.push(`Catatan: ${catatan.trim()}`);
    return rincian.join('\n');
  };

  /**
   * Cermin dari `bolehSimpan`, bukan aturan kedua. Kalau keduanya berbeda,
   * petugas melihat tombol menyala lalu ditolak — jauh lebih membingungkan
   * daripada tombol yang jelas belum bisa ditekan.
   */
  const periksaLaluKonfirmasi = () => {
    if (!hasil) {
      setGalat('Pilih dulu hasil kunjungannya.');
      return;
    }
    if (butuhStand && stand.trim() === '') {
      setGalat('Angka meter wajib diisi untuk hasil "Bertemu & meter terbaca".');
      return;
    }
    if (fotoStandWajib && fotoPaths.stand == null) {
      setGalat(
        'Foto stand meter wajib bila angkanya terbaca — foto itulah bukti angka yang kelak mengubah tagihan.',
      );
      return;
    }
    setGalat(null);
    setKonfirmasi(susunRingkasan());
  };

  const kirim = async () => {
    setKonfirmasi(null);
    if (!hasil) return;
    setMengirim(true);
    setGalat(null);
    try {
      const r = await kirimKunjungan({
        pelangganId: baris.pelangganId,
        nomorLangganan: baris.nomorLangganan,
        periode,
        kategori: baris.kategori,
        bulanBerturut: baris.bulanBerturut,
        m3TanpaDasar: baris.m3TanpaDasar,
        hasil,
        standDitemukan: butuhStand ? Number(stand) : undefined,
        fotoPaths,
        isSegel,
        catatan: catatan.trim() || undefined,
        latitude: posisi?.latitude,
        longitude: posisi?.longitude,
      });
      setSukses(r.pesan);
    } catch (e) {
      setGalat(
        e instanceof ApiException && e.status === 0
          ? 'Sambungan terputus — kunjungan belum terkirim. Isian di layar ini masih utuh, coba lagi begitu ada sinyal.'
          : ApiException.is(e)
            ? e.message
            : 'Gagal mengirim. Coba lagi.',
      );
    } finally {
      setMengirim(false);
    }
  };

  const bolehSimpan =
    hasil != null &&
    (!butuhStand || (stand.trim() !== '' && (!fotoStandWajib || fotoPaths.stand != null)));

  // ── Tampilan ────────────────────────────────────────────────────────

  if (sukses) {
    return (
      <LayarGradasi
        judul="Kunjungan Tercatat"
        subjudul={baris.nomorLangganan}
        kiri={
          <Tekan onPress={onSelesai} hitSlop={12} accessibilityRole="button" accessibilityLabel="Kembali">
            <ChevronLeft size={22} color="#FFFFFF" />
          </Tekan>
        }
      >
        <Alert icon={CircleAlert}>
          <AlertTitle>Tersimpan</AlertTitle>
          <AlertDescription>{sukses}</AlertDescription>
        </Alert>
        <View style={styles.jarakAtas}>
          <Button onPress={onSelesai} className={Kelas.tombol}>
            <UIText className={Kelas.tombolTeks}>Kembali ke daftar</UIText>
          </Button>
        </View>
      </LayarGradasi>
    );
  }

  return (
    <LayarGradasi
      // Nama pelanggan menggantikan judul layar, sama seperti catat meter:
      // kesalahan termahal di layar ini adalah mencatat rumah yang salah.
      judul={baris.nama}
      subjudul={baris.nomorLangganan}
      kiri={
        <Tekan
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          style={({ pressed }) => pressed && styles.ditekan}
        >
          <ChevronLeft size={22} color="#FFFFFF" />
        </Tekan>
      }
      kanan={<PenandaGps adaPosisi={posisi != null} />}
      strip={
        <IsiStrip
          kiri={baris.alamat ?? 'Alamat belum tercatat'}
          kanan={`${baris.bulanBerturut} bln`}
        />
      }
      mengambang={
        <TombolSimpanMengambang
          aktif={bolehSimpan}
          mengirim={mengirim}
          onPress={periksaLaluKonfirmasi}
        />
      }
    >
      <GlassPanel padding={Spasi.lg}>
        <Text style={[styles.judulKartu, { color: colors.foreground }]}>Kenapa didatangi</Text>
        <Text style={[styles.paparan, { color: colors.mutedForeground }]}>
          {LABEL_KATEGORI[baris.kategori]} · {baris.bulanBerturut} bulan tidak terbaca ·{' '}
          {baris.m3TanpaDasar.toLocaleString('id-ID')} m³ ditagih tanpa dasar
        </Text>
        {baris.kunjunganTerakhir != null ? (
          <Text style={[styles.paparan, { color: colors.mutedForeground }]}>
            Terakhir dikunjungi {baris.kunjunganTerakhir.periode} · {baris.kunjunganTerakhir.hasil}
          </Text>
        ) : null}
      </GlassPanel>

      {/*
        Bentuknya SAMA dengan "Keterangan Pembacaan" di layar catat meter:
        satu SelectField, bukan delapan baris pilihan yang dijejer. Delapan
        baris memakan hampir seluruh layar dan mendorong panel-panel di
        bawahnya keluar pandangan, sehingga halamannya terbaca sebagai satu
        tumpukan panjang tanpa arah — padahal petugas hanya perlu memilih
        satu hal. Penjelasan tiap hasil tidak hilang, hanya pindah: yang
        tampil adalah penjelasan hasil YANG DIPILIH.
      */}
      <GlassPanel padding={Spasi.lg} style={styles.kartu}>
        <Text style={[styles.judulKartu, { color: colors.foreground }]}>Apa yang ditemukan?</Text>
        <SelectField
          placeholder="Pilih hasil kunjungan…"
          options={PILIHAN_HASIL.map((p) => ({ value: p.nilai, label: p.label }))}
          value={hasil}
          onValueChange={(v) => pilihHasil(v as HasilKunjungan)}
        />
      </GlassPanel>

      {/*
        Bagian pembacaan HANYA muncul saat meternya benar-benar terbaca.
        Menampilkannya sepanjang waktu berarti mengajak mengisi angka untuk
        rumah yang meternya tidak pernah dilihat — persis asal-usul m³ "ditagih
        tanpa dasar" yang membuat sambungan ini masuk daftar.
      */}
      {butuhStand ? (
        <GlassPanel padding={Spasi.lg} style={styles.kartu}>
          <Text style={[styles.judulKartu, { color: colors.foreground }]}>Pembacaan Meter</Text>
          <Text style={[styles.labelKecil, { color: colors.mutedForeground }]}>Angka meter (m³)</Text>
          {/*
            Placeholder "0", BUKAN kalimat perintah. Kolom ini bertipografi
            besar (28px tebal) supaya angkanya terbaca sambil berdiri di depan
            meter — dan kalimat sepanjang "Tulis angka HITAM pada meter" ikut
            mewarisi ukuran itu, memenuhi kolom sampai terpotong. Bentuk yang
            sama sudah dipakai layar catat meter: angka nol yang tenang di
            kolom, dan perintahnya turun menjadi satu baris kecil di bawah —
            tetap terbaca, tanpa berteriak.
          */}
          <Input
            value={stand}
            onChangeText={(v) => setStand(v.replace(/[^0-9]/g, '').slice(0, 7))}
            placeholder="0"
            keyboardType="number-pad"
            className="h-14 text-[28px] font-bold"
          />

          <View style={styles.jarakAtas}>
            <SelectField
              label="Kondisi Segel"
              options={[
                { value: 'belum', label: 'Tidak diperiksa' },
                { value: 'ya', label: 'Tersegel' },
                { value: 'tidak', label: 'Tidak tersegel' },
              ]}
              value={isSegel == null ? 'belum' : isSegel ? 'ya' : 'tidak'}
              onValueChange={(v) => setIsSegel(v === 'belum' ? null : v === 'ya')}
            />
          </View>

          <View style={styles.jarakAtas}>
            <Alert icon={CircleAlert}>
              <AlertDescription>
                Angka ini belum menjadi pembacaan resmi. Ia masuk antrean verifikasi lebih dulu,
                sama seperti pencatatan rutin.
              </AlertDescription>
            </Alert>
          </View>
        </GlassPanel>
      ) : null}

      {/*
        Berkas bukti MENYERTAI pembacaan, jadi ia hanya muncul bersama
        "Bertemu & meter terbaca". Sebelumnya panel ini tampil untuk semua
        hasil dan menempel langsung di bawah daftar pilihan, sehingga layar
        terbaca sebagai satu tumpukan tanpa batas: petugas yang baru memilih
        "Tetap terkunci" tetap disodori tiga slot kamera untuk meter yang
        justru tidak bisa ia lihat.

        Foto untuk hasil lain memang jadi hilang. Itu keputusan yang disengaja
        — bila kelak diperlukan, tempatnya panel bukti tersendiri dengan
        aturannya sendiri, bukan menempel pada pemilihan hasil.
      */}
      {butuhStand ? (
        <GlassPanel padding={Spasi.lg} style={styles.kartu}>
          <Text style={[styles.judulKartu, { color: colors.foreground }]}>Berkas Bukti</Text>
          <View style={styles.slotBaris}>
            {SLOT_FOTO.map((jenis) => (
              <SlotBerkas
                key={jenis}
                label={LABEL_SLOT[jenis] ?? jenis}
                uri={fotoPaths[jenis]}
                memproses={memproses === jenis}
                wajibKosong={jenis === 'stand' && fotoStandWajib && fotoPaths.stand == null}
                onPress={() => setSlotDialog(jenis)}
              />
            ))}
          </View>
        </GlassPanel>
      ) : null}

      <GlassPanel padding={Spasi.lg} style={styles.kartu}>
        <Text style={[styles.labelKecil, { color: colors.mutedForeground }]}>Catatan (opsional)</Text>
        <Textarea
          value={catatan}
          onChangeText={setCatatan}
          placeholder="Mis. penghuni bekerja siang, minta dikunjungi sore"
          numberOfLines={3}
          className={Kelas.areaTeks}
        />
      </GlassPanel>

      {galat != null ? (
        <View style={styles.jarakAtas}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Belum bisa dikirim</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {/* Ruang supaya kartu terakhir tidak tertutup tombol mengambang. */}
      <View style={styles.ruangBawah} />

      {/* ── Dialog ── */}

      <AppDialog
        visible={slotDialog != null}
        onDismiss={() => setSlotDialog(null)}
        title={`Foto ${slotDialog != null ? (LABEL_SLOT[slotDialog] ?? '') : ''}`}
        description="Foto dikompres lalu ikut terkirim bersama hasil kunjungan."
        actions={
          <>
            <Button onPress={() => slotDialog && ambilBerkas(slotDialog, 'kamera')} className={Kelas.tombol}>
              <Camera size={UkuranIkon.kecil} color={colors.primaryForeground} />
              <UIText className={Kelas.tombolTeks}>Kamera</UIText>
            </Button>
            <Button
              variant="outline"
              onPress={() => slotDialog && ambilBerkas(slotDialog, 'galeri')}
              className={Kelas.tombol}
            >
              <Images size={UkuranIkon.kecil} color={colors.foreground} />
              <UIText className={Kelas.tombolTeks}>Galeri</UIText>
            </Button>
            {slotDialog != null && fotoPaths[slotDialog] != null ? (
              <Button
                variant="destructive"
                onPress={() => slotDialog && hapusBerkas(slotDialog)}
                className={Kelas.tombol}
              >
                <Trash2 size={UkuranIkon.kecil} color={colors.destructiveForeground} />
                <UIText className={Kelas.tombolTeks}>Hapus</UIText>
              </Button>
            ) : null}
          </>
        }
      />

      <AppDialog
        visible={konfirmasi != null}
        onDismiss={() => setKonfirmasi(null)}
        title="Konfirmasi Hasil Kunjungan"
        description={konfirmasi ?? ''}
        actions={
          <>
            <Button onPress={kirim} className={Kelas.tombol}>
              <UIText className={Kelas.tombolTeks}>Kirim</UIText>
            </Button>
            <Button variant="outline" onPress={() => setKonfirmasi(null)} className={Kelas.tombol}>
              <UIText className={Kelas.tombolTeks}>Periksa Lagi</UIText>
            </Button>
          </>
        }
      />
    </LayarGradasi>
  );
}

// ── Bagian tampilan ───────────────────────────────────────────────────

/**
 * Penanda GPS di sudut header. Tanpa jarak, berbeda dari catat meter: daftar
 * anomali tidak membawa koordinat pelanggan, jadi tidak ada yang bisa
 * dibandingkan. Yang ditampilkan hanya apakah titiknya terekam — itu yang
 * menentukan kunjungan ini punya bukti kehadiran atau tidak.
 */
function PenandaGps({ adaPosisi }: { adaPosisi: boolean }) {
  return (
    <View style={styles.gps}>
      {adaPosisi ? (
        <MapPin size={UkuranIkon.sedang} color="#FFFFFF" />
      ) : (
        <MapPinOff size={UkuranIkon.sedang} color="rgba(255,255,255,0.55)" />
      )}
      <Text style={[styles.gpsTeks, !adaPosisi && styles.gpsRedup]}>{adaPosisi ? 'aktif' : '—'}</Text>
    </View>
  );
}

/** Slot foto — bentuk dan aturannya sama persis dengan layar catat meter. */
function SlotBerkas({
  label,
  uri,
  memproses,
  wajibKosong,
  onPress,
}: {
  label: string;
  uri?: string;
  memproses: boolean;
  wajibKosong: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const terisi = uri != null;
  return (
    <Tekan
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={terisi ? `Ganti foto ${label}` : `Ambil foto ${label}`}
      style={({ pressed }) => [
        styles.slot,
        {
          borderColor: terisi || wajibKosong ? colors.primary : colors.border,
          borderStyle: wajibKosong ? 'dashed' : 'solid',
          backgroundColor: terisi ? colors.nadaHijauLatar : colors.permukaan,
        },
        pressed && styles.ditekan,
      ]}
    >
      {memproses ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : terisi ? (
        <Image source={{ uri }} style={styles.slotGambar} resizeMode="cover" />
      ) : (
        <Camera size={UkuranIkon.besar} color={colors.mutedForeground} />
      )}
      <Text numberOfLines={1} style={[styles.slotLabel, { color: colors.mutedForeground }]}>
        {label}
      </Text>
    </Tekan>
  );
}

/**
 * Tombol kirim mengambang — kembaran tombol simpan di catat meter, termasuk
 * alasannya: mati sampai isian sah, dan menekannya memunculkan ringkasan
 * lebih dulu. Kunjungan hanya boleh SEKALI per periode; server menolak yang
 * kedua, jadi salah tekan berarti hasil salah yang tidak bisa diulang dari
 * aplikasi.
 */
function TombolSimpanMengambang({
  aktif,
  mengirim,
  onPress,
}: {
  aktif: boolean;
  mengirim: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.dudukanFab, { bottom: insets.bottom + Spasi.xl }]} pointerEvents="box-none">
      <Tekan
        onPress={onPress}
        disabled={mengirim}
        accessibilityRole="button"
        accessibilityLabel="Kirim hasil kunjungan"
        accessibilityState={{ disabled: mengirim }}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: aktif ? colors.primary : colors.muted, borderColor: colors.background },
          aktif && styles.fabAktif,
          pressed && styles.ditekan,
        ]}
      >
        {mengirim ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Check
            size={26}
            strokeWidth={2.6}
            color={aktif ? colors.primaryForeground : colors.mutedForeground}
          />
        )}
      </Tekan>
    </View>
  );
}

const styles = StyleSheet.create({
  kartu: { marginTop: Spasi.md },
  judulKartu: { fontSize: Teks.base, fontWeight: Berat.medium, marginBottom: Spasi.md },
  keteranganKartu: { fontSize: Teks.xs, lineHeight: TinggiBaris.xs, marginTop: Spasi.sm },
  labelKecil: { fontSize: Teks.xs, marginBottom: Spasi.sm },
  paparan: { fontSize: Teks.xs, lineHeight: TinggiBaris.xs },
  jarakAtas: { marginTop: Spasi.md },
  ditekan: { opacity: 0.7 },
  ruangBawah: { height: 72 },

  gps: { flexDirection: 'row', alignItems: 'center', gap: Spasi.xs + 1 },
  gpsTeks: { fontSize: Teks.xs, fontWeight: Berat.semi, color: '#FFFFFF' },
  gpsRedup: { color: 'rgba(255,255,255,0.55)' },


  slotBaris: { flexDirection: 'row', gap: Spasi.md },
  slot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: Radius.kecil,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spasi.sm,
    overflow: 'hidden',
  },
  slotGambar: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  slotLabel: { fontSize: Teks.xs },

  dudukanFab: { position: 'absolute', right: Spasi.xl, alignItems: 'flex-end' },
  fab: {
    width: 56,
    height: 56,
    borderRadius: Radius.bundar,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
  },
  fabAktif: { boxShadow: '0px 8px 20px rgba(5, 150, 105, 0.36)' },
});
