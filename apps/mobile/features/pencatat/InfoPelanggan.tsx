/**
 * info-pelanggan-screen.tsx — halaman yang muncul SETELAH alamat diketuk di
 * daftar rute dan SEBELUM layar catat. Padanan "Info Pelanggan" aplikasi lama
 * (Aurora), dan urutannya disengaja: petugas sampai di depan rumah, memastikan
 * dulu rumahnya benar, baru mengetik angka.
 *
 * KENAPA HALAMAN TERSENDIRI, BUKAN DITUMPUK DI LAYAR CATAT. Layar catat sudah
 * memuat entri stand, kondisi, segel, tiga slot foto, GPS, dan estimasi
 * tagihan. Menambahkan identitas dan histori di atasnya mendorong kolom stand
 * — satu-satunya yang benar-benar diketik — turun ke bawah lipatan, sehingga
 * setiap pencatatan dimulai dengan menggulir melewati informasi yang sudah
 * dibaca. Memisahkannya membuat masing-masing halaman punya satu pekerjaan.
 *
 * HISTORI 3 BULAN ADA DI SINI, bukan di layar catat, karena ia dipakai saat
 * MENJAWAB PELANGGAN ("bulan lalu berapa?"), bukan saat mengetik angka.
 */
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Phone,
  TriangleAlert,
  type LucideProps,
} from 'lucide-react-native';
import { ApiException, formatAngka, type PelangganRute } from '@workspace/mobile-core';
import {
  Berat,
  GlassPanel,
  Kelas,
  MasterPalette as P,
  Radius,
  Spasi,
  Teks,
  TinggiBaris,
  TinggiKontrol,
  UkuranIkon,
  useTheme,
  Tekan,
} from '@/components';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AppDialog } from '@/components/ui/app-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text as UIText } from '@/components/ui/text';
import { IsiStrip, LayarGradasi, PADDING_ISI } from '@/features/pencatat/components/LayarGradasi';
import { pindahkanUrutan } from './lib/RepositoryBacaMeter';

export function InfoPelangganScreen({
  pelanggan,
  urutanKunjungan = [],
  onLanjutkan,
  onPindah,
  onUrutanBerubah,
}: {
  pelanggan: PelangganRute;
  /** Seluruh pelanggan rute ini, urut jalan — dasar tombol sebelum/berikutnya. */
  urutanKunjungan?: PelangganRute[];
  onLanjutkan: () => void;
  onPindah: (nomorLangganan: string) => void;
  /** Dipanggil setelah urutan rute berhasil disusun ulang di server. */
  onUrutanBerubah?: () => void;
}) {
  const insets = useSafeAreaInsets();

  const { sebelumnya, berikutnya } = useMemo(() => {
    const i = urutanKunjungan.findIndex((p) => p.nomorLangganan === pelanggan.nomorLangganan);
    return {
      sebelumnya: i > 0 ? (urutanKunjungan[i - 1] ?? null) : null,
      berikutnya: i >= 0 && i + 1 < urutanKunjungan.length ? (urutanKunjungan[i + 1] ?? null) : null,
    };
  }, [urutanKunjungan, pelanggan.nomorLangganan]);

  /*
   * TANPA PANAH KEMBALI di header. Slot `kiri` menggeser judul ke kanan sejauh
   * lebar ikonnya, sehingga nama dan nomor pelanggan tidak lagi segaris dengan
   * teks rute di strip tepat di bawahnya — ketidaksejajaran yang terbaca di
   * setiap rumah yang dibuka. Kembali tetap lewat gestur/tombol kembali sistem.
   */
  return (
    <LayarGradasi
      judul={pelanggan.nama}
      subjudul={pelanggan.nomorLangganan}
      /*
       * Strip menyebut RUTE, bukan alamat. Alamatnya sudah jadi kepala kartu
       * di bawah — dan menulisnya dua kali dalam satu layar persis membuat
       * halaman terasa penuh tanpa menambah satu keterangan pun. Yang belum
       * disebut di mana-mana justru rutenya: header hanya memuat nama dan
       * nomor langganan, padahal petugas memegang beberapa rute sekaligus.
       */
      strip={
        <IsiStrip
          kiri={pelanggan.ruteKode != null ? `Rute ${pelanggan.ruteKode}` : 'Rute tidak dikenali'}
          kanan={pelanggan.urutan != null ? `#${pelanggan.urutan}` : null}
        />
      }
      mengambang={
        <BilahAksi
          sebelumnya={sebelumnya}
          berikutnya={berikutnya}
          onLanjutkan={onLanjutkan}
          onPindah={onPindah}
        />
      }
    >
      <KartuIdentitas pelanggan={pelanggan} />

      {/*
        Judul dan tabel BERDIRI SENDIRI, tanpa kartu pembungkus. Tabelnya sudah
        punya bingkai dan pita kepala berwarna; membungkusnya lagi dengan kartu
        berarti dua kotak bersarang yang menandai batas hal yang sama.
      */}
      <JudulSeksi teks="Histori 3 Bulan" />
      <TabelHistori riwayat={pelanggan.riwayat} />

      <BarisAksi
        pelanggan={pelanggan}
        anggotaRute={urutanKunjungan}
        onUrutanBerubah={onUrutanBerubah}
      />

      {/*
        Ruang kosong setinggi bilah aksi DITAMBAH safe area. Bilah itu
        MENGAMBANG di atas isi halaman, jadi tanpa bantalan yang cukup, kartu
        terakhir tetap tertutup olehnya bahkan setelah digulir mentok — dan
        tombol Ganti No Urut yang tersembunyi separuh sama saja dengan tidak
        ada. Angkanya diturunkan dari posisi bilah itu sendiri (bottom =
        inset + md, tinggi = TinggiKontrol.baku), bukan ditebak.
      */}
      <View style={{ height: insets.bottom + Spasi.md + TinggiKontrol.baku + Spasi.lg }} />
    </LayarGradasi>
  );
}

