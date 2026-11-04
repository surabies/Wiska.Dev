/**
 * antrean-screen.tsx — Upload Data: antrean hasil catat yang belum sampai
 * server.
 *
 * KENAPA ANTREAN INI TERLIHAT. Di Aurora, hasil catat yang ditolak server bisa
 * lenyap tanpa jejak dan baru ketahuan saat closing — pekerjaan sehari hilang
 * tanpa ada yang tahu. Di sini setiap baris tetap ada beserta PESAN GAGAL dari
 * server, sehingga petugas melihat persis apa yang belum beres.
 *
 * TIGA HAL YANG MEMBUAT UNGGAH TIDAK LAGI "SEMUA ATAU TIDAK SAMA SEKALI":
 *
 *   1. PILIH SENDIRI. Baris bisa dicentang satuan atau seluruh satu rute.
 *      Petugas yang membawa ratusan baris di sinyal tipis bisa mengamankan
 *      satu rute lebih dulu alih-alih mempertaruhkan semuanya sekaligus.
 *
 *   2. BERTAHAP MENURUT JENIS. Foto stand bisa diunggah duluan — ia yang
 *      paling menentukan saat verifikasi — lalu rumah dan segel menyusul.
 *      Berkas yang sudah sampai DIINGAT di antrean, jadi percobaan berikutnya
 *      melewatinya alih-alih mengunggah ulang dari nol.
 *
 *      Data bacanya sendiri (angka & kondisi) dikirim TERAKHIR dan SEKALI,
 *      karena server menolak laporan yang sudah tersimpan sebagai DUPLIKAT
 *      tanpa memperbaruinya — jadi ia harus berangkat dengan URL selengkap
 *      mungkin. Itu sebabnya urutannya berkas dulu, teks belakangan.
 *
 *   3. PROGRES YANG TERLIHAT. Sebelumnya hanya ada spinner, sehingga unggah
 *      ratusan baris tak bisa dibedakan dari aplikasi yang menggantung.
 *
 * Menghapus baris = membuang hasil kerja. Karena itu selalu lewat konfirmasi.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import {
  Check,
  CheckCircle2,
  ChevronRight,
  CloudUpload,
  Inbox,
  RotateCw,
  TriangleAlert,
} from 'lucide-react-native';
import { ApiException, labelPeriode, type JenisBerkas } from '@workspace/mobile-core';
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
  UkuranIkon,
  useTheme,
  Tekan,
  useRuangDock,
  JANGKAUAN_SCAN,
} from '@/components';
import { IsiStrip, LayarGradasi, PADDING_ISI } from '@/features/pencatat/components/LayarGradasi';
import { kirimTertunda, ringkasTertunda, type ProgresKirim } from './lib/RepositoryBacaMeter';
import { PilihanUnggah, usePilihanUnggah } from './lib/PilihanUnggah';
import { TANPA_RUTE } from './lib/RuteAntrean';
import type { RingkasAntrean } from './lib/DaoBacaMeter';

/// Apa saja yang IKUT dikirim. Ini PEMILIH, bukan tombol aksi — menyentuhnya
/// hanya mengubah isi kiriman berikutnya, dan satu-satunya yang benar-benar
/// mengirim adalah tombol Kirim di bawah.
type Bagian = JenisBerkas | 'data';
const BAGIAN: { nilai: Bagian; label: string }[] = [
  { nilai: 'stand', label: 'Foto stand' },
  { nilai: 'rumah', label: 'Foto rumah' },
  { nilai: 'segel', label: 'Foto segel' },
  { nilai: 'data', label: 'Data baca' },
];

export function AntreanUploadScreen({ onBukaRute }: { onBukaRute: (kodeRute: string) => void }) {
  const { colors } = useTheme();
  const ruangDock = useRuangDock();
  const terpilih = usePilihanUnggah();
  const [antrean, setAntrean] = useState<RingkasAntrean[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [mengirim, setMengirim] = useState(false);
  const [progres, setProgres] = useState<ProgresKirim | null>(null);
  const [hasil, setHasil] = useState<string | null>(null);
  const [galat, setGalat] = useState<string | null>(null);
  /// Bawaannya SEMUA — perilaku lama "kirim semuanya" tetap jadi jalur biasa;
  /// mematikan sebagian adalah tindakan sadar untuk sinyal yang buruk.
  const [bagian, setBagian] = useState<Set<Bagian>>(
    () => new Set<Bagian>(['stand', 'rumah', 'segel', 'data']),
  );

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      const baris = await ringkasTertunda();
      setAntrean(baris);
      // Tanda pada baris yang sudah tidak ada lagi dibuang, supaya hitungan
      // tidak pernah mengklaim memilih sesuatu yang sudah terkirim.
      PilihanUnggah.pangkas(baris.map((b) => b.idAntrean));
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  // Layar ini hanya menampilkan RUTE. Penandaan per alamat pindah ke layar
  // detail: satu rute bisa berisi ratusan sambungan, dan menumpuknya di sini
  // membuat halaman pertama tidak menjawab pertanyaan pertama petugas —
  // rute mana yang belum beres.
  const rute = useMemo(() => {
    const peta = new Map<string, RingkasAntrean[]>();
    for (const b of antrean) {
      const kunci = b.ruteKode ?? TANPA_RUTE;
      const isi = peta.get(kunci);
      if (isi) isi.push(b);
      else peta.set(kunci, [b]);
    }
    return [...peta.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], 'id'))
      .map(([kode, baris]) => ({
        kode,
        jumlah: baris.length,
        ditandai: baris.filter((b) => terpilih.has(b.idAntrean)).length,
        gagal: baris.filter((b) => b.pesanGagal != null).length,
        berkasSiap: baris.filter((b) => b.jumlahBerkas > 0 && b.berkasTerunggah >= b.jumlahBerkas)
          .length,
      }));
  }, [antrean, terpilih]);

  const idDitandai = useMemo(
    () => antrean.map((b) => b.idAntrean).filter((id) => terpilih.has(id)),
    [antrean, terpilih],
  );
  // Tanpa satu pun tanda, Kirim berlaku untuk SELURUH antrean — jalur harian
  // tidak boleh menuntut petugas mencentang ratusan baris lebih dulu.
  const sasaran = idDitandai.length > 0 ? idDitandai : antrean.map((b) => b.idAntrean);

  const jenisFoto = BAGIAN.filter((b) => b.nilai !== 'data' && bagian.has(b.nilai)).map(
    (b) => b.nilai as JenisBerkas,
  );
  const kirimData = bagian.has('data');

  /** SATU-SATUNYA jalan yang menyentuh jaringan. Dipanggil hanya dari Kirim. */
  const kirim = async () => {
    if (sasaran.length === 0 || bagian.size === 0) return;
    setMengirim(true);
    setHasil(null);
    setGalat(null);
    setProgres(null);
    try {
      const r = await kirimTertunda({
        idAntrean: sasaran,
        jenisFoto,
        // Tanpa "Data baca" tercentang, kiriman berhenti setelah berkas —
        // laporannya tetap di antrean dan bisa dilengkapi nanti.
        hanyaBerkas: !kirimData,
        onProgres: setProgres,
      });
      const kata: string[] = [];
      if (jenisFoto.length > 0) {
        kata.push(
          r.berkasTerunggah > 0
            ? `${r.berkasTerunggah} berkas terunggah`
            : 'tidak ada berkas baru yang perlu diunggah',
        );
      }
      if (kirimData) {
        if (r.terkirim > 0) kata.push(`${r.terkirim} laporan terkirim`);
        if (r.gagal > 0) kata.push(`${r.gagal} ditolak server`);
      }
      if (r.terhentiOffline) kata.push('sisanya menunggu sinyal');
      setHasil(kata.length > 0 ? `${kata.join(' · ')}.` : 'Tidak ada yang perlu dikirim.');
      PilihanUnggah.bersihkan();
      await muat();
    } catch (err) {
      setGalat(err instanceof ApiException ? err.message : 'Gagal mengirim antrean.');
    } finally {
      setMengirim(false);
      setProgres(null);
    }
  };

  const adaGagal = antrean.some((e) => e.pesanGagal != null);
  const persen =
    progres != null && progres.total > 0 ? Math.round((progres.selesai / progres.total) * 100) : 0;

  const kepala = (
    <View style={styles.kepala}>
      {adaGagal ? (
        <GlassPanel padding={Spasi.lg}>
          <View style={styles.ringkasBaris}>
            <Inbox size={UkuranIkon.besar} color={colors.destructive} />
            <Text style={[styles.ringkasIsi, { flex: 1, color: colors.mutedForeground }]}>
              Sebagian ditolak server — baca pesannya di bawah sebelum mencoba lagi.
            </Text>
          </View>
        </GlassPanel>
      ) : null}

      {hasil != null ? (
        <View style={styles.jarak}>
          <Alert icon={CheckCircle2}>
            <AlertTitle>Hasil</AlertTitle>
            <AlertDescription>{hasil}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {galat != null ? (
        <View style={styles.jarak}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Gagal</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {/* PROGRES — menggantikan spinner buta. Menyebut fase, hitungan, dan
          baris yang sedang dikerjakan, karena tiga-tiganya menjawab
          pertanyaan berbeda: sedang apa, sejauh mana, dan masih bergerak? */}
      {progres != null ? (
        <GlassPanel padding={Spasi.lg} style={styles.jarak}>
          <View style={styles.progresBaris}>
            <Text style={[styles.progresJudul, { color: colors.foreground }]}>
              {progres.fase === 'berkas' ? 'Mengunggah berkas' : 'Mengirim data baca'}
            </Text>
            <Text style={[styles.progresAngka, { color: colors.mutedForeground }]}>
              {progres.selesai}/{progres.total}
            </Text>
          </View>
          <Progress value={persen} className="mt-2" />
          {progres.keterangan !== '' ? (
            <Text style={[styles.progresKet, { color: colors.mutedForeground }]} numberOfLines={1}>
              {progres.keterangan}
            </Text>
          ) : null}
        </GlassPanel>
      ) : null}

      {/* BLOK 1 — apa yang ikut dikirim. Diberi kepala sendiri supaya jelas
          ini PEMILIH, bukan tombol yang langsung bekerja. */}
      <View style={[styles.blok, { borderColor: colors.border }]}>
        <Text style={[styles.blokJudul, { color: colors.mutedForeground }]}>Yang ikut dikirim</Text>
        <View style={styles.bagianBaris}>
          {BAGIAN.map((b) => {
            const aktif = bagian.has(b.nilai);
            return (
              <Tekan
                key={b.nilai}
                onPress={() =>
                  setBagian((s) => {
                    const baru = new Set(s);
                    if (baru.has(b.nilai)) baru.delete(b.nilai);
                    else baru.add(b.nilai);
                    return baru;
                  })
                }
                disabled={mengirim}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: aktif }}
                style={({ pressed }) => [
                  styles.bagian,
                  {
                    borderColor: aktif ? colors.primary : colors.border,
                    backgroundColor: aktif ? colors.nadaHijauLatar : 'transparent',
                  },
                  pressed && styles.ditekan,
                ]}
              >
                {aktif ? <Check size={12} color={colors.nadaHijauTinta} strokeWidth={3} /> : null}
                <Text
                  style={[
                    styles.bagianTeks,
                    { color: aktif ? colors.nadaHijauTinta : colors.mutedForeground },
                  ]}
                >
                  {b.label}
                </Text>
              </Tekan>
            );
          })}
        </View>
        <Text style={[styles.blokCatatan, { color: colors.mutedForeground }]}>
          {kirimData
            ? 'Berkas diunggah dulu, data baca menyusul dalam satu kali kirim.'
            : 'Hanya berkas yang diunggah — laporannya tetap di antrean.'}
        </Text>
      </View>

      {/* BLOK 2 — ringkasan penandaan. Kontrolnya ada di layar rute; di sini
          hanya keadaannya, supaya jelas apa yang akan berangkat. */}
      <View style={[styles.blok, { borderColor: colors.border }]}>
        <Text style={[styles.blokJudul, { color: colors.mutedForeground }]}>Laporan yang dikirim</Text>
        <View style={styles.ringkasTanda}>
          <Text style={[styles.pilihTeks, { color: colors.foreground }]}>
            {idDitandai.length > 0 ? 'Hanya yang ditandai' : 'Semua laporan'}
          </Text>
          <Text style={[styles.pilihJumlah, { color: colors.mutedForeground }]}>
            {idDitandai.length > 0 ? `${idDitandai.length}/${antrean.length}` : antrean.length}
          </Text>
        </View>
        <Text style={[styles.blokCatatan, { color: colors.mutedForeground }]}>
          {idDitandai.length > 0
            ? 'Buka rute untuk mengubah tandanya.'
            : 'Buka salah satu rute di bawah bila ingin memilih alamat tertentu saja.'}
        </Text>
      </View>

      <Button
        onPress={() => void kirim()}
        disabled={mengirim || sasaran.length === 0 || bagian.size === 0}
        className={`mt-1 ${Kelas.tombol}`}
      >
        {mengirim ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <CloudUpload size={UkuranIkon.sedang} color={colors.primaryForeground} />
        )}
        <UIText className={Kelas.tombolTeks}>
          {mengirim
            ? 'Mengirim…'
            : kirimData
              ? `Kirim ${sasaran.length} Laporan`
              : // Tanpa "Data baca", yang berangkat hanya berkasnya dan
                // laporannya tetap di antrean — tombolnya harus mengatakan itu.
                `Unggah Berkas ${sasaran.length} Laporan`}
        </UIText>
      </Button>
    </View>
  );

  return (
    <LayarGradasi
      judul="Upload Data"
      subjudul="Hasil catat yang belum sampai server"
      kanan={
        <Tekan
          onPress={() => void muat()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Segarkan"
          style={({ pressed }) => pressed && styles.ditekan}
        >
          <RotateCw size={UkuranIkon.sedang} color="#FFFFFF" />
        </Tekan>
      }
      strip={
        <IsiStrip
          kiri={antrean.length === 0 ? 'Semua sudah terkirim' : `${antrean.length} laporan menunggu`}
          kanan={adaGagal ? `${antrean.filter((e) => e.pesanGagal != null).length} ditolak` : null}
        />
      }
      onSegarkan={() => void muat()}
      sedangMuat={memuat}
      // Syaratnya WAJIB sama persis dengan syarat render di bawah. Sempat
      // berbeda (`antrean.length === 0` saja), sehingga selama pemuatan awal
      // — antrean masih kosong tapi `memuat` true — SectionList dipasang di
      // dalam ScrollView milik LayarGradasi. React Native memperingatkannya
      // dengan benar: virtualisasi mati, dan justru daftar ratusan baris
      // inilah yang paling membutuhkannya.
      gulir={antrean.length === 0 && !memuat}
    >
      {antrean.length === 0 && !memuat ? (
        <View style={styles.kosong}>
          <CheckCircle2 size={40} color={colors.mutedForeground} />
          <Text style={[styles.kosongTeks, { color: colors.mutedForeground }]}>
            Tidak ada laporan yang menunggu dikirim.
          </Text>
        </View>
      ) : (
        <FlatList
          data={rute}
          keyExtractor={(r) => r.kode}
          ListHeaderComponent={kepala}
          renderItem={({ item }) => (
            <KartuRute rute={item} onPress={() => onBukaRute(item.kode)} />
          )}
          // LayarGradasi TIDAK memberi padding saat `gulir={false}` — layarnya
          // yang memasang sendiri lewat PADDING_ISI, dan ruang dock juga
          // harus disisakan di sini, kalau tidak baris terakhir tertutup
          // dock mengambang beserta tombol pindainya.
          contentContainerStyle={[
            styles.daftar,
            { paddingBottom: JANGKAUAN_SCAN + Spasi.lg + ruangDock },
          ]}
        />
      )}

    </LayarGradasi>
  );
}

/**
 * Satu rute sebagai kartu yang bisa dibuka.
 *
 * Angka yang ditampilkan dipilih menurut pertanyaan yang dibawa petugas ke
 * layar ini, berurutan: berapa yang menunggu, berapa yang sudah saya tandai,
 * berapa yang berkasnya sudah aman, dan adakah yang ditolak server.
 */
function KartuRute({
  rute,
  onPress,
}: {
  rute: { kode: string; jumlah: number; ditandai: number; gagal: number; berkasSiap: number };
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Tekan
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Buka rute ${rute.kode}, ${rute.jumlah} laporan`}
      style={({ pressed }) => [
        styles.kartuRute,
        {
          borderColor: rute.ditandai > 0 ? colors.primary : colors.border,
          backgroundColor: colors.permukaan,
        },
        pressed && styles.ditekan,
      ]}
    >
      <View style={styles.kartuIsi}>
        <Text style={[styles.kartuKode, { color: colors.foreground }]}>{rute.kode}</Text>
        <Text style={[styles.kartuMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {rute.jumlah} laporan
          {rute.berkasSiap > 0 ? ` · ${rute.berkasSiap} berkas siap` : ''}
        </Text>
        {rute.gagal > 0 ? (
          <Text style={[styles.kartuGagal, { color: colors.destructive }]}>
            {rute.gagal} ditolak server
          </Text>
        ) : null}
      </View>

      {rute.ditandai > 0 ? (
        <View style={[styles.lencana, { backgroundColor: colors.nadaHijauLatar }]}>
          <Check size={12} color={colors.nadaHijauTinta} strokeWidth={3} />
          <Text style={[styles.lencanaTeks, { color: colors.nadaHijauTinta }]}>
            {rute.ditandai}
          </Text>
        </View>
      ) : null}
      <ChevronRight size={UkuranIkon.kecil} color={colors.mutedForeground} />
    </Tekan>
  );
}

const styles = StyleSheet.create({
  // `gap` hanya berlaku ANTAR anak, dan tombol Kirim adalah anak terakhir —
  // tanpa paddingBottom, kartu rute pertama menempel langsung ke tombolnya.
  kepala: { gap: Spasi.sm, paddingTop: Spasi.md, paddingBottom: Spasi.lg },
  jarak: { marginTop: Spasi.sm },
  ringkasBaris: { flexDirection: 'row', alignItems: 'center', gap: Spasi.md },
  ringkasIsi: { fontSize: Teks.xs, lineHeight: 18 },

  progresBaris: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progresJudul: { fontSize: Teks.sm, fontWeight: Berat.tebal },
  progresAngka: { fontSize: Teks.xs, fontVariant: ['tabular-nums'] },
  progresKet: { fontSize: Teks.xs, marginTop: Spasi.xs },

  ringkasTanda: { flexDirection: 'row', alignItems: 'center', gap: Spasi.sm },
  pilihJumlah: { marginLeft: 'auto', fontSize: Teks.xs, fontVariant: ['tabular-nums'] },
  // `flexShrink` supaya keterangan di kanan MENGALAH, bukan terpotong tepi
  // layar: yang di kiri adalah kontrolnya, yang di kanan hanya penjelasan.
  pilihTeks: { fontSize: Teks.sm },

  blok: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: Spasi.md,
    marginTop: Spasi.sm,
    gap: Spasi.sm,
  },
  blokJudul: {
    fontSize: 10,
    fontWeight: Berat.tebal,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  blokCatatan: { fontSize: Teks.xs, lineHeight: 16 },
  bagianBaris: { flexDirection: 'row', flexWrap: 'wrap', gap: Spasi.sm },
  // Lebar ~separuh supaya jatuh rapi 2x2. Membiarkannya mengikuti panjang
  // teks menghasilkan 3+1 yang timpang — satu chip menggantung sendirian.
  bagian: {
    flexBasis: '47%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: Spasi.sm,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  bagianTeks: { fontSize: Teks.xs, fontWeight: Berat.tebal },

  // borderWidth TETAP 1 di kedua keadaan — hanya WARNANYA yang berubah saat
  // rute ditandai. Dengan hairline, garisnya nyaris tak terlihat selagi abu
  // lalu mendadak tegas begitu jadi hijau, dan kartunya terbaca seolah
  // membesar padahal ukurannya sama. Di React Native tebal garis juga
  // menambah ukuran kotak, jadi menebalkannya saat ditandai memang akan
  // benar-benar menggeser tata letak.
  kartuRute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    padding: Spasi.md,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: Spasi.sm,
  },
  kartuIsi: { flex: 1, minWidth: 0 },
  kartuKode: { fontSize: Teks.base, fontWeight: Berat.tebal },
  kartuMeta: { fontSize: Teks.xs, marginTop: 2 },
  kartuGagal: { fontSize: Teks.xs, marginTop: 4 },
  lencana: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spasi.sm,
    paddingVertical: 3,
    borderRadius: 999,
  },
  lencanaTeks: { fontSize: Teks.xs, fontWeight: Berat.tebal, fontVariant: ['tabular-nums'] },

  daftar: { paddingHorizontal: PADDING_ISI },
  kosong: { alignItems: 'center', gap: Spasi.md, paddingVertical: Spasi.xxl },
  kosongTeks: { fontSize: Teks.sm, textAlign: 'center' },
  ditekan: { opacity: 0.6 },
});
