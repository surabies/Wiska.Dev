/**
 * catat-screen.tsx — layar entri stand untuk SATU pelanggan rute. Padanan
 * `features/staff/baca_meter/catat_meter_screen.dart`, yang sendiri mengikuti
 * `CatatStandFragment` Aurora.
 *
 * Anatomi & guard-nya sengaja dipertahankan karena semuanya lahir dari
 * kejadian nyata di lapangan:
 *
 *   stand lalu → stand akhir dengan pemakaian & deviasi LIVE → kondisi
 *   kelainan → segel → usulan perubahan → 3 slot foto + video → jarak GPS
 *   live → riwayat 3 periode → estimasi tagihan → konfirmasi → simpan.
 *
 * TIGA GUARD YANG TIDAK BOLEH DILONGGARKAN:
 *   1. Stand MUNDUR hanya sah untuk kondisi meter bermasalah — selain itu
 *      server menolak 400, jadi menahannya di sini menghemat perjalanan
 *      bolak-balik petugas.
 *   2. Foto stand WAJIB untuk pembacaan Normal — foto itulah yang kelak jadi
 *      bukti saat verifikasi mempertanyakan angkanya.
 *   3. Konfirmasi sebelum simpan menampilkan SELURUH yang akan terkirim.
 *      Sekali tersimpan, baris ini masuk antrean dan menjadi hasil kerja.
 *
 * OCR ANGKA STAND SUDAH ADA, lewat Google ML Kit on-device (lihat
 * ocr-stand.ts). Ia MENGUSULKAN, tidak mengisi: angka hasil bacaan muncul
 * sebagai chip yang harus diketuk, dan hanya ketika kolom standnya masih
 * kosong. Roda meter itu mekanis dan digit merahnya tak terbedakan oleh OCR,
 * jadi keputusannya tetap milik petugas yang sedang berdiri di depan meter.
 *
 * SETIAP FOTO BUKTI DICAP saat diambil — logo, nomor langganan, nama, tanggal,
 * dan jam dibakar ke pikselnya (lihat shared/watermark.ts). Capnya dipasang
 * SEBELUM kompresi supaya `kompresFoto` tetap satu-satunya yang memutuskan
 * ukuran akhir berkas.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  JENIS_PEMAKAIAN,
  LABEL_JENIS_PEMAKAIAN,
  susunUsulan,
  type JenisPemakaian,
} from '@workspace/domain/usulan-lapangan';
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  MapPin,
  MapPinOff,
  PencilLine,
  Receipt,
  Trash2,
  TriangleAlert,
  type LucideProps,
} from 'lucide-react-native';
import {
  ApiConfig,
  ApiException,
  formatRupiah,
  kondisiSahMundur,
  labelDari,
  labelKategoriPembacaan,
  labelKondisiMeter,
  type JenisBerkas,
  type PelangganRute,
} from '@workspace/mobile-core';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Text as UIText } from '@/components/ui/text';
import { AppDialog } from '@/components/ui/app-dialog';
import { SelectField } from '@/components/ui/select-field';
import {
  Radius,
  Berat,
  GlassPanel,
  Kelas,
  Spasi,
  Teks,
  TinggiBaris,
  TinggiKontrol,
  UkuranIkon,
  useTheme,
  Tekan,
} from '@/components';
import { IsiStrip, LayarGradasi } from '@/features/pencatat/components/LayarGradasi';
import { MediaError, ambilFoto, ambilVideo, type SumberMedia } from '@/features/shared/MediaLokal';
import { tempelWatermark } from '@/features/shared/WatermarkFoto';
import { bacaCatatanTersimpan, simpanSalinanFoto } from './lib/BackupLokal';
import { jarakMeter, layananAktif, pantauPosisi, posisiSekarang, type Posisi } from './lib/LokasiPetugas';
import { catat, periodeCatatSekarang, standTerakhir } from './lib/RepositoryBacaMeter';
import { usulkanStand, type UsulanStand } from './lib/OcrStand';
import { estimasiUangAir, tarifUntukGolongan, type TarifGolonganMobile } from './lib/TarifAir';

/**
 * Ambang peringatan deviasi di UI. Nilai RESMI milik server (endpoint stats);
 * ini hanya peringatan dini supaya petugas memeriksa ulang angkanya selagi
 * masih berdiri di depan meter.
 */
const AMBANG_PERINGATAN = 50;

const LABEL_SLOT: Record<JenisBerkas, string> = {
  stand: 'Stand Meter',
  segel: 'Segel',
  rumah: 'Rumah',
  video: 'Video',
};

const SLOT_FOTO: JenisBerkas[] = ['stand', 'segel', 'rumah'];