/**
 * Judul seksi — label di TENGAH GARIS, bukan teks yang menggantung sendirian.
 *
 * Bentuk ini dipilih karena ia benar-benar mengerjakan tugasnya: garis di kiri
 * dan kanan itulah yang memisahkan identitas rumah dari riwayat tagihannya,
 * sehingga jaraknya tidak perlu dilebar-lebarkan untuk terbaca sebagai
 * pemisah. Versi sebelumnya bersandar pada margin 24 px atas-bawah — ruang
 * kosong yang mahal di layar yang harus memuat kartu, tabel, dan tiga tombol.
 *
 * HURUF BESAR BERJARAK mengikuti pola yang sudah ada di aplikasi ini (label
 * "PERUMDA TIRTAWENING" di layar masuk), jadi ia bukan gaya baru yang berdiri
 * sendiri. Tintanya memakai nada Emerald yang sama dengan pita kepala tabel dan
 * ubin angka di kartu atasnya — satu rumpun dengan warna primer aplikasi.
 */
function JudulSeksi({ teks }: { teks: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.judulSeksi}>
      <View style={[styles.garisSeksi, { backgroundColor: colors.border }]} />
      <Text style={[styles.teksSeksi, { color: colors.nadaHijauTinta }]}>{teks.toUpperCase()}</Text>
      <View style={[styles.garisSeksi, { backgroundColor: colors.border }]} />
    </View>
  );
}

/**
 * Permukaan bernada — pola yang sama dengan kartu metrik beranda: latar lembut
 * serumpun dengan cincin setipis rambut dari tinta yang sama beropasitas
 * rendah. Warnanya SELALU dari token tema (`nadaHijau*`), bukan hex tulis
 * tangan, supaya ubinnya ikut berganti nada saat HP bermode gelap.
 */
function permukaanNada(latar: string, tinta: string): ViewStyle {
  return {
    backgroundColor: latar,
    borderColor: tinta + '2E',
    borderWidth: StyleSheet.hairlineWidth,
  };
}

