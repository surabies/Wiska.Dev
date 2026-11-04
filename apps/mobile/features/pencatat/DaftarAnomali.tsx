/**
 * anomali-screen.tsx — daftar sambungan tidak terukur untuk penyelia anomali.
 *
 * TIDAK ADA PENUGASAN DAN TIDAK ADA TARGET. Layar ini memuat SELURUH daftar
 * lalu petugas memilih sendiri mana yang didatangi hari ini. Urutannya sudah
 * disiapkan server menurut paparan (lama tidak terbaca x m3 yang ditagih
 * tanpa dasar), jadi memindai dari atas sudah merupakan urutan kerja yang
 * masuk akal — tapi tidak ada yang memaksa.
 *
 * Yang sudah dikunjungi bulan ini disembunyikan, supaya daftar yang dilihat
 * petugas selalu berisi pekerjaan yang benar-benar tersisa.
 *
 * DILAYANI DARI SQLITE. Membuka layar ini TIDAK menembak jaringan: daftarnya
 * ribuan baris dan penyelia bekerja di gang yang sinyalnya tidak bisa
 * diandalkan. Menarik-untuk-menyegarkan-lah yang mengunduh ulang — dan itu
 * tindakan yang disengaja, bukan efek samping berpindah layar.
 */
import { memo, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Pressable } from 'react-native';
import { CircleAlert } from 'lucide-react-native';
import { ApiException } from '@workspace/mobile-core';
import { LABEL_KATEGORI, SEMUA_KATEGORI, type KategoriAnomali } from '@workspace/domain/anomali';

import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/components';
import { LayarGradasi, PADDING_ISI } from '@/features/pencatat/components/LayarGradasi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { SelectField } from '@/components/ui/select-field';
import { Switch } from '@/components/ui/switch';
import { Text as UIText } from '@/components/ui/text';
import { daftarAnomali, wilayahAnomali, type BarisAnomali, type DaftarAnomali } from './lib/RepositoryAnomali';
import type { OpsiWilayah } from './lib/DaoAnomali';

const angka = (x: number) => x.toLocaleString('id-ID');

/**
 * Hasil muat TERAKHIR, disimpan di luar komponen.
 *
 * Layar ini di-mount ulang setiap kali petugas masuk dari beranda, dan tanpa
 * ini setiap masuk berarti layar kosong + "Memuat…" sampai SQLite selesai
 * membaca ribuan baris. Bacaannya memang cepat, tapi cukup lama untuk
 * berkedip — dan kedipan itulah yang membuat daftar lokal terasa seperti
 * sedang diunduh ulang padahal jaringan tidak disentuh sama sekali.
 *
 * Sengaja variabel modul, bukan state global: isinya cuma bayangan tampilan
 * yang boleh basi sesaat, dan SQLite tetap satu-satunya sumber kebenaran.
 */
let terakhirDimuat: DaftarAnomali | null = null;