export function CatatMeterScreen({
  pelanggan,
  urutanKunjungan = [],
  onBack,
  onSelesai,
  onPindah,
}: {
  pelanggan: PelangganRute;
  /** Daftar pelanggan tab aktif, urut kunjungan — dasar tombol sebelum/berikutnya. */
  urutanKunjungan?: PelangganRute[];
  onBack: () => void;
  /** Dipanggil setelah tersimpan dan petugas memilih kembali ke daftar. */
  onSelesai: () => void;
  /** Pindah ke pelanggan lain tanpa menumpuk layar. */
  onPindah: (nomorLangganan: string) => void;
}) {
  const { colors } = useTheme();

  const [standLalu, setStandLalu] = useState<number | null>(null);
  const [memuatStand, setMemuatStand] = useState(true);
  const [teksStand, setTeksStand] = useState('');
  const [kondisi, setKondisi] = useState('NORMAL');
  const [kategori, setKategori] = useState('ONSITE');
  /** null = tidak diperiksa; true/false = kondisi segel yang ditemukan. */
  const [isSegel, setIsSegel] = useState<boolean | null>(null);
  /*
   * USULAN PERUBAHAN = DROPDOWN, bukan teks bebas — mengembalikan bentuk
   * aplikasi lama (Aurora). Teks bebas dari sembilan petugas yang mengetik
   * di layar 5 inci sambil berdiri di depan pagar menghasilkan "cafe",
   * "CAFE", "kafe", "warung kopi", dan tidak ada rekap yang bisa dibuat
   * darinya. Keterangan bebas hanya dibuka untuk pilihan "Lainnya".
   */
  const [jenisUsulan, setJenisUsulan] = useState('');
  const [ketUsulan, setKetUsulan] = useState('');
  const usulan = useMemo(
    () =>
      jenisUsulan === ''
        ? ''
        : susunUsulan(jenisUsulan as JenisPemakaian, jenisUsulan === 'LAINNYA' ? ketUsulan : null),
    [jenisUsulan, ketUsulan],
  );
  const [noHp, setNoHp] = useState(pelanggan.notelp ?? '');

  /** Angka yang dibaca OCR dari foto stand — USULAN, bukan isian. */
  const [usulanStand, setUsulanStand] = useState<UsulanStand[]>([]);
  const [memindaiStand, setMemindaiStand] = useState(false);

  const [fotoPaths, setFotoPaths] = useState<Partial<Record<JenisBerkas, string>>>({});
  const [memproses, setMemproses] = useState<JenisBerkas | null>(null);
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);

  const [tarif, setTarif] = useState<TarifGolonganMobile | null>(null);
  const [posisi, setPosisi] = useState<Posisi | null>(null);

  const [konfirmasi, setKonfirmasi] = useState<string | null>(null);
  const [tanyaGps, setTanyaGps] = useState(false);
  /** Bagian jarang-pakai mulai TERTUTUP — itu inti peringkasan (varian K5). */
  const [bukaTambahan, setBukaTambahan] = useState(false);
  const [bukaEstimasi, setBukaEstimasi] = useState(false);

  const periode = periodeCatatSekarang();
  const lepasPantau = useRef<(() => void) | null>(null);

  // ── Muat data pendukung ─────────────────────────────────────────────

  useEffect(() => {
    let batal = false;
    standTerakhir(pelanggan)
      .then((s) => {
        if (!batal) setStandLalu(s ?? pelanggan.standLalu);
      })
      .catch(() => {
        // Prefill hanya kenyamanan — biarkan kosong bila riwayat tak terbaca.
        if (!batal) setStandLalu(pelanggan.standLalu);
      })
      .finally(() => {
        if (!batal) setMemuatStand(false);
      });
    return () => {
      batal = true;
    };
  }, [pelanggan]);

  /*
    Pelanggan yang SUDAH dicatat: tampilkan kembali angka dan foto yang
    tersimpan. Tanpa ini layar terbuka kosong seolah belum pernah dikerjakan,
    dan petugas tidak punya cara memastikan bukti apa yang sudah terkumpul
    selain mengulang pencatatannya.
  */
  useEffect(() => {
    if (!pelanggan.sudahDicatat) return;
    let batal = false;
    void bacaCatatanTersimpan(periode, pelanggan.nomorLangganan).then((tersimpan) => {
      if (batal || tersimpan == null) return;
      const stand = tersimpan.data['standAkhir'];
      if (typeof stand === 'number') setTeksStand(String(stand));
      const kond = tersimpan.data['kondisi'];
      if (typeof kond === 'string') setKondisi(kond);
      const kat = tersimpan.data['kategori'];
      if (typeof kat === 'string') setKategori(kat);
      const segel = tersimpan.data['isSegel'];
      if (typeof segel === 'boolean') setIsSegel(segel);
      setFotoPaths(tersimpan.foto);
    });
    return () => {
      batal = true;
    };
  }, [pelanggan.sudahDicatat, pelanggan.nomorLangganan, periode]);

  useEffect(() => {
    let batal = false;
    tarifUntukGolongan(pelanggan.golonganTarif)
      .then((t) => {
        if (!batal) setTarif(t);
      })
      .catch(() => {
        // Estimasi tidak tampil; pencatatan jalan terus.
      });
    return () => {
      batal = true;
    };
  }, [pelanggan.golonganTarif]);

  const mulaiGps = useCallback(async () => {
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

  // ── Angka turunan ───────────────────────────────────────────────────

  const standAkhir = useMemo(() => {
    const n = Number.parseInt(teksStand, 10);
    return Number.isFinite(n) ? n : null;
  }, [teksStand]);

  const pemakaian = standAkhir != null && standLalu != null ? standAkhir - standLalu : null;

  const deviasi = useMemo(() => {
    const lalu = pelanggan.pemakaianLalu;
    if (pemakaian == null || lalu == null || lalu <= 0) return null;
    return ((pemakaian - lalu) / lalu) * 100;
  }, [pemakaian, pelanggan.pemakaianLalu]);

  const mundurTanpaKondisiSah = (pemakaian ?? 0) < 0 && !kondisiSahMundur.has(kondisi);
  const anomali = Math.abs(deviasi ?? 0) > AMBANG_PERINGATAN;

  const jarakKePelanggan = useMemo(() => {
    if (posisi == null || pelanggan.geoLat == null || pelanggan.geoLong == null) return null;
    return Math.round(
      jarakMeter(posisi.latitude, posisi.longitude, pelanggan.geoLat, pelanggan.geoLong),
    );
  }, [posisi, pelanggan.geoLat, pelanggan.geoLong]);

  const estimasiAir =
    pemakaian != null && pemakaian >= 0 ? estimasiUangAir(tarif, pemakaian) : null;

  /** Komponen tetap tagihan terakhir; null bila pelanggan belum pernah ditagih. */
  const biayaTetap =
    pelanggan.beaBeban == null && pelanggan.beaAdmin == null
      ? null
      : (pelanggan.beaBeban ?? 0) + (pelanggan.beaAdmin ?? 0);

  const estimasiTotal = estimasiAir == null ? null : estimasiAir + (biayaTetap ?? 0);

  // ── Navigasi urutan jalan ───────────────────────────────────────────

  const indeks = urutanKunjungan.findIndex(
    (p) => p.nomorLangganan === pelanggan.nomorLangganan,
  );
  const sebelumnya = indeks > 0 ? urutanKunjungan[indeks - 1] : null;
  const berikutnya =
    indeks >= 0 && indeks + 1 < urutanKunjungan.length ? urutanKunjungan[indeks + 1] : null;

  /** Berikutnya yang BELUM dibaca — yang baru saja disimpan dilewati. */
  const berikutnyaBelumDibaca = (): PelangganRute | null => {
    if (indeks < 0) return null;
    for (let j = indeks + 1; j < urutanKunjungan.length; j++) {
      const kandidat = urutanKunjungan[j];
      if (kandidat != null && !kandidat.sudahDicatat) return kandidat;
    }
    return null;
  };

  // ── Berkas bukti ────────────────────────────────────────────────────

  const ambilBerkas = async (jenis: JenisBerkas, sumber: SumberMedia) => {
    setMemproses(jenis);
    setGalat(null);
    try {
      const mentah =
        jenis === 'video'
          ? await ambilVideo(sumber)
          : await ambilFoto(sumber, {
              /*
               * Cap dipasang di sini, sebelum kompresi. Waktunya diambil SEKALI
               * per pengambilan foto — bukan di dalam `tempelWatermark` —
               * supaya stempel yang terbaca di foto adalah saat jepretan itu,
               * bukan saat pustaka gambarnya kebetulan selesai bekerja.
               */
              praProses: (uri) =>
                tempelWatermark(uri, {
                  nomorLangganan: pelanggan.nomorLangganan,
                  nama: pelanggan.nama,
                  waktu: new Date(),
                }),
            });
      if (mentah == null) return;
      // Salinan di folder cadangan yang jadi path utama: cache picker bisa
      // dibersihkan OS kapan saja, dan antrean offline mungkin baru terkirim
      // berjam-jam kemudian.
      const disalin = await simpanSalinanFoto({
        jenis,
        periode,
        nomorLangganan: pelanggan.nomorLangganan,
        sumberPath: mentah,
      });
      const final = disalin ?? mentah;
      setFotoPaths((f) => ({ ...f, [jenis]: final }));

      /*
       * OCR HANYA UNTUK FOTO STAND, dan hanya bila kolomnya masih kosong.
       * Menawarkan angka baru di atas angka yang sudah diketik petugas berarti
       * mengajak mengganti sesuatu yang sudah ia putuskan — dan usulan mesin
       * tidak berhak menantang keputusan manusia yang sedang berdiri di depan
       * meternya.
       */
      if (jenis === 'stand' && teksStand.trim().length === 0) {
        setMemindaiStand(true);
        void usulkanStand(final)
          .then(setUsulanStand)
          .finally(() => setMemindaiStand(false));
      }
    } catch (err) {
      setGalat(
        err instanceof MediaError
          ? err.message
          : 'Berkas tidak dapat diproses — coba ambil ulang.',
      );
    } finally {
      setMemproses(null);
    }
  };

  const hapusBerkas = (jenis: JenisBerkas) => {
    setFotoPaths((f) => {
      const salin = { ...f };
      delete salin[jenis];
      return salin;
    });
  };

  // ── Simpan ──────────────────────────────────────────────────────────

  const susunRingkasan = (): string => {
    const gantiNoHp = noHp.trim().length > 0 && noHp.trim() !== (pelanggan.notelp ?? '');
    const standDikirim = standAkhir ?? standLalu ?? 0;
    const baris = [
      `${pelanggan.nama} · ${pelanggan.nomorLangganan}`,
      `Stand ${standLalu} → ${standDikirim} (pemakaian ${pemakaian ?? 0} m³` +
        (deviasi == null
          ? ')'
          : `, ${deviasi >= 0 ? '+' : ''}${deviasi.toFixed(0)}% dari bulan lalu)`),
      `Keterangan: ${labelDari(labelKondisiMeter, kondisi)} · ${labelDari(labelKategoriPembacaan, kategori)}`,
    ];
    if (isSegel != null) baris.push(`Segel: ${isSegel ? 'tersegel' : 'tidak tersegel'}`);
    if (jarakKePelanggan != null) baris.push(`Jarak ke titik pelanggan: ±${jarakKePelanggan} m`);
    if (gantiNoHp) baris.push(`No. HP diperbarui: ${noHp.trim()}`);
    // Dialog konfirmasi menampilkan LABEL, bukan kode simpanannya: petugas
    // membaca "Kos-kosan", bukan "KOS_KOSAN".
    if (jenisUsulan !== '') {
      const label = LABEL_JENIS_PEMAKAIAN[jenisUsulan as JenisPemakaian];
      const ket = jenisUsulan === 'LAINNYA' && ketUsulan.trim() !== '' ? ` — ${ketUsulan.trim()}` : '';
      baris.push(`Dipakai sebagai: ${label}${ket}`);
    }
    const berkas = Object.keys(fotoPaths) as JenisBerkas[];
    baris.push(
      `Berkas: ${berkas.length === 0 ? 'tidak ada' : berkas.map((j) => LABEL_SLOT[j]).join(', ')}`,
    );
    if (estimasiAir != null && biayaTetap != null) {
      baris.push(
        `Estimasi tagihan: ${formatRupiah(estimasiTotal!)} (air ${formatRupiah(estimasiAir)} + beban & admin ${formatRupiah(biayaTetap)} — angka resmi dihitung sistem)`,
      );
    } else if (estimasiAir != null) {
      baris.push(
        `Estimasi uang air: ${formatRupiah(estimasiAir)} (belum termasuk beban & admin — angka resmi dihitung sistem)`,
      );
    }
    return baris.join('\n');
  };

  const periksaLaluKonfirmasi = async () => {
    // Stand kosong SAH untuk kondisi kelainan (rumah kosong, meter rusak) —
    // Aurora mengonfirmasi, tidak memblokir.
    if (standAkhir == null && kondisi === 'NORMAL') {
      setGalat('Isi angka stand, atau pilih kondisi kelainan bila meter tidak bisa dibaca.');
      return;
    }
    if (standLalu == null) {
      setGalat('Stand lalu tidak tersedia — catat lewat dashboard web.');
      return;
    }
    if (mundurTanpaKondisiSah) {
      setGalat(
        'Stand mundur hanya sah untuk kondisi meter bermasalah — pilih kondisi yang sesuai.',
      );
      return;
    }
    if (!ApiConfig.isDemo && kondisi === 'NORMAL' && fotoPaths.stand == null) {
      setGalat(
        'Foto stand meter wajib untuk pembacaan Normal — ambil lewat slot Berkas Bukti.',
      );
      return;
    }
    // Guard GPS ala Aurora (checkGPS sebelum simpan), bedanya petugas boleh
    // memilih lanjut TANPA GPS secara sadar; server tetap menerima laporannya,
    // hanya tanpa bukti kehadiran.
    if (!ApiConfig.isDemo && posisi == null) {
      const aktif = await layananAktif();
      if (!aktif || posisi == null) {
        setTanyaGps(true);
        return;
      }
    }
    setGalat(null);
    setKonfirmasi(susunRingkasan());
  };

  const simpan = async () => {
    setKonfirmasi(null);
    if (standLalu == null) return;
    setMengirim(true);
    setGalat(null);
    try {
      const gantiNoHp = noHp.trim().length > 0 && noHp.trim() !== (pelanggan.notelp ?? '');
      await catat({
        pelanggan,
        periode,
        standAwal: standLalu,
        // Kelainan tanpa angka: stand tetap di angka lalu (pemakaian 0).
        standAkhir: standAkhir ?? standLalu,
        kondisi,
        kategori,
        fotoPaths,
        latCatat: posisi?.latitude ?? null,
        longCatat: posisi?.longitude ?? null,
        isSegel,
        usulanPerubahan: usulan.trim().length > 0 ? usulan.trim() : null,
        notelpBaru: gantiNoHp ? noHp.trim() : null,
      });
      // LANGSUNG LANJUT ke rumah berikutnya yang belum dibaca — tanpa dialog
      // "lanjut?" di antaranya. Rute berisi 184 rumah; satu ketukan tambahan
      // per rumah berarti 184 ketukan sehari yang jawabannya selalu "ya".
      // Kalau rutenya habis, kembali ke daftar.
      const berikut = berikutnyaBelumDibaca();
      if (berikut != null) {
        onPindah(berikut.nomorLangganan);
        return;
      }
      onSelesai();
    } catch (err) {
      setGalat(
        err instanceof ApiException && err.isConflict
          ? 'Pelanggan ini sudah dicatat untuk periode berjalan. Kembali dan muat ulang daftar.'
          : err instanceof ApiException
            ? err.message
            : 'Gagal menyimpan — coba lagi.',
      );
      setMengirim(false);
    }
  };

  // ── Tampilan ────────────────────────────────────────────────────────

  /**
   * Kapan tombol simpan menyala. Cermin dari `periksaLaluKonfirmasi`, bukan
   * aturan kedua — kalau keduanya berbeda, petugas akan melihat tombol hidup
   * lalu ditolak, yang jauh lebih membingungkan daripada tombol mati.
   *
   * Kondisi kelainan (rumah kosong, meter rusak) TIDAK menuntut angka maupun
   * foto, jadi tombolnya menyala lebih awal — itu memang keadaan yang sah.
   */
  const bolehSimpan =
    standLalu != null &&
    !mundurTanpaKondisiSah &&
    (kondisi !== 'NORMAL' ||
      (standAkhir != null && (ApiConfig.isDemo || fotoPaths.stand != null)));


  return (
    <LayarGradasi
      // Nama pelanggan MENGGANTIKAN judul layar (varian I5): "Catat Meter"
      // tidak memberi tahu apa pun yang belum jelas dari isinya, sedangkan
      // nama + nomor mencegah kesalahan paling mahal di layar ini — mencatat
      // rumah yang salah. Keduanya di header, jadi tidak ikut tergulir.
      judul={pelanggan.nama}
      subjudul={pelanggan.nomorLangganan}
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
      kanan={<PenandaGps jarak={jarakKePelanggan} adaPosisi={posisi != null} />}
      strip={
        <IsiStrip
          kiri={pelanggan.alamat ?? 'Alamat belum tercatat'}
          kanan={pelanggan.urutan != null ? `#${pelanggan.urutan}` : null}
        />
      }
      mengambang={
        <TombolSimpanMengambang
          siap={bolehSimpan}
          mengirim={mengirim}
          onPress={periksaLaluKonfirmasi}
        />
      }
    >
      <KartuStand
        standLalu={standLalu}
        memuatStand={memuatStand}
        teksStand={teksStand}
        onUbahStand={setTeksStand}
        pemakaian={pemakaian}
        deviasi={deviasi}
        anomali={anomali}
        mundurTanpaKondisiSah={mundurTanpaKondisiSah}
        pemakaianLalu={pelanggan.pemakaianLalu}
        usulan={usulanStand}
        memindai={memindaiStand}
        onPakaiUsulan={(nilai) => {
          setTeksStand(nilai);
          // Usulan dibersihkan setelah dipakai: membiarkannya berarti
          // menawarkan angka lain di atas angka yang baru saja dipilih.
          setUsulanStand([]);
        }}
      />

      <KartuPilihan
        kondisi={kondisi}
        onKondisi={setKondisi}
        kategori={kategori}
        onKategori={setKategori}
        isSegel={isSegel}
        onSegel={setIsSegel}
      />

      <KartuBerkas
        fotoPaths={fotoPaths}
        memproses={memproses}
        onBukaSlot={(j) => ambilBerkas(j, 'kamera')}
        onHapus={hapusBerkas}
        fotoStandWajib={kondisi === 'NORMAL'}
      />

      {/*
        K5 — dua bagian yang TIDAK ada di jalur harian dilipat jadi baris
        tipis. Nilai pentingnya tetap terbaca di kanan tanpa membukanya, jadi
        sebagian besar hari petugas tidak perlu menyentuhnya sama sekali.
      */}
      <View style={styles.lipatan}>
        <BarisLipat
          ikon={PencilLine}
          judul="Perbaikan data lapangan"
          nilai={ringkasTambahan(noHp, pelanggan.notelp, usulan)}
          terbuka={bukaTambahan}
          onToggle={() => setBukaTambahan((b) => !b)}
        >
          <IsiTambahan
            noHp={noHp}
            onNoHp={setNoHp}
            jenisUsulan={jenisUsulan}
            onJenisUsulan={setJenisUsulan}
            ketUsulan={ketUsulan}
            onKetUsulan={setKetUsulan}
          />
        </BarisLipat>

        {estimasiAir != null ? (
          <BarisLipat
            ikon={Receipt}
            judul="Estimasi tagihan"
            nilai={formatRupiah(estimasiTotal ?? estimasiAir)}
            terbuka={bukaEstimasi}
            onToggle={() => setBukaEstimasi((b) => !b)}
          >
            <IsiEstimasi
              estimasiAir={estimasiAir}
              biayaTetap={biayaTetap}
              estimasiTotal={estimasiTotal}
            />
          </BarisLipat>
        ) : null}
      </View>

      {galat != null ? (
        <View style={styles.jarakAtas}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Belum bisa disimpan</AlertTitle>
            <AlertDescription>{galat}</AlertDescription>
          </Alert>
        </View>
      ) : null}

      {/* Ruang supaya kartu terakhir tidak tertutup tombol mengambang. */}
      <View style={styles.ruangBawah} />

      {/* ── Dialog ── */}

      <AppDialog
        visible={tanyaGps}
        onDismiss={() => setTanyaGps(false)}
        title="GPS Belum Aktif"
        description={
          'Posisi Anda belum terbaca — laporan akan tersimpan TANPA bukti kehadiran di lokasi. ' +
          'Aktifkan GPS lalu coba lagi, atau lanjut tanpa GPS.'
        }
        actions={
          <>
            <Button
              onPress={() => {
                setTanyaGps(false);
                void mulaiGps();
              }}
              className={Kelas.tombol}
            >
              <UIText className={Kelas.tombolTeks}>Aktifkan Dulu</UIText>
            </Button>
            <Button
              variant="outline"
              onPress={() => {
                setTanyaGps(false);
                setKonfirmasi(susunRingkasan());
              }}
              className={Kelas.tombol}
            >
              <UIText className={Kelas.tombolTeks}>Lanjut Tanpa GPS</UIText>
            </Button>
          </>
        }
      />

      <AppDialog
        visible={konfirmasi != null}
        onDismiss={() => setKonfirmasi(null)}
        title="Konfirmasi Hasil Baca"
        description={konfirmasi ?? ''}
        actions={
          <>
            <Button onPress={simpan} className={Kelas.tombol}>
              <UIText className={Kelas.tombolTeks}>Simpan</UIText>
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
 * Penanda GPS di sudut kanan header — varian **P2**: ikon lokasi + jarak.
 *
 * Angkanya punya guna nyata, bukan hiasan: kalau tertulis 150 m, petugas
 * kemungkinan berdiri di rumah yang salah — dan itu ketahuan SEBELUM
 * menyimpan, bukan saat verifikasi mempertanyakannya sebulan kemudian.
 *
 * Tiga keadaan: terkunci dengan jarak, terkunci tanpa titik pelanggan
 * (pelanggan belum dipetakan), dan belum dapat sinyal.
 */
function PenandaGps({ jarak, adaPosisi }: { jarak: number | null; adaPosisi: boolean }) {
  const teks = !adaPosisi ? '—' : jarak == null ? 'aktif' : `${jarak} m`;
  return (
    <View style={styles.gps}>
      {adaPosisi ? (
        <MapPin size={UkuranIkon.sedang} color="#FFFFFF" />
      ) : (
        <MapPinOff size={UkuranIkon.sedang} color="rgba(255,255,255,0.55)" />
      )}
      <Text style={[styles.gpsTeks, !adaPosisi && styles.gpsRedup]}>{teks}</Text>
    </View>
  );
}

/**
 * Tombol simpan MENGAMBANG (varian F2): lingkaran 56, hanya ikon ceklis.
 *
 * Mengambang, bukan menempel di bar bawah, supaya tidak memakan tinggi tetap
 * di layar yang justru ingin diringkas.
 *
 * REDUP SAAT BELUM SIAP, TAPI TETAP BISA DITEKAN. Sebelumnya tombol ini
 * `disabled` sampai `bolehSimpan` benar, dengan alasan "tombol yang menyala
 * lalu ditolak lebih membingungkan". Di lapangan hasilnya justru kebalikannya:
 * petugas mengetuk, TIDAK ADA APA PUN yang terjadi, dan tidak ada satu kata
 * pun yang menjelaskan apa yang kurang — terbaca sebagai tombol simpan yang
 * rusak. Padahal `periksaLaluKonfirmasi` sudah menyimpan kalimat yang tepat
 * untuk tiap sebab (stand kosong, stand mundur, foto stand belum ada); yang
 * salah cuma kalimat itu tidak pernah bisa terpanggil.
 *
 * Sekarang warnanya tetap memberi tahu bahwa isian belum lengkap, tetapi
 * ketukannya sampai ke pemeriksa — jadi petugas mendapat sebabnya, bukan
 * kesunyian. Yang benar-benar dikunci hanyalah saat sedang mengirim, supaya
 * satu kunjungan tidak terkirim dua kali.
 *
 * Menekannya TIDAK langsung mengirim: dialog ringkasan tetap muncul. Itu
 * guard yang lahir dari kenyataan bahwa satu baris tersimpan langsung menjadi
 * hasil kerja yang diverifikasi kantor.
 */
function TombolSimpanMengambang({
  siap,
  mengirim,
  onPress,
}: {
  /** true = seluruh syarat simpan sudah terpenuhi; hanya menentukan RUPA. */
  siap: boolean;
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
        accessibilityLabel="Simpan hasil baca"
        accessibilityState={{ disabled: mengirim }}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: siap ? colors.primary : colors.muted,
            borderColor: colors.background,
          },
          siap && styles.fabAktif,
          pressed && styles.ditekan,
        ]}
      >
        {mengirim ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Check
            size={26}
            strokeWidth={2.6}
            color={siap ? colors.primaryForeground : colors.mutedForeground}
          />
        )}
      </Tekan>
    </View>
  );
}