/**
 * Kartu identitas — padanan "Info Pelanggan" aplikasi lama.
 *
 * DELAPAN BARIS LABEL→NILAI YANG SERAGAM DIBUANG. Bentuk itu memaksa mata
 * membaca kedelapan barisnya dengan bobot yang persis sama, padahal yang
 * dicari petugas di depan pagar cuma satu-dua angka. Sekarang isinya bertingkat:
 * alamat sebagai kepala, empat ANGKA KUNCI sebagai ubin yang bisa dilirik, lalu
 * dua keterangan pendukung di kaki.
 *
 * TIAP KETERANGAN MUNCUL TEPAT SEKALI DI HALAMAN INI. Nomor langganan dan nama
 * sudah jadi judul/subjudul header, rute dan urut catat ada di strip — jadi
 * tidak satu pun diulang di kartu. Alamat justru DIPINDAH ke sini sebagai
 * kepala: di strip ia terpotong satu baris, padahal alamat gang kerap lebih
 * panjang dari itu, dan alamat adalah yang dipakai menemukan rumahnya.
 *
 * SATU RUMPUN WARNA, EMERALD, untuk keempat ubin. Emerald adalah warna primer
 * aplikasi ini — gradasi header, tab aktif, FAB, dan tombol utama semuanya di
 * rumpun itu — jadi aksen halaman ini ikut ke sana alih-alih memperkenalkan
 * biru yang berdiri sendiri. Memberi tiap ubin hue berbeda akan terbaca acak,
 * bukan premium.
 *
 * DUA NOMOR URUT BERDAMPINGAN, dan itu bukan pengulangan. "Urut catat" adalah
 * posisi rumah ini di jalan kaki petugas — diturunkan dari jam kunjungan yang
 * benar-benar terekam, dan itulah yang mengurutkan buku rute. "Urut DPM" adalah
 * posisinya menurut hirarki data (nomor persil), angka untuk dicocokkan dengan
 * berkas DPM. Petugas yang membandingkan dengan aplikasi lama perlu melihat
 * dua-duanya supaya tidak menyangka salah satunya salah.
 *
 * WAKTU CATAT ada di kaki justru karena ia DASAR urutan itu: kalau posisi
 * sebuah rumah terasa aneh, jamnya menjelaskan kenapa.
 */
function KartuIdentitas({ pelanggan }: { pelanggan: PelangganRute }) {
  const { colors } = useTheme();

  const waktu = pelanggan.waktuCatatTerakhir;
  const jam =
    waktu == null
      ? null
      : new Date(waktu).toLocaleString('id-ID', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });

  return (
    <GlassPanel style={styles.kartu}>
      <View style={styles.kepalaAlamat}>
        <Text style={[styles.labelKepala, { color: colors.mutedForeground }]}>Alamat</Text>
        <Text numberOfLines={3} style={[styles.nilaiAlamat, { color: colors.foreground }]}>
          {pelanggan.alamat ?? 'Belum tercatat'}
        </Text>
      </View>

      <View style={styles.gridUbin}>
        <UbinData label="Tarif" nilai={pelanggan.golonganTarif ?? '—'} />
        <UbinData label="No. Meter" nilai={pelanggan.nomorMeter ?? '—'} />
      </View>
      <View style={styles.gridUbin}>
        <UbinData
          label="Urut catat"
          nilai={pelanggan.urutan != null ? `#${pelanggan.urutan}` : '—'}
        />
        <UbinData
          label="Urut DPM"
          nilai={pelanggan.noUrutDpm != null ? `#${pelanggan.noUrutDpm}` : '—'}
        />
      </View>

      <View style={[styles.kaki, { borderTopColor: colors.border }]}>
        {/*
          Kartu dan tombol Telepon memakai penilai yang SAMA — nomor yang
          tampil "—" di sini tidak boleh punya tombol telepon yang menyala.
        */}
        <BarisKaki ikon={Phone} label="No. HP" nilai={hpTerpakai(pelanggan.notelp) ?? '—'} />
        <BarisKaki ikon={Clock} label="Catat terakhir" nilai={jam ?? 'belum pernah'} />
      </View>
    </GlassPanel>
  );
}

/** Satu angka kunci: label kecil di atas, angkanya besar dan tebal di bawah. */
function UbinData({ label, nilai }: { label: string; nilai: string }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.ubin, permukaanNada(colors.nadaHijauLatar, colors.nadaHijauTinta)]}>
      <Text style={[styles.ubinLabel, { color: colors.nadaHijauRedup }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.ubinNilai, { color: colors.nadaHijauTinta }]}>
        {nilai}
      </Text>
    </View>
  );
}

function BarisKaki({
  ikon: Ikon,
  label,
  nilai,
}: {
  ikon: (p: LucideProps) => React.ReactNode;
  label: string;
  nilai: string;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.barisKaki}>
      <Ikon size={UkuranIkon.kecil} color={colors.mutedForeground} />
      <Text style={[styles.labelKaki, { color: colors.mutedForeground }]}>{label}</Text>
      <Text numberOfLines={1} style={[styles.nilaiKaki, { color: colors.foreground }]}>
        {nilai}
      </Text>
    </View>
  );
}