export function AnomaliScreen({
  periode,
  onBack,
  onPilih,
}: {
  /** Periode kerja berjalan — dipakai menyembunyikan yang sudah dikunjungi. */
  periode: number;
  onBack: () => void;
  onPilih: (baris: BarisAnomali) => void;
}) {
  const { colors } = useTheme();
  const [data, setData] = useState<DaftarAnomali | null>(terakhirDimuat);
  const [memuat, setMemuat] = useState(terakhirDimuat == null);
  const [menyegarkan, setMenyegarkan] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const [kategori, setKategori] = useState<KategoriAnomali | null>(null);
  const [hanyaPrioritas, setHanyaPrioritas] = useState(true);
  const [kelurahan, setKelurahan] = useState<string | null>(null);
  const [rw, setRw] = useState<string | null>(null);
  const [wilayah, setWilayah] = useState<{ kelurahan: OpsiWilayah[]; rw: OpsiWilayah[] }>({
    kelurahan: [],
    rw: [],
  });

  /**
   * `segarkan` memisahkan dua hal yang mudah tertukar: mengganti penyaring
   * (dilayani SQLite, seketika) dan mengunduh ulang (menembak jaringan).
   * Mengetuk chip tidak boleh berarti menunggu unduhan.
   */
  const muat = useCallback(
    async (segarkan = false) => {
      setGalat(null);
      try {
        const hasil = await daftarAnomali({
          hanyaPrioritas,
          kategori,
          periode,
          kelurahan,
          rw,
          segarkan,
        });
        terakhirDimuat = hasil;
        setData(hasil);
      } catch (e) {
        setGalat(
          e instanceof ApiException && e.status === 0
            ? 'Perangkat ini belum pernah mengunduh daftar anomali, dan sekarang sedang tanpa sinyal. Coba lagi saat tersambung.'
            : ApiException.is(e)
              ? e.message
              : // BUKAN ApiException berarti kegagalannya terjadi SEBELUM
                // jaringan tersentuh — hampir selalu penyimpanan lokal. Pesan
                // lama menyuruh "periksa sambungan Anda" di sini, dan itu
                // mengirim siapa pun yang menelusuri (petugas maupun
                // pengembang) ke arah yang salah: sinyal penuh, server hidup,
                // tetapi daftarnya tetap tidak mau muncul.
                'Gagal membaca daftar dari penyimpanan perangkat — bukan masalah sinyal. Tutup lalu buka lagi aplikasi; bila tetap muncul, laporkan ke admin.',
        );
      } finally {
        setMemuat(false);
        setMenyegarkan(false);
      }
    },
    [hanyaPrioritas, kategori, periode, kelurahan, rw],
  );

  /**
   * Pilihan wilayah ikut isi daftar, bukan daftar wilayah kota. Dimuat ulang
   * saat kelurahan berganti karena RW hanya bermakna di dalam kelurahannya —
   * "RW 03" ada di banyak kelurahan sekaligus.
   */
  useEffect(() => {
    let batal = false;
    void wilayahAnomali({ hanyaPrioritas, kategori, periode, kelurahan }).then((w) => {
      if (!batal) setWilayah(w);
    });
    return () => {
      batal = true;
    };
  }, [hanyaPrioritas, kategori, periode, kelurahan, data]);

  /**
   * TIDAK memasang `setMemuat(true)` di sini. Efek ini ikut berjalan setiap
   * kali penyaring berubah, dan penyaringan dilayani SQLite — seketika.
   * Menyalakan pemuat layar penuh untuk itu membuat setiap ketukan tampak
   * seperti mengunduh ulang, padahal jaringan sama sekali tidak disentuh.
   * Pemuat hanya perlu ada di pemuatan PERTAMA (state awal `memuat` = true);
   * sesudahnya daftar lama tetap terlihat sampai yang baru siap.
   */
  useEffect(() => {
    void muat();
  }, [muat]);

  const segarkan = () => {
    setMenyegarkan(true);
    void muat(true);
  };

  const baris = data?.baris ?? [];

  /// Hitungan per kategori datang dari meta unduhan, jadi ia SELALU jumlah
  /// seluruhnya — bukan hasil penyaringan. Itu yang dipakai sebagai penyebut
  /// "menampilkan X dari Y", dan yang membuat angka di tiap pilihan tetap
  /// bermakna walau penyaringnya sedang menyempitkan daftar.
  const perKategori = data?.perKategori;
  const totalSemua = perKategori
    ? Object.values(perKategori).reduce((a, b) => a + b, 0)
    : null;

  /**
   * Pilihan yang SEDANG aktif selalu ikut ditawarkan, walau hitungannya 0.
   *
   * Mengganti kategori bisa membuat kelurahan yang sedang dipilih tidak lagi
   * punya satu pun baris yang cocok. Membuangnya dari daftar akan membuat
   * kotak pilihannya tampak kosong seakan rusak; mereset diam-diam ke "semua"
   * mengubah penyaring tanpa diminta. Menampilkannya dengan (0) mengatakan apa
   * adanya: pilihan ini masih aktif, dan memang tidak ada isinya.
   */
  const denganTerpilih = (daftar: OpsiWilayah[], terpilih: string | null) =>
    terpilih != null && !daftar.some((o) => o.nilai === terpilih)
      ? [...daftar, { nilai: terpilih, jumlah: 0 }]
      : daftar;

  const opsiKelurahan = denganTerpilih(wilayah.kelurahan, kelurahan);
  const opsiRw = denganTerpilih(wilayah.rw, rw);

  const opsiKategori = [
    { value: 'SEMUA', label: `Semua kategori${totalSemua != null ? ` (${angka(totalSemua)})` : ''}` },
    ...SEMUA_KATEGORI.map((k) => {
      const n = perKategori?.[k];
      return { value: k, label: `${LABEL_KATEGORI[k]}${n != null ? ` (${angka(n)})` : ''}` };
    }),
  ];

  return (
    <LayarGradasi
      judul="Sambungan Tidak Terukur"
      subjudul={data ? `${angka(data.total)} sambungan perlu didatangi` : 'Memuat…'}
      kiri={<Pressable onPress={onBack} hitSlop={12} accessibilityRole="button" accessibilityLabel="Kembali">
          <ChevronLeft size={22} color="#FFFFFF" />
        </Pressable>}
      gulir={false}
      onSegarkan={segarkan}
      sedangMuat={menyegarkan}
    >
        {/*
          FlatList, BUKAN ScrollView berisi `baris.map`. Daftar ini membawa
          sampai 300 kartu, dan ScrollView me-mount semuanya sekaligus —
          ribuan view hidup bersamaan. Itulah yang membuat gulirannya tersendat
          dan setiap ganti penyaring terasa berat: bukan kuerinya yang lambat,
          melainkan merakit ulang seluruh daftar. FlatList hanya merender yang
          terlihat.
        */}
        <FlatList
          data={baris}
          keyExtractor={(b) => b.pelangganId}
          renderItem={({ item }) => <KartuAnomali baris={item} onPilih={onPilih} />}
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={menyegarkan}
              onRefresh={segarkan}
              tintColor={colors.primary}
            />
          }
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            memuat ? (
              <View style={styles.tengah}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : (
              <View style={styles.tengah}>
                <Text style={[styles.kosong, { color: colors.mutedForeground }]}>
                  Tidak ada sambungan yang cocok dengan penyaring ini.
                </Text>
              </View>
            )
          }
          ListHeaderComponent={
            <>
          {galat != null ? (
            <Alert icon={CircleAlert}>
              <AlertDescription>{galat}</AlertDescription>
            </Alert>
          ) : null}

          {/*
            Penyaring. Bawaannya HANYA PRIORITAS (tanpa tunggakan): mereka
            tidak tersentuh jalur penagihan maupun pemutusan, jadi kunjungan
            inilah satu-satunya cara mereka diperiksa.

            BENTUKNYA SENGAJA DIBEDAKAN, dan itu inti perbaikannya. Sebelumnya
            keempat penyaring adalah chip yang serupa persis, padahal dua
            jenisnya berbeda: "tanpa tunggakan" itu saklar nyala/mati,
            sedangkan kategori itu pilih-satu. Karena bentuknya sama, tidak ada
            cara menebak mana yang bisa digabung dan mana yang saling
            meniadakan — dan keempatnya melipat jadi tiga baris.

            Kategori kini SelectField, bentuk yang sama dengan "Apa yang
            ditemukan?" dan Keterangan Pembacaan di catat meter. Saklar berdiri
            sendiri dengan kalimat yang menjelaskan kenapa ia ada.
          */}
          <View style={styles.penyaring}>
            <SelectField
              options={opsiKategori}
              value={kategori ?? 'SEMUA'}
              onValueChange={(v) => setKategori(v === 'SEMUA' ? null : (v as KategoriAnomali))}
            />

            {/* Wilayah. Ini yang membuat kunjungan berhenti acak: daftar
                diurutkan menurut paparan, dan paparan tidak mengenal geografi
                — dua baris berurutan bisa terpisah beberapa kilometer.
                Mempersempit ke satu kelurahan/RW mengubah pertanyaannya dari
                "mana yang paling parah" jadi "bagaimana menyusuri ini tanpa
                bolak-balik", dan urutannya ikut berpindah ke urutan baca
                meter. Hanya tampil bila datanya memang ada — perangkat yang
                mengunduh sebelum server mengirim wilayah tidak disodori
                penyaring yang pasti kosong. */}
            {opsiKelurahan.length > 0 ? (
              <SelectField
                options={[
                  { value: 'SEMUA', label: 'Semua kelurahan' },
                  ...opsiKelurahan.map((k) => ({
                    value: k.nilai,
                    label: `${k.nilai} (${angka(k.jumlah)})`,
                  })),
                ]}
                value={kelurahan ?? 'SEMUA'}
                onValueChange={(v) => {
                  // RW ikut dilepas: nomor RW dari kelurahan lama tidak
                  // bermakna di kelurahan baru, dan membiarkannya menempel
                  // menghasilkan daftar kosong yang membingungkan.
                  setRw(null);
                  setKelurahan(v === 'SEMUA' ? null : v);
                }}
              />
            ) : null}

            {kelurahan != null && opsiRw.length > 0 ? (
              <SelectField
                options={[
                  { value: 'SEMUA', label: 'Semua RW' },
                  ...opsiRw.map((r) => ({
                    value: r.nilai,
                    label: `RW ${r.nilai} (${angka(r.jumlah)})`,
                  })),
                ]}
                value={rw ?? 'SEMUA'}
                onValueChange={(v) => setRw(v === 'SEMUA' ? null : v)}
              />
            ) : null}

            <View style={styles.saklarBaris}>
              <View style={styles.saklarTeks}>
                <Text style={[styles.saklarLabel, { color: colors.foreground }]}>
                  Hanya tanpa tunggakan
                </Text>
              </View>
              <Switch checked={hanyaPrioritas} onCheckedChange={setHanyaPrioritas} />
            </View>
          </View>

          {/* Berapa yang lolos penyaring, dari berapa seluruhnya. Tanpa ini
              petugas tidak punya cara tahu bahwa daftar yang memendek itu
              akibat penyaringnya sendiri, bukan data yang hilang. */}
          {data != null && totalSemua != null ? (
            <Text style={[styles.ringkasan, { color: colors.mutedForeground }]}>
              Menampilkan {angka(data.total)} dari {angka(totalSemua)}
            </Text>
          ) : null}

          {/* Usia data. Penting justru karena daftar ini dilayani lokal:
              petugas berhak tahu ia sedang melihat keadaan kapan, dan tarikan
              ke bawah adalah cara memperbaruinya. */}
          {data?.diunduhPada != null ? (
            <Text style={[styles.usia, { color: colors.mutedForeground }]}>
              Daftar per {data.diunduhPada.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
            </Text>
          ) : null}

            </>
          }
        />
    </LayarGradasi>
  );
}