/**
 * Kartu Angka Stand — varian **S4**: kotak isian besar di atas, lalu tiga chip
 * berukuran sama.
 *
 * URUTAN CHIP DISENGAJA: Stand lalu → Bulan lalu → Pemakaian. Dua yang kiri
 * adalah bahan, yang kanan hasilnya — dibaca seperti kalimat, dan hasilnya
 * diberi nada hijau supaya mata berhenti di situ.
 *
 * Riwayat tiga periode ikut di sini sebagai SATU BARIS (varian K5), bukan
 * kartu tersendiri. Tempatnya memang di sini: ia dibaca sebagai pembanding
 * angka yang baru diketik, bukan sebagai bagian terpisah.
 */
function KartuStand({
  standLalu,
  memuatStand,
  teksStand,
  onUbahStand,
  pemakaian,
  deviasi,
  anomali,
  mundurTanpaKondisiSah,
  pemakaianLalu,
  usulan,
  memindai,
  onPakaiUsulan,
}: {
  standLalu: number | null;
  memuatStand: boolean;
  teksStand: string;
  onUbahStand: (v: string) => void;
  pemakaian: number | null;
  deviasi: number | null;
  anomali: boolean;
  mundurTanpaKondisiSah: boolean;
  pemakaianLalu: number | null;
  usulan: UsulanStand[];
  memindai: boolean;
  onPakaiUsulan: (nilai: string) => void;
}) {
  const { colors } = useTheme();

  return (
    <GlassPanel padding={Spasi.lg}>
      <Text style={[styles.labelKecil, { color: colors.mutedForeground }]}>Stand akhir</Text>
      <Input
        value={teksStand}
        onChangeText={(v) => onUbahStand(v.replace(/[^0-9]/g, ''))}
        placeholder="0"
        keyboardType="number-pad"
        className="h-14 text-[28px] font-bold"
      />

      <UsulanOcr usulan={usulan} memindai={memindai} onPakai={onPakaiUsulan} />

      <View style={styles.chipBaris}>
        <ChipAngka label="Stand lalu" nilai={memuatStand ? '…' : (standLalu?.toString() ?? '—')} />
        <ChipAngka label="Bulan lalu" nilai={pemakaianLalu != null ? `${pemakaianLalu} m³` : '—'} />
        <ChipAngka
          label="Pemakaian"
          nilai={pemakaian == null ? '—' : `${pemakaian} m³`}
          hasil
          bahaya={anomali}
        />
      </View>

      {deviasi != null ? (
        <Text
          style={[
            styles.deviasi,
            { color: anomali ? colors.destructive : colors.mutedForeground },
          ]}
        >
          {deviasi >= 0 ? '+' : ''}
          {deviasi.toFixed(0)}% dari bulan lalu
        </Text>
      ) : null}

      {anomali ? (
        <View style={styles.jarakAtas}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Pemakaian menyimpang jauh</AlertTitle>
            <AlertDescription>
              Selisihnya lebih dari {AMBANG_PERINGATAN}% terhadap bulan lalu. Periksa ulang roda
              angka meter sebelum menyimpan — koreksi di kantor jauh lebih mahal daripada melihat
              sekali lagi sekarang.
            </AlertDescription>
          </Alert>
        </View>
      ) : null}

      {mundurTanpaKondisiSah ? (
        <View style={styles.jarakAtas}>
          <Alert icon={TriangleAlert} variant="destructive">
            <AlertTitle>Stand mundur</AlertTitle>
            <AlertDescription>
              Stand akhir lebih kecil dari stand lalu. Ini hanya sah bila meternya bermasalah —
              pilih kondisi yang sesuai di bawah.
            </AlertDescription>
          </Alert>
        </View>
      ) : null}

    </GlassPanel>
  );
}