/*
 * TABEL "HISTORI 3 BULAN" — permintaan langsung pencatat meter, dan bentuknya
 * SENGAJA menyalin aplikasi lama: tiga kolom Periode / M3 / Harga, dengan
 * kolom M3 mengeja pengurangannya utuh ("4311 - 4265 = 46").
 *
 * KENAPA MENYALIN, BUKAN MEMPERBAIKI. Petugas memakai kedua aplikasi
 * berdampingan selama masa peralihan. Bentuk yang berbeda memaksa mereka
 * menerjemahkan sendiri setiap kali membandingkan, dan di situlah salah baca
 * lahir. Periode ditulis 202607 — bukan "Jul 2026" — karena itu yang tertera
 * di berkas DPM dan di aplikasi lama.
 *
 * PENGURANGANNYA DIEJA, tidak cuma hasilnya, karena itulah yang membuat
 * angkanya bisa diperiksa di tempat: pelanggan yang menyanggah tagihan
 * ditunjukkan stand awal dan stand akhirnya sekaligus, bukan diminta percaya
 * pada satu angka pemakaian.
 *
 * PEMAKAIAN DIAMBIL APA ADANYA dari `pemakaianM3`, bukan dihitung ulang dari
 * selisih stand. Keduanya kadang tidak cocok di data warisan — aplikasi lama
 * pun menampilkan "4226 - 4226 = 27" — dan menghitung ulang akan MENYEMBUNYIKAN
 * ketidakcocokan itu justru dari orang yang paling bisa mengenalinya.
 *
 * KEPALA TABEL BERWARNA PENUH, seperti aplikasi lama — tapi rumpun Emerald,
 * bukan merah Aurora. Pita gelap di puncak tabel mengerjakan dua hal sekaligus:
 * ia mengikat ketiga kolom menjadi satu benda utuh (tanpa itu, tiga judul
 * abu-abu mengambang terbaca sebagai teks biasa, bukan tabel), dan ia
 * menempatkan histori di rumpun warna primer aplikasi.
 *
 * BARIS PERTAMA DITEBALKAN karena ia periode terbaru — angka yang paling
 * sering ditanyakan pelanggan. Sisanya berseling nada supaya mata tidak
 * kehilangan baris saat menyusuri ke kanan mencari kolom Harga.
 */
function TabelHistori({ riwayat }: { riwayat: PelangganRute['riwayat'] }) {
  const { colors } = useTheme();

  if (riwayat.length === 0) {
    return (
      <Text style={[styles.kosong, { color: colors.mutedForeground }]}>
        Belum ada pembacaan resmi yang tersimpan untuk sambungan ini.
      </Text>
    );
  }

  return (
    <View style={[styles.tabel, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <View style={[styles.barisTabel, styles.kepalaBaris]}>
            <Text style={[styles.kepala, styles.kolomPeriode]}>Periode</Text>
            <Text style={[styles.kepala, styles.kolomM3]}>M3</Text>
            <Text style={[styles.kepala, styles.kolomHarga]}>Harga</Text>
          </View>

          {riwayat.map((r, i) => {
            const terbaru = i === 0;
            return (
              <View
                key={r.periode}
                style={[
                  styles.barisTabel,
                  // Seling nada: baris ganjil memakai permukaan sekunder.
                  i % 2 === 1 && { backgroundColor: colors.permukaan },
                ]}
              >
                <Text
                  style={[
                    styles.sel,
                    styles.kolomPeriode,
                    terbaru && styles.selTerbaru,
                    { color: colors.foreground },
                  ]}
                >
                  {r.periode}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.sel, styles.kolomM3, { color: colors.mutedForeground }]}
                >
                  {`${r.standAkhir ?? '—'} - ${r.standLalu ?? '—'} = ${r.pemakaianM3 ?? '—'}`}
                </Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.sel,
                    styles.kolomHarga,
                    terbaru && styles.selTerbaru,
                    { color: colors.foreground },
                  ]}
                >
                  {r.totalTagihan != null ? formatAngka(r.totalTagihan) : '—'}
                </Text>
              </View>
            );
          })}
    </View>
  );
}

/**
 * No. HP "0" DIPERLAKUKAN SEBAGAI KOSONG di seluruh layar ini. Data warisan
 * menyimpan nol untuk pelanggan tanpa nomor, dan memperlakukannya sebagai
 * nomor sungguhan berarti tombol Telepon menyala lalu gagal di tangan petugas.
 */
