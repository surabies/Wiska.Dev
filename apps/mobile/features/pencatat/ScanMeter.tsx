/**
 * scan-screen.tsx — pindai QR/barcode nomor pelanggan lalu LANGSUNG buka layar
 * catat untuk pelanggan itu. Padanan `scan_qr_screen.dart` (yang sendiri
 * mengikuti `ScanAndGetActivity` Aurora), dengan satu perbedaan disengaja.
 *
 * PERBEDAAN: versi Flutter mengembalikan nilai hasil scan ke layar pemanggil.
 * Di sini scan adalah tombol GLOBAL di tengah dock, jadi tidak ada "pemanggil"
 * yang menunggu — layar ini sendiri yang mencocokkan kode lalu meloncat ke
 * `/catat`. Itu juga yang diminta: barcode tercetak di tiap pelanggan supaya
 * petugas bisa membaca meter langsung dari nomor pelanggan tersebut.
 *
 * PENCOCOKAN DILAKUKAN OFFLINE. Kode dicari di paket rute yang sudah tersimpan
 * di perangkat (`ambilPelanggan`), bukan lewat jaringan — sama seperti
 * `searchPelanggan` Aurora. Di gang sempit tanpa sinyal, scan tetap jalan.
 *
 * KODE YANG TIDAK DIKENAL BUKAN KEGAGALAN DIAM. Kalau nomornya tidak ada di
 * paket rute, petugas diberi tahu apa yang terbaca dan apa yang harus
 * dilakukan — bukan layar yang sekadar tidak bereaksi.
 */
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { X, Zap, ZapOff } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Text as UIText } from '@/components/ui/text';
import { Berat, Kelas, MasterPalette as P, Radius, Spasi, useTheme, Tekan } from '@/components';
import { ambilPelanggan } from './lib/RepositoryBacaMeter';

/**
 * Format yang dipindai. QR + Code128 mengikuti Flutter; EAN/UPC ikut karena
 * sebagian kartu meter dicetak dengan barcode ritel biasa dan menambahkannya
 * tidak memperlambat pemindai.
 */
const FORMAT = ['qr', 'code128', 'code39', 'ean13', 'ean8'] as const;

/** Panjang baku nomor langganan — 11 digit, seluruhnya berawalan nol. */
const PANJANG_NOMOR = 11;

/**
 * Bentuk-bentuk nomor yang layak dicoba dari satu hasil scan, berurutan dari
 * yang paling mungkin.
 *
 * KENAPA TIDAK CUKUP SATU. Yang tercetak adalah nomor pelanggan, dan SELURUH
 * 22.575 nomor berpanjang 11 digit dengan angka NOL di depan. Nol depan itu
 * hal pertama yang hilang saat nomor melewati spreadsheet, pembuat barcode,
 * atau basis data yang menyimpannya sebagai angka — `00700800153` berubah jadi
 * `700800153`. Karena DAO mencocokkan string PERSIS, satu nol yang hilang
 * berarti petugas berdiri di depan rumah yang benar sambil dibilang kodenya
 * tidak dikenal.
 *
 * Urutan percobaan:
 *   1. apa adanya (sudah benar)
 *   2. diberi nol di depan sampai 11 digit (nol depan terbuang)
 *   3. 11 digit terakhir (ada awalan tambahan, mis. kode wilayah)
 */