/**
 * Satu kartu sambungan. DI-MEMO: tanpa ini setiap ketukan penyaring merakit
 * ulang seluruh kartu yang terlihat, padahal isinya tidak berubah — dan itu
 * biaya yang dibayar berkali-kali dalam satu sesi penyaringan.
 */
const KartuAnomali = memo(function KartuAnomali({
  baris: b,
  onPilih,
}: {
  baris: BarisAnomali;
  onPilih: (baris: BarisAnomali) => void;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      onPress={() => onPilih(b)}
      style={[
        styles.kartu,
        { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.md },
      ]}
    >
      <View style={styles.kartuAtas}>
        <Text style={[styles.nomor, { color: colors.mutedForeground }]}>{b.nomorLangganan}</Text>
        <Badge variant="outline">
          <UIText>{b.bulanBerturut} bln</UIText>
        </Badge>
      </View>
      <Text style={[styles.nama, { color: colors.foreground }]}>{b.nama}</Text>
      {b.alamat ? (
        <Text style={[styles.alamat, { color: colors.mutedForeground }]} numberOfLines={2}>
          {b.alamat}
        </Text>
      ) : null}
      <View style={styles.kartuBawah}>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {LABEL_KATEGORI[b.kategori]} · {b.kondisiTerakhir}
        </Text>
        <Text style={[styles.meta, { color: colors.mutedForeground }]}>
          {angka(b.m3TanpaDasar)} m³ ditaksir
        </Text>
      </View>
      {b.kunjunganTerakhir ? (
        <Text style={[styles.riwayat, { color: colors.mutedForeground }]}>
          Terakhir dikunjungi {b.kunjunganTerakhir.periode} · {b.kunjunganTerakhir.hasil}
        </Text>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  scroll: { padding: PADDING_ISI, gap: 10, paddingBottom: 40 },
  penyaring: { gap: 12, marginBottom: 8 },
  saklarBaris: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  saklarTeks: { flex: 1 },
  saklarLabel: { fontSize: 14, fontWeight: '600' },
  saklarJelas: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  ringkasan: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  usia: { fontSize: 11, marginBottom: 2 },
  tengah: { paddingVertical: 48, alignItems: 'center' },
  kosong: { fontSize: 13, textAlign: 'center' },
  kartu: { padding: 12, borderWidth: StyleSheet.hairlineWidth, gap: 3 },
  kartuAtas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  nomor: { fontSize: 11, fontFamily: 'monospace' },
  nama: { fontSize: 15, fontWeight: '600' },
  alamat: { fontSize: 12 },
  kartuBawah: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  meta: { fontSize: 11 },
  riwayat: { fontSize: 11, fontStyle: 'italic', marginTop: 2 },
});