function hpTerpakai(notelp: string | null): string | null {
  const n = notelp?.replace(/\s+/g, '') ?? '';
  if (n.length === 0 || /^0+$/.test(n)) return null;
  return n;
}

/*
 * BARIS AKSI — padanan tombol GANTI NO URUT / SHOW MAP / CALL aplikasi lama.
 *
 * TOMBOL YANG DATANYA KOSONG DINONAKTIFKAN, BUKAN DISEMBUNYIKAN. Petugas
 * menghafal posisi tombol; susunan yang berubah-ubah antar-rumah membuat jari
 * mendarat di tombol yang salah.
 *
 * LABELNYA SATU KATA DAN SATU BARIS. Versi sebelumnya mengganti label dengan
 * alasan matinya ("Belum ada titik koordinat") — kalimat yang butuh dua baris,
 * dan pada tombol sesempit sepertiga layar teksnya bertumpuk dengan ikon.
 * Alasannya sekarang hanya hidup di label aksesibilitas; yang mati sudah
 * terbaca dari tintanya yang redup.
 */
function BarisAksi({
  pelanggan,
  anggotaRute,
  onUrutanBerubah,
}: {
  pelanggan: PelangganRute;
  anggotaRute: PelangganRute[];
  onUrutanBerubah?: () => void;
}) {
  const [bukaUrut, setBukaUrut] = useState(false);

  const hp = hpTerpakai(pelanggan.notelp);
  const adaTitik = pelanggan.geoLat != null && pelanggan.geoLong != null;

  const bukaPeta = () => {
    if (!adaTitik) return;
    const lat = pelanggan.geoLat!;
    const lng = pelanggan.geoLong!;
    /*
     * `geo:` lebih dulu — ia membiarkan Android menawarkan aplikasi peta apa
     * pun yang terpasang, termasuk yang punya peta offline. Petugas bekerja di
     * gang sempit yang sinyalnya buruk; memaksa Google Maps lewat URL https
     * berarti memaksa memuat peta dari jaringan. Label `(nama)` membuat
     * penanda di peta terbaca sebagai rumah siapa, bukan sekadar titik.
     */
    const label = encodeURIComponent(pelanggan.nama);
    const geo = `geo:${lat},${lng}?q=${lat},${lng}(${label})`;
    void Linking.openURL(geo).catch(() =>
      Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`).catch(
        () => undefined,
      ),
    );
  };

  return (
    <>
      <View style={styles.aksiBaris}>
        <TombolAksi ikon={ArrowUpDown} label="No Urut" onPress={() => setBukaUrut(true)} aktif />
        <TombolAksi
          ikon={MapPin}
          label="Peta"
          onPress={bukaPeta}
          aktif={adaTitik}
          alasanMati="belum ada titik koordinat"
        />
        <TombolAksi
          ikon={Phone}
          label="Telepon"
          onPress={() => hp != null && void Linking.openURL(`tel:${hp}`).catch(() => undefined)}
          aktif={hp != null}
          alasanMati="belum ada no. HP"
        />
      </View>

      <DialogGantiUrut
        visible={bukaUrut}
        pelanggan={pelanggan}
        anggotaRute={anggotaRute}
        onTutup={() => setBukaUrut(false)}
        onBerhasil={() => {
          setBukaUrut(false);
          onUrutanBerubah?.();
        }}
      />
    </>
  );
}

function TombolAksi({
  ikon: Ikon,
  label,
  onPress,
  aktif,
  alasanMati,
}: {
  ikon: (p: LucideProps) => React.ReactNode;
  label: string;
  onPress: () => void;
  aktif: boolean;
  alasanMati?: string;
}) {
  const { colors } = useTheme();

  return (
    <Tekan
      onPress={onPress}
      disabled={!aktif}
      accessibilityRole="button"
      accessibilityLabel={aktif ? label : `${label} — ${alasanMati ?? 'tidak tersedia'}`}
      accessibilityState={{ disabled: !aktif }}
      style={({ pressed }) => [
        styles.tombolAksi,
        { backgroundColor: colors.permukaan, borderColor: colors.border },
        pressed && aktif && styles.ditekan,
      ]}
    >
      <Ikon size={UkuranIkon.kecil} color={aktif ? colors.primary : colors.mutedForeground} />
      <Text
        numberOfLines={1}
        style={[styles.teksAksi, { color: aktif ? colors.foreground : colors.mutedForeground }]}
      >
        {label}
      </Text>
    </Tekan>
  );
}

/**
 * Ganti No Urut — memindahkan rumah ini ke posisi lain dalam urutan kunjungan.
 *
 * POSISINYA DIKETIK, bukan digeser-seret. Menyeret baris hanya masuk akal
 * untuk perpindahan pendek yang kedua ujungnya terlihat sekali layar; rute di
 * sini berisi ratusan rumah, dan koreksi yang sebenarnya terjadi di lapangan
 * adalah "rumah ini semestinya nomor 12", bukan "geser tiga baris ke atas".
 *
 * NOMOR TETANGGA DITAMPILKAN karena angka tujuan tidak berarti apa-apa tanpa
 * konteks: petugas perlu melihat rumah nomor berapa yang sekarang menempati
 * posisi itu untuk yakin ia menuju tempat yang benar.
 */
function DialogGantiUrut({
  visible,
  pelanggan,
  anggotaRute,
  onTutup,
  onBerhasil,
}: {
  visible: boolean;
  pelanggan: PelangganRute;
  anggotaRute: PelangganRute[];
  onTutup: () => void;
  onBerhasil: () => void;
}) {
  const { colors } = useTheme();
  const [teks, setTeks] = useState('');
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const total = anggotaRute.length;
  const posisi = Number.parseInt(teks, 10);
  const sah = Number.isFinite(posisi) && posisi >= 1 && posisi <= total;

  /** Rumah yang SEKARANG menempati posisi tujuan — konteks bagi angkanya. */
  const penghuniTujuan = useMemo(() => {
    if (!sah) return null;
    const terurut = [...anggotaRute].sort((a, b) => (a.urutan ?? 0) - (b.urutan ?? 0));
    return terurut[posisi - 1] ?? null;
  }, [anggotaRute, posisi, sah]);

  const kirim = async () => {
    setMengirim(true);
    setGalat(null);
    try {
      await pindahkanUrutan(pelanggan, posisi, anggotaRute);
      setTeks('');
      onBerhasil();
    } catch (err) {
      /*
       * Kegagalan jaringan disebut apa adanya. Urutan rute WAJIB online — ia
       * data bersama yang mengubah buku rute semua orang — jadi menyarankan
       * "coba lagi nanti" jauh lebih jujur daripada memberi kesan perubahannya
       * tersimpan diam-diam di perangkat.
       */
      setGalat(
        err instanceof ApiException
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Urutan gagal dikirim. Periksa sinyal Anda lalu coba lagi.',
      );
    } finally {
      setMengirim(false);
    }
  };

  return (
    <AppDialog
      visible={visible}
      onDismiss={() => {
        if (mengirim) return;
        setGalat(null);
        onTutup();
      }}
      title="Ganti No Urut"
      description={`${pelanggan.nama} sekarang di posisi ${
        pelanggan.urutan ?? '—'
      } dari ${total} rumah rute ini. Ketik posisi barunya.`}
      actions={
        <>
          <Button onPress={() => void kirim()} disabled={!sah || mengirim} className={Kelas.tombol}>
            {mengirim ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <UIText className={Kelas.tombolTeks}>Pindahkan</UIText>
            )}
          </Button>
          <Button
            variant="outline"
            onPress={onTutup}
            disabled={mengirim}
            className={Kelas.tombol}
          >
            <UIText className={Kelas.tombolTeks}>Batal</UIText>
          </Button>
        </>
      }
    >
      <View style={styles.isiDialog}>
        <Input
          value={teks}
          onChangeText={(v) => setTeks(v.replace(/[^0-9]/g, ''))}
          placeholder={`1 – ${total}`}
          keyboardType="number-pad"
          className={Kelas.input}
        />

        {teks.length > 0 && !sah ? (
          <Text style={[styles.petunjuk, { color: colors.destructive }]}>
            Posisi harus antara 1 dan {total}.
          </Text>
        ) : penghuniTujuan != null && penghuniTujuan.id !== pelanggan.id ? (
          <Text style={[styles.petunjuk, { color: colors.mutedForeground }]} numberOfLines={2}>
            Posisi {posisi} sekarang ditempati {penghuniTujuan.nama}
            {penghuniTujuan.alamat != null ? ` — ${penghuniTujuan.alamat}` : ''}.
          </Text>
        ) : null}

        <Text style={[styles.petunjuk, { color: colors.mutedForeground }]}>
          Urutan ini dipakai bersama: begitu terkirim, buku rute berubah juga bagi kantor dan
          petugas lain. Butuh sinyal.
        </Text>

        {galat != null ? (
          <View style={styles.jarakAtas}>
            <Alert icon={TriangleAlert} variant="destructive">
              <AlertTitle>Urutan gagal diubah</AlertTitle>
              <AlertDescription>{galat}</AlertDescription>
            </Alert>
          </View>
        ) : null}
      </View>
    </AppDialog>
  );
}

/**
 * Bilah aksi mengambang — padanan PREV / LANJUTKAN / NEXT aplikasi lama.
 *
 * LANJUTKAN DIBUAT PALING LEBAR DAN BERWARNA karena ia satu-satunya tujuan
 * halaman ini; sebelumnya/berikutnya cuma penelusuran. Keduanya dinonaktifkan
 * di ujung rute, bukan disembunyikan — tombol yang hilang-timbul membuat
 * posisi tombol lain bergeser tepat saat jari sudah menuju ke sana.
 */
function BilahAksi({
  sebelumnya,
  berikutnya,
  onLanjutkan,
  onPindah,
}: {
  sebelumnya: PelangganRute | null;
  berikutnya: PelangganRute | null;
  onLanjutkan: () => void;
  onPindah: (nomorLangganan: string) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.dudukanBilah, { bottom: insets.bottom + Spasi.md }]}
      pointerEvents="box-none"
    >
      <TombolPindah
        arah="sebelumnya"
        tujuan={sebelumnya}
        onPindah={onPindah}
      />

      {/*
        "Baca Meter", bukan "Lanjutkan". Label yang menyebut PEKERJAANNYA
        memberi tahu petugas apa yang menunggu di balik tombol; "Lanjutkan"
        hanya menyatakan bahwa ada sesuatu berikutnya. Tanpa ikon pula — teks
        dua kata di tombol selebar layar sudah tidak mungkin salah baca, dan
        ikon pena di sebelahnya cuma mengulang hal yang sama.
      */}
      <Tekan
        onPress={onLanjutkan}
        accessibilityRole="button"
        accessibilityLabel="Baca meter pelanggan ini"
        style={({ pressed }) => [
          styles.tombolLanjut,
          { backgroundColor: colors.primary },
          pressed && styles.ditekan,
        ]}
      >
        <Text style={[styles.teksLanjut, { color: colors.primaryForeground }]}>Baca Meter</Text>
      </Tekan>

      <TombolPindah arah="berikutnya" tujuan={berikutnya} onPindah={onPindah} />
    </View>
  );
}

function TombolPindah({
  arah,
  tujuan,
  onPindah,
}: {
  arah: 'sebelumnya' | 'berikutnya';
  tujuan: PelangganRute | null;
  onPindah: (nomorLangganan: string) => void;
}) {
  const { colors } = useTheme();
  const mati = tujuan == null;
  const Ikon = arah === 'sebelumnya' ? ChevronLeft : ChevronRight;

  return (
    <Tekan
      onPress={() => tujuan != null && onPindah(tujuan.nomorLangganan)}
      disabled={mati}
      accessibilityRole="button"
      accessibilityLabel={arah === 'sebelumnya' ? 'Rumah sebelumnya' : 'Rumah berikutnya'}
      accessibilityState={{ disabled: mati }}
      style={({ pressed }) => [
        styles.tombolPindah,
        { backgroundColor: colors.card, borderColor: colors.border },
        pressed && !mati && styles.ditekan,
      ]}
    >
      <Ikon
        size={UkuranIkon.sedang}
        color={mati ? colors.mutedForeground : colors.foreground}
      />
    </Tekan>
  );
}

const styles = StyleSheet.create({
  ditekan: { opacity: 0.7 },
  kartu: { marginTop: Spasi.md },
  // Jaraknya sengaja RAPAT: garisnya yang memisahkan, bukan ruang kosongnya.
  judulSeksi: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    marginTop: Spasi.lg,
    marginBottom: Spasi.sm,
  },
  garisSeksi: { flex: 1, height: StyleSheet.hairlineWidth },
  teksSeksi: { fontSize: Teks.xs, fontWeight: Berat.tebal, letterSpacing: 1.2 },
  kosong: { fontSize: Teks.sm, lineHeight: TinggiBaris.sm, textAlign: 'center' },

  // ── Kartu identitas ──
  kepalaAlamat: { marginBottom: Spasi.md },
  labelKepala: { fontSize: Teks.xs, lineHeight: TinggiBaris.xs },
  nilaiAlamat: { fontSize: Teks.base, fontWeight: Berat.semi, lineHeight: TinggiBaris.base },

  gridUbin: { flexDirection: 'row', gap: Spasi.sm, marginTop: Spasi.sm },
  ubin: {
    flex: 1,
    minWidth: 0,
    borderRadius: Radius.kecil,
    paddingHorizontal: Spasi.md,
    paddingVertical: Spasi.sm,
    gap: 2,
  },
  ubinLabel: { fontSize: Teks.xs, lineHeight: TinggiBaris.xs },
  ubinNilai: { fontSize: Teks.lg, fontWeight: Berat.tebal, lineHeight: TinggiBaris.lg },

  kaki: {
    marginTop: Spasi.md,
    paddingTop: Spasi.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spasi.sm,
  },
  barisKaki: { flexDirection: 'row', alignItems: 'center', gap: Spasi.sm },
  labelKaki: { fontSize: Teks.sm, flexShrink: 0, lineHeight: TinggiBaris.sm },
  nilaiKaki: {
    flex: 1,
    fontSize: Teks.sm,
    fontWeight: Berat.medium,
    textAlign: 'right',
    lineHeight: TinggiBaris.sm,
  },

  // ── Tabel Histori 3 Bulan ──
  // `overflow: hidden` WAJIB: tanpa itu sudut pita kepala yang berwarna penuh
  // menyembul keluar dari sudut membulat tabelnya.
  tabel: {
    borderRadius: Radius.kecil,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  barisTabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.sm,
    paddingHorizontal: Spasi.md,
    paddingVertical: Spasi.sm,
  },
  // Hex langsung ke MasterPalette sah di sini: pita ini memang berwarna penuh
  // di kedua tema, jadi tintanya putih tanpa cabang terang/gelap.
  kepalaBaris: { backgroundColor: P.emerald700 },
  kepala: {
    fontSize: Teks.xs,
    lineHeight: TinggiBaris.xs,
    fontWeight: Berat.semi,
    color: '#FFFFFF',
  },
  sel: { fontSize: Teks.sm, lineHeight: TinggiBaris.sm },
  selTerbaru: { fontWeight: Berat.semi },
  // Lebar kolom dikunci supaya angka antarbaris sejajar secara vertikal —
  // itulah yang membuat ketiga baris bisa dibandingkan dengan sekali lirik.
  // Kolom M3 dibiarkan melar karena ia satu-satunya yang panjangnya
  // benar-benar berubah-ubah (stand 5 digit vs 3 digit).
  kolomPeriode: { width: 58 },
  kolomM3: { flex: 1, minWidth: 0, textAlign: 'center' },
  kolomHarga: { width: 68, textAlign: 'right' },

  // ── Baris aksi ──
  // Tanpa kartu pembungkus: ketiganya sudah punya bingkainya sendiri, dan
  // kartu di sekelilingnya cuma menandai batas hal yang sama dua kali.
  aksiBaris: { flexDirection: 'row', gap: Spasi.sm, marginTop: Spasi.md },
  tombolAksi: {
    flex: 1,
    height: TinggiKontrol.baku,
    borderRadius: Radius.kontrol,
    borderWidth: StyleSheet.hairlineWidth,
    // Ikon dan label BERDAMPINGAN, bukan bertumpuk: satu baris setinggi
    // kontrol baku memuat keduanya tanpa memaksa teksnya turun ke baris kedua.
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spasi.xs,
    paddingHorizontal: Spasi.sm,
  },
  teksAksi: { fontSize: Teks.xs, fontWeight: Berat.medium },

  // ── Dialog ganti no urut ──
  isiDialog: { gap: Spasi.sm },
  petunjuk: { fontSize: Teks.xs, lineHeight: TinggiBaris.xs },
  jarakAtas: { marginTop: Spasi.xs },

  // ── Bilah aksi ──
  dudukanBilah: {
    position: 'absolute',
    left: PADDING_ISI,
    right: PADDING_ISI,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.sm,
  },
  tombolPindah: {
    width: TinggiKontrol.baku,
    height: TinggiKontrol.baku,
    borderRadius: Radius.kontrol,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tombolLanjut: {
    flex: 1,
    height: TinggiKontrol.baku,
    borderRadius: Radius.kontrol,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spasi.sm,
  },
  teksLanjut: { fontSize: Teks.sm, fontWeight: Berat.semi },
});