/**
 * Usulan angka hasil OCR foto stand.
 *
 * DISAJIKAN SEBAGAI PILIHAN YANG HARUS DIKETUK, tidak pernah mengisi kolom
 * sendiri. Roda meter itu mekanis dan bisa berhenti di antara dua digit, digit
 * merah desimal tidak bisa dibedakan warnanya oleh OCR, dan kaca meter di
 * lapangan berembun serta tergores. Stand yang salah masuk ke tagihan
 * pelanggan dan baru ketahuan sebulan kemudian — ongkos satu ketukan
 * konfirmasi jauh lebih murah daripada itu.
 *
 * KATA "USULAN" DITULIS APA ADANYA di labelnya. Petugas berhak tahu bahwa
 * angka ini ditebak mesin dari foto, bukan diambil dari data resmi; tanpa itu
 * ia bisa mengira aplikasi sudah tahu jawabannya dan berhenti memeriksa.
 */
function UsulanOcr({
  usulan,
  memindai,
  onPakai,
}: {
  usulan: UsulanStand[];
  memindai: boolean;
  onPakai: (nilai: string) => void;
}) {
  const { colors } = useTheme();

  if (!memindai && usulan.length === 0) return null;

  return (
    <View style={styles.jarakAtas}>
      {memindai ? (
        <View style={styles.usulanBaris}>
          <ActivityIndicator size="small" color={colors.mutedForeground} />
          <Text style={[styles.usulanLabel, { color: colors.mutedForeground }]}>
            Membaca angka dari foto…
          </Text>
        </View>
      ) : (
        <>
          <Text style={[styles.usulanLabel, { color: colors.mutedForeground }]}>
            Usulan dari foto — ketuk bila benar, periksa dulu ke meternya:
          </Text>
          <View style={styles.usulanBaris}>
            {usulan.map((u) => (
              <Tekan
                key={u.nilai}
                onPress={() => onPakai(u.nilai)}
                accessibilityRole="button"
                accessibilityLabel={`Pakai angka ${u.nilai}`}
                style={({ pressed }) => [
                  styles.chipUsulan,
                  { backgroundColor: colors.permukaan, borderColor: colors.border },
                  pressed && styles.ditekan,
                ]}
              >
                <Text style={[styles.chipUsulanTeks, { color: colors.foreground }]}>{u.nilai}</Text>
              </Tekan>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function ChipAngka({
  label,
  nilai,
  hasil = false,
  bahaya = false,
}: {
  label: string;
  nilai: string;
  hasil?: boolean;
  bahaya?: boolean;
}) {
  const { colors } = useTheme();
  const latar = bahaya ? colors.nadaBahayaLatar : hasil ? colors.nadaHijauLatar : colors.permukaan;
  const tinta = bahaya ? colors.nadaBahayaTinta : hasil ? colors.nadaHijauTinta : colors.foreground;
  const tintaLabel = hasil || bahaya ? tinta : colors.mutedForeground;

  return (
    <View style={[styles.chip, { backgroundColor: latar, borderColor: colors.border }]}>
      <Text numberOfLines={1} style={[styles.chipLabel, { color: tintaLabel }]}>
        {label}
      </Text>
      <Text numberOfLines={1} style={[styles.chipNilai, { color: tinta }]}>
        {nilai}
      </Text>
    </View>
  );
}
function KartuPilihan({
  kondisi,
  onKondisi,
  kategori,
  onKategori,
  isSegel,
  onSegel,
}: {
  kondisi: string;
  onKondisi: (v: string) => void;
  kategori: string;
  onKategori: (v: string) => void;
  isSegel: boolean | null;
  onSegel: (v: boolean | null) => void;
}) {
  const { colors } = useTheme();

  /*
   * DROPDOWN, bukan deretan pil — mengembalikan bentuk versi Flutter
   * (`ShadSelect` di catat_meter_screen.dart:927, 949, 970) sekaligus
   * menyamai `Select` dashboard web.
   *
   * Deretan pil yang sempat dipakai punya dua masalah nyata di lapangan:
   * `labelKondisiMeter` berisi belasan kondisi, jadi pilnya membungkus jadi
   * empat-lima baris dan mendorong tombol simpan jauh ke bawah; dan pilihan
   * yang artinya berjauhan ("Normal" vs "Rumah Kosong") berdempetan sehingga
   * salah tekan tidak terlihat. Dropdown menampilkan SATU nilai terpilih —
   * yang justru selalu terbaca — dan tingginya tidak berubah-ubah.
   *
   * Tata letaknya juga mengikuti Flutter: kondisi selebar kartu, lalu
   * kategori dan segel bersanding dua kolom.
   */
  const opsiKondisi = Object.entries(labelKondisiMeter).map(([value, label]) => ({ value, label }));
  const opsiKategori = Object.entries(labelKategoriPembacaan).map(([value, label]) => ({
    value,
    label,
  }));
  const nilaiSegel = isSegel == null ? 'belum' : isSegel ? 'ya' : 'tidak';

  return (
    <GlassPanel style={styles.kartu}>
      <Text style={[styles.judulKartu, { color: colors.foreground }]}>Keterangan Pembacaan</Text>

      <View style={styles.jarakAtas}>
        <SelectField
          label="Kondisi Meter"
          options={opsiKondisi}
          value={kondisi}
          onValueChange={onKondisi}
        />
      </View>

      <View style={[styles.duaKolom, styles.jarakAtas]}>
        <SelectField
          label="Kategori"
          options={opsiKategori}
          value={kategori}
          onValueChange={onKategori}
          containerClassName="flex-1"
        />
        <SelectField
          label="Kondisi Segel"
          options={[
            { value: 'belum', label: 'Tidak diperiksa' },
            { value: 'ya', label: 'Tersegel' },
            { value: 'tidak', label: 'Tidak tersegel' },
          ]}
          value={nilaiSegel}
          onValueChange={(v) => onSegel(v === 'belum' ? null : v === 'ya')}
          containerClassName="flex-1"
        />
      </View>
    </GlassPanel>
  );
}

/**
 * Berkas bukti — tiga slot persegi sama besar, video sebagai tombol memanjang
 * di bawahnya.
 *
 * KETUK = KAMERA LANGSUNG, tanpa dialog perantara. Dialog lama hanya berisi
 * satu tombol nyata ("Kamera") — sebuah konfirmasi untuk niat yang sudah
 * dinyatakan dengan menekan slotnya. Di lapangan, dengan satu tangan memegang
 * senter dan hujan turun, ketukan tambahan itu murni ongkos.
 *
 * KAMERA SAJA — GALERI TETAP TIDAK ADA, dan itu bukan efek samping hilangnya
 * dialog. Berkas di sini bukan ilustrasi melainkan BUKTI bahwa petugas berdiri
 * di depan meter saat mencatat. Galeri meruntuhkan maknanya: foto lama, foto
 * pelanggan lain, atau kiriman dari pesan bisa masuk tanpa jejak, dan
 * verifikator di kantor tidak punya cara membedakannya dari bukti yang sah.
 *
 * Menghapus foto pindah ke lencana silang di sudut slot. Ia sengaja kecil dan
 * di pojok: mengambil ulang jauh lebih sering daripada menghapus, jadi seluruh
 * bidang slot diberikan pada yang sering.
 *
 * Slot "Stand Meter" bergaris PUTUS-PUTUS selama belum terisi ketika kondisi
 * Normal, karena hanya foto itu yang wajib. Bentuknya sendiri yang memberi
 * tahu, tanpa perlu tanda bintang atau kalimat tambahan — dan begitu terisi,
 * garisnya menjadi utuh.
 */
function KartuBerkas({
  fotoPaths,
  memproses,
  onBukaSlot,
  onHapus,
  fotoStandWajib,
}: {
  fotoPaths: Partial<Record<JenisBerkas, string>>;
  memproses: JenisBerkas | null;
  onBukaSlot: (j: JenisBerkas) => void;
  onHapus: (j: JenisBerkas) => void;
  fotoStandWajib: boolean;
}) {
  const { colors } = useTheme();
  return (
    <GlassPanel padding={Spasi.lg} style={styles.kartu}>
      <Text style={[styles.judulKartu, { color: colors.foreground }]}>Berkas Bukti</Text>
      <View style={styles.slotBaris}>
        {SLOT_FOTO.map((jenis) => (
          <SlotBerkas
            key={jenis}
            label={LABEL_SLOT[jenis]}
            uri={fotoPaths[jenis]}
            memproses={memproses === jenis}
            wajibKosong={jenis === 'stand' && fotoStandWajib && fotoPaths.stand == null}
            onPress={() => onBukaSlot(jenis)}
            onHapus={() => onHapus(jenis)}
          />
        ))}
      </View>
      <Tekan
        onPress={() => onBukaSlot('video')}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.tombolVideo,
          { borderColor: colors.border, backgroundColor: colors.permukaan },
          pressed && styles.ditekan,
        ]}
      >
        <Text style={[styles.tombolVideoTeks, { color: colors.foreground }]}>
          {memproses === 'video'
            ? 'Memproses video…'
            : fotoPaths.video != null
              ? 'Video terlampir — ketuk untuk mengganti'
              : 'Tambah video (opsional)'}
        </Text>
      </Tekan>
    </GlassPanel>
  );
}

function SlotBerkas({
  label,
  uri,
  memproses,
  wajibKosong,
  onPress,
  onHapus,
}: {
  label: string;
  uri?: string;
  memproses: boolean;
  wajibKosong: boolean;
  onPress: () => void;
  onHapus: () => void;
}) {
  const { colors } = useTheme();
  const terisi = uri != null;
  return (
    <Tekan
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={terisi ? `Ambil ulang foto ${label}` : `Ambil foto ${label}`}
      style={({ pressed }) => [
        styles.slot,
        {
          borderColor: terisi ? colors.primary : wajibKosong ? colors.primary : colors.border,
          borderStyle: wajibKosong ? 'dashed' : 'solid',
          backgroundColor: terisi ? colors.nadaHijauLatar : colors.permukaan,
        },
        pressed && styles.ditekan,
      ]}
    >
      {terisi && !memproses ? (
        <Tekan
          onPress={onHapus}
          accessibilityRole="button"
          accessibilityLabel={`Hapus foto ${label}`}
          // Sasaran sentuh diperluas jauh melampaui ikonnya lewat hitSlop —
          // lencananya kecil supaya tidak menutupi foto, tapi jarinya tidak
          // perlu setepat itu.
          hitSlop={10}
          style={[styles.slotHapus, { backgroundColor: colors.destructive }]}
        >
          <Trash2 size={12} color={colors.destructiveForeground} />
        </Tekan>
      ) : null}
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

// ── Bagian jarang-pakai, dilipat (K5) ─────────────────────────────────

/**
 * Baris tipis yang bisa dibuka. Nilai ringkasnya tampil di kanan SELAGI
 * tertutup — itu inti gagasannya: sebagian besar hari petugas cukup membaca
 * "Rp 113.800" tanpa pernah membuka isinya.
 */
function BarisLipat({
  ikon: IkonBaris,
  judul,
  nilai,
  terbuka,
  onToggle,
  children,
}: {
  ikon: React.ComponentType<LucideProps>;
  judul: string;
  nilai: string;
  terbuka: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.lipat, { borderColor: colors.border, backgroundColor: colors.card }]}>
      <Tekan
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: terbuka }}
        style={({ pressed }) => pressed && styles.ditekan}
      >
        <View style={styles.lipatKepala}>
          <IkonBaris size={UkuranIkon.sedang} color={colors.mutedForeground} />
          <Text style={[styles.lipatJudul, { color: colors.foreground }]}>{judul}</Text>
          <Text numberOfLines={1} style={[styles.lipatNilai, { color: colors.mutedForeground }]}>
            {nilai}
          </Text>
          {terbuka ? (
            <ChevronUp size={UkuranIkon.sedang} color={colors.mutedForeground} />
          ) : (
            <ChevronDown size={UkuranIkon.sedang} color={colors.mutedForeground} />
          )}
        </View>
      </Tekan>
      {terbuka ? (
        <View style={[styles.lipatIsi, { borderTopColor: colors.border }]}>{children}</View>
      ) : null}
    </View>
  );
}

/** Ringkasan yang tampil di kanan baris "Perbaikan data lapangan". */
function ringkasTambahan(noHp: string, notelpAsal: string | null, usulan: string): string {
  const gantiHp = noHp.trim().length > 0 && noHp.trim() !== (notelpAsal ?? '');
  const adaUsulan = usulan.trim().length > 0;
  if (gantiHp && adaUsulan) return 'HP & usulan';
  if (gantiHp) return 'No. HP diubah';
  if (adaUsulan) return 'Ada usulan';
  return 'kosong';
}

function IsiTambahan({
  noHp,
  onNoHp,
  jenisUsulan,
  onJenisUsulan,
  ketUsulan,
  onKetUsulan,
}: {
  noHp: string;
  onNoHp: (v: string) => void;
  jenisUsulan: string;
  onJenisUsulan: (v: string) => void;
  ketUsulan: string;
  onKetUsulan: (v: string) => void;
}) {
  const { colors } = useTheme();
  /*
   * "-" berada di urutan pertama dan bernilai kosong, sama seperti dropdown
   * Aurora: bawaannya TIDAK MENGUSULKAN APA-APA. Kalau bawaannya sebuah
   * pilihan, tiap rumah yang dilewati akan mengirim usulan palsu.
   */
  const opsi = [
    { value: '', label: '-' },
    ...JENIS_PEMAKAIAN.map((j) => ({ value: j, label: LABEL_JENIS_PEMAKAIAN[j] })),
  ];
  return (
    <>
      <Text style={[styles.labelKecil, { color: colors.mutedForeground }]}>No. HP pelanggan</Text>
      <Input
        value={noHp}
        onChangeText={onNoHp}
        placeholder="08xxxxxxxxxx"
        keyboardType="phone-pad"
        className={Kelas.input}
      />
      <View style={styles.jarakAtas}>
        <SelectField
          label="Rumah ini dipakai sebagai"
          options={opsi}
          value={jenisUsulan}
          onValueChange={onJenisUsulan}
        />
      </View>
      {jenisUsulan === 'LAINNYA' ? (
        <>
          <Text style={[styles.labelKecil, styles.jarakAtas, { color: colors.mutedForeground }]}>
            Keterangan
          </Text>
          <Textarea
            value={ketUsulan}
            onChangeText={onKetUsulan}
            placeholder="Mis. dipakai gudang tekstil"
            numberOfLines={3}
            className={Kelas.areaTeks}
          />
        </>
      ) : null}
    </>
  );
}

function IsiEstimasi({
  estimasiAir,
  biayaTetap,
  estimasiTotal,
}: {
  estimasiAir: number;
  biayaTetap: number | null;
  estimasiTotal: number | null;
}) {
  const { colors } = useTheme();
  return (
    <>
      <View style={styles.estimasiBaris}>
        <Text style={[styles.estimasiLabel, { color: colors.mutedForeground }]}>Uang air</Text>
        <Text style={[styles.estimasiNilai, { color: colors.foreground }]}>
          {formatRupiah(estimasiAir)}
        </Text>
      </View>
      {biayaTetap != null ? (
        <>
          <View style={styles.estimasiBaris}>
            <Text style={[styles.estimasiLabel, { color: colors.mutedForeground }]}>
              Beban &amp; admin
            </Text>
            <Text style={[styles.estimasiNilai, { color: colors.foreground }]}>
              {formatRupiah(biayaTetap)}
            </Text>
          </View>
          <View style={styles.estimasiBaris}>
            <Text style={[styles.estimasiLabel, { color: colors.foreground, fontWeight: Berat.semi }]}>
              Perkiraan total
            </Text>
            <Text style={[styles.estimasiTotal, { color: colors.nadaHijauTinta }]}>
              {formatRupiah(estimasiTotal ?? estimasiAir)}
            </Text>
          </View>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  kartu: { marginTop: Spasi.md },
  judulKartu: { fontSize: Teks.base, fontWeight: Berat.medium, marginBottom: Spasi.md },
  keteranganKartu: {
    fontSize: Teks.xs,
    lineHeight: TinggiBaris.xs,
    marginTop: Spasi.sm,
  },
  labelKecil: { fontSize: Teks.xs, marginBottom: Spasi.sm },
  jarakAtas: { marginTop: Spasi.md },
  ditekan: { opacity: 0.7 },
  ruangBawah: { height: 72 },
  duaKolom: { flexDirection: 'row', gap: Spasi.md },
  gps: { flexDirection: 'row', alignItems: 'center', gap: Spasi.xs + 1 },
  gpsTeks: { fontSize: Teks.xs, fontWeight: Berat.semi, color: '#FFFFFF' },
  gpsRedup: { color: 'rgba(255,255,255,0.55)' },

  // ── S4: chip Stand lalu · Bulan lalu · Pemakaian ──
  chipBaris: { flexDirection: 'row', gap: Spasi.sm, marginTop: Spasi.md },
  chip: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    paddingVertical: Spasi.sm,
    paddingHorizontal: Spasi.xs,
    borderRadius: Radius.kecil,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: { fontSize: Teks.xs },
  chipNilai: { fontSize: Teks.base, fontWeight: Berat.tebal, marginTop: 2 },
  deviasi: { fontSize: Teks.xs, marginTop: Spasi.sm, textAlign: 'center' },

  // ── Berkas ──
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
  // Di ATAS gambar (zIndex), sudut kanan-atas — jauh dari ibu jari yang
  // bergerak ke tengah slot untuk mengambil ulang.
  slotHapus: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: { fontSize: Teks.xs },
  tombolVideo: {
    marginTop: Spasi.md,
    height: TinggiKontrol.kecil,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.kecil,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tombolVideoTeks: { fontSize: Teks.xs },

  // ── Bagian dilipat ──
  lipatan: { marginTop: Spasi.md, gap: Spasi.sm },
  lipat: { borderRadius: Radius.kartu, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  lipatKepala: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    paddingHorizontal: Spasi.lg,
    paddingVertical: Spasi.md,
  },
  lipatJudul: { fontSize: Teks.sm, fontWeight: Berat.medium },
  lipatNilai: { flex: 1, fontSize: Teks.xs, textAlign: 'right' },
  lipatIsi: { paddingHorizontal: Spasi.lg, paddingBottom: Spasi.lg, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spasi.md },

  estimasiBaris: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spasi.xs,
  },
  // ── Usulan OCR ──
  usulanLabel: { fontSize: Teks.xs, lineHeight: TinggiBaris.xs },
  usulanBaris: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: Spasi.sm, marginTop: Spasi.sm },
  chipUsulan: {
    paddingHorizontal: Spasi.md,
    paddingVertical: Spasi.xs,
    borderRadius: Radius.kontrol,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipUsulanTeks: { fontSize: Teks.base, fontWeight: Berat.tebal },

  estimasiLabel: { fontSize: Teks.sm },
  estimasiNilai: { fontSize: Teks.sm, fontWeight: Berat.medium },
  estimasiTotal: { fontSize: Teks.base, fontWeight: Berat.tebal },

  // ── Tombol simpan mengambang (F2) ──
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