function kandidatNomor(mentah: string): string[] {
  const bersih = mentah.trim();
  // Beberapa QR memuat URL dengan nomor di ruas terakhir.
  const ruas = bersih.split(/[/?#]/).filter(Boolean);
  const akhir = ruas.length > 0 ? ruas[ruas.length - 1]! : bersih;
  const angka = akhir.replace(/[^0-9]/g, '');
  if (angka.length === 0) return bersih.length > 0 ? [bersih] : [];

  const urut = [angka];
  if (angka.length < PANJANG_NOMOR) urut.push(angka.padStart(PANJANG_NOMOR, '0'));
  if (angka.length > PANJANG_NOMOR) urut.push(angka.slice(-PANJANG_NOMOR));
  return [...new Set(urut)];
}

export function ScanScreen({
  onTutup,
  onKetemu,
}: {
  onTutup: () => void;
  /** Dipanggil dengan nomor langganan yang COCOK di paket rute lokal. */
  onKetemu: (nomorLangganan: string) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [izin, mintaIzin] = useCameraPermissions();
  const [senter, setSenter] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  /** Kamera menembak beruntun — kunci supaya satu kode hanya diproses sekali. */
  const sedangProses = useRef(false);

  const terdeteksi = useCallback(
    async ({ data }: BarcodeScanningResult) => {
      if (sedangProses.current) return;
      const kandidat = kandidatNomor(data ?? '');
      if (kandidat.length === 0) return;

      sedangProses.current = true;
      setGalat(null);
      try {
        for (const nomor of kandidat) {
          const pelanggan = await ambilPelanggan(nomor);
          if (pelanggan != null) {
            onKetemu(pelanggan.nomorLangganan);
            return;
          }
        }
        setGalat(
          `Kode "${kandidat[0]}" tidak ada di rute yang tersimpan di perangkat ini. ` +
            'Pastikan rutenya sudah diunduh, atau cari pelanggannya lewat menu Rute.',
        );
      } catch {
        setGalat('Data rute lokal tidak terbaca — buka Download Data lalu unduh ulang.');
      } finally {
        // Beri jeda supaya pesan sempat terbaca sebelum pemindai menyala lagi.
        setTimeout(() => {
          sedangProses.current = false;
        }, 1200);
      }
    },
    [onKetemu],
  );

  // ── Izin kamera ─────────────────────────────────────────────────────
  if (izin == null) {
    return <View style={[styles.layar, { backgroundColor: colors.background }]} />;
  }
  if (!izin.granted) {
    return (
      <View style={[styles.layar, styles.tengah, { backgroundColor: colors.background }]}>
        <Text style={[styles.izinJudul, { color: colors.foreground }]}>Kamera belum diizinkan</Text>
        <Text style={[styles.izinIsi, { color: colors.mutedForeground }]}>
          Scan membaca QR/barcode yang tertempel di rumah pelanggan, lalu langsung membuka layar
          catat untuk nomor itu. Tanpa izin kamera, fitur ini tidak bisa bekerja.
        </Text>
        <Button onPress={() => void mintaIzin()} className={Kelas.tombol}>
          <UIText className={Kelas.tombolTeks}>Izinkan Kamera</UIText>
        </Button>
        <Button variant="outline" onPress={onTutup} className={Kelas.tombol}>
          <UIText className={Kelas.tombolTeks}>Kembali</UIText>
        </Button>
      </View>
    );
  }

  return (
    <View style={styles.layar}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={senter}
        barcodeScannerSettings={{ barcodeTypes: [...FORMAT] }}
        onBarcodeScanned={(hasil) => void terdeteksi(hasil)}
      />

      <View style={[styles.barAtas, { paddingTop: insets.top + Spasi.md }]}>
        <Tekan
          onPress={onTutup}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Tutup pemindai"
          style={({ pressed }) => pressed && styles.ditekan}
        >
          <X size={22} color="#FFFFFF" />
        </Tekan>
        <View style={styles.barTeks}>
          <Text style={styles.barJudul}>Scan Kode Pelanggan</Text>
          <Text style={styles.barSub}>Arahkan ke QR/barcode di rumah pelanggan</Text>
        </View>
        <Tekan
          onPress={() => setSenter((s) => !s)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={senter ? 'Matikan senter' : 'Nyalakan senter'}
          style={({ pressed }) => [styles.senter, pressed && styles.ditekan]}
        >
          {senter ? <ZapOff size={18} color="#FFFFFF" /> : <Zap size={18} color="#FFFFFF" />}
        </Tekan>
      </View>

      {/* K2 — empat sudut siku Emerald + garis pemindai, bukan kotak penuh. */}
      <View style={styles.target} pointerEvents="none">
        <View style={[styles.sudut, styles.sudutKiriAtas]} />
        <View style={[styles.sudut, styles.sudutKananAtas]} />
        <View style={[styles.sudut, styles.sudutKiriBawah]} />
        <View style={[styles.sudut, styles.sudutKananBawah]} />
        <View style={styles.garisPindai} />
      </View>

      <View style={[styles.kaki, { paddingBottom: insets.bottom + Spasi.xl }]}>
        {galat != null ? (
          <View style={styles.galat}>
            <Text style={styles.galatTeks}>{galat}</Text>
          </View>
        ) : (
          <Text style={styles.petunjuk}>
            Kode dicocokkan dengan rute yang tersimpan di perangkat — tidak butuh sinyal.
          </Text>
        )}
      </View>
    </View>
  );
}

const SISI = 230;
const SUDUT = 36;

const styles = StyleSheet.create({
  layar: { flex: 1, backgroundColor: '#000000' },
  tengah: { alignItems: 'center', justifyContent: 'center', gap: Spasi.lg, padding: Spasi.xl },
  izinJudul: { fontSize: 17, fontWeight: Berat.semi, textAlign: 'center' },
  izinIsi: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  ditekan: { opacity: 0.6 },

  barAtas: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spasi.lg,
    paddingBottom: Spasi.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    zIndex: 2,
  },
  barTeks: { flex: 1, minWidth: 0 },
  barJudul: { fontSize: 14, fontWeight: Berat.medium, color: '#FFFFFF' },
  barSub: { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  senter: {
    width: 40,
    height: 40,
    borderRadius: Radius.bundar,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  target: {
    position: 'absolute',
    left: '50%',
    top: '44%',
    width: SISI,
    height: SISI,
    marginLeft: -SISI / 2,
    marginTop: -SISI / 2,
    zIndex: 2,
  },
  sudut: { position: 'absolute', width: SUDUT, height: SUDUT, borderColor: P.emerald, borderWidth: 3 },
  sudutKiriAtas: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: Radius.kartu,
  },
  sudutKananAtas: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: Radius.kartu,
  },
  sudutKiriBawah: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: Radius.kartu,
  },
  sudutKananBawah: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: Radius.kartu,
  },
  garisPindai: {
    position: 'absolute',
    left: Spasi.md,
    right: Spasi.md,
    top: '50%',
    height: 2,
    backgroundColor: P.emerald400,
  },

  kaki: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spasi.xl,
    zIndex: 2,
  },
  petunjuk: {
    fontSize: 12.5,
    lineHeight: 18,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
  },
  galat: {
    backgroundColor: 'rgba(190,18,60,0.92)',
    borderRadius: Radius.kontrol,
    padding: Spasi.md,
  },
  galatTeks: { fontSize: 12.5, lineHeight: 18, color: '#FFFFFF', textAlign: 'center' },
});
