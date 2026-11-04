/**
 * antrean-rute-screen.tsx — isi antrean SATU rute, tempat petugas menandai
 * alamat mana yang ikut diunggah.
 *
 * Layar Upload sengaja hanya menampilkan rutenya. Satu rute bisa berisi
 * ratusan sambungan, dan menumpuk semuanya di satu daftar membuat halaman
 * pertama jadi gulungan panjang yang tidak menjawab pertanyaan pertama
 * petugas: rute mana yang belum beres. Penandaan per alamat adalah pekerjaan
 * yang lebih jarang dan lebih teliti, jadi ia mendapat layarnya sendiri.
 *
 * Centangnya disimpan di `PilihanUnggah` — di luar komponen — supaya hasil
 * penandaan sudah terbaca di layar Upload begitu tombol kembali ditekan.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronLeft, Inbox, Trash2 } from 'lucide-react-native';
import { labelPeriode } from '@workspace/mobile-core';
import {
  Berat,
  JANGKAUAN_SCAN,
  Spasi,
  Teks,
  UkuranIkon,
  useRuangDock,
  useTheme,
  Tekan,
} from '@/components';
import { DialogKonfirmasi } from '@/features/pencatat/components/DialogKonfirmasi';
import { IsiStrip, LayarGradasi, PADDING_ISI } from '@/features/pencatat/components/LayarGradasi';
import { hapusTertunda, ringkasTertunda } from './lib/RepositoryBacaMeter';
import { PilihanUnggah, usePilihanUnggah } from './lib/PilihanUnggah';
import { TANPA_RUTE } from './lib/RuteAntrean';
import type { RingkasAntrean } from './lib/DaoBacaMeter';

export function AntreanRuteScreen({
  kodeRute,
  onBack,
}: {
  /** Kode rute, atau TANPA_RUTE untuk baris yang tidak punya pasangan rute. */
  kodeRute: string;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const ruangDock = useRuangDock();
  const terpilih = usePilihanUnggah();
  const [semua, setSemua] = useState<RingkasAntrean[]>([]);
  const [memuat, setMemuat] = useState(true);
  const [akanDihapus, setAkanDihapus] = useState<RingkasAntrean | null>(null);

  const muat = useCallback(async () => {
    setMemuat(true);
    try {
      setSemua(await ringkasTertunda());
    } finally {
      setMemuat(false);
    }
  }, []);

  useEffect(() => {
    void muat();
  }, [muat]);

  const baris = useMemo(
    () => semua.filter((b) => (b.ruteKode ?? TANPA_RUTE) === kodeRute),
    [semua, kodeRute],
  );

  const idRute = useMemo(() => baris.map((b) => b.idAntrean), [baris]);
  const jumlahDitandai = idRute.filter((id) => terpilih.has(id)).length;
  const semuaDitandai = idRute.length > 0 && jumlahDitandai === idRute.length;

  const hapus = async (b: RingkasAntrean) => {
    setAkanDihapus(null);
    await hapusTertunda(b.idAntrean);
    await muat();
  };

  return (
    <LayarGradasi
      judul={kodeRute}
      subjudul="Tandai alamat yang ikut diunggah"
      kiri={
        <Tekan
          onPress={onBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Kembali"
          style={({ pressed }) => pressed && gaya.ditekan}
        >
          <ChevronLeft size={22} color="#FFFFFF" />
        </Tekan>
      }
      kanan={
        <Tekan
          onPress={() => PilihanUnggah.aturBanyak(idRute, !semuaDitandai)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={semuaDitandai ? 'Lepas semua tanda' : 'Tandai semua'}
          style={({ pressed }) => pressed && gaya.ditekan}
        >
          <Text style={gaya.aksiKanan}>{semuaDitandai ? 'Lepas semua' : 'Tandai semua'}</Text>
        </Tekan>
      }
      strip={
        <IsiStrip
          kiri={`${baris.length} laporan di rute ini`}
          kanan={jumlahDitandai > 0 ? `${jumlahDitandai} ditandai` : null}
        />
      }
      onSegarkan={() => void muat()}
      sedangMuat={memuat}
      gulir={baris.length === 0 && !memuat}
    >
      {baris.length === 0 && !memuat ? (
        <View style={gaya.kosong}>
          <Inbox size={40} color={colors.mutedForeground} />
          <Text style={[gaya.kosongTeks, { color: colors.mutedForeground }]}>
            Tidak ada laporan menunggu di rute ini.
          </Text>
        </View>
      ) : (
        <FlatList
          data={baris}
          keyExtractor={(b) => String(b.idAntrean)}
          contentContainerStyle={[
            gaya.daftar,
            { paddingBottom: JANGKAUAN_SCAN + Spasi.lg + ruangDock },
          ]}
          renderItem={({ item }) => (
            <Baris
              baris={item}
              ditandai={terpilih.has(item.idAntrean)}
              onAlih={() => PilihanUnggah.alih(item.idAntrean)}
              onHapus={() => setAkanDihapus(item)}
            />
          )}
        />
      )}

      <DialogKonfirmasi
        visible={akanDihapus != null}
        judul="Buang laporan ini?"
        deskripsi={
          akanDihapus != null
            ? `${akanDihapus.nama} (${akanDihapus.nomorLangganan}) akan dihapus dari antrean dan hasil catatnya hilang.`
            : ''
        }
        labelKonfirmasi="Buang"
        destruktif
        onKonfirmasi={() => {
          if (akanDihapus != null) void hapus(akanDihapus);
        }}
        onTutup={() => setAkanDihapus(null)}
      />
    </LayarGradasi>
  );
}

function Baris({
  baris,
  ditandai,
  onAlih,
  onHapus,
}: {
  baris: RingkasAntrean;
  ditandai: boolean;
  onAlih: () => void;
  onHapus: () => void;
}) {
  const { colors } = useTheme();
  const lengkap = baris.jumlahBerkas > 0 && baris.berkasTerunggah >= baris.jumlahBerkas;
  return (
    <Tekan
      onPress={onAlih}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: ditandai }}
      accessibilityLabel={baris.nama}
      style={({ pressed }) => [
        gaya.baris,
        {
          borderColor: ditandai ? colors.primary : colors.border,
          backgroundColor: ditandai ? colors.nadaHijauLatar : colors.permukaan,
        },
        pressed && gaya.ditekan,
      ]}
    >
      <View
        style={[
          gaya.kotak,
          {
            borderColor: ditandai ? colors.primary : colors.border,
            backgroundColor: ditandai ? colors.primary : 'transparent',
          },
        ]}
      >
        {ditandai ? <Check size={12} color={colors.primaryForeground} strokeWidth={3} /> : null}
      </View>

      <View style={gaya.isi}>
        <Text style={[gaya.nama, { color: colors.foreground }]} numberOfLines={1}>
          {baris.nama}
        </Text>
        <Text style={[gaya.meta, { color: colors.mutedForeground }]} numberOfLines={1}>
          {baris.nomorLangganan} · {labelPeriode(baris.periode)}
          {baris.jumlahBerkas > 0
            ? ` · berkas ${baris.berkasTerunggah}/${baris.jumlahBerkas}${lengkap ? ' siap' : ''}`
            : ' · tanpa berkas'}
        </Text>
        {baris.pesanGagal != null ? (
          <Text style={[gaya.gagal, { color: colors.destructive }]}>{baris.pesanGagal}</Text>
        ) : null}
      </View>

      <Tekan
        onPress={onHapus}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Buang ${baris.nama}`}
        style={({ pressed }) => pressed && gaya.ditekan}
      >
        <Trash2 size={UkuranIkon.kecil} color={colors.destructive} />
      </Tekan>
    </Tekan>
  );
}

const gaya = StyleSheet.create({
  aksiKanan: { color: '#FFFFFF', fontSize: Teks.xs, fontWeight: Berat.tebal },
  daftar: { paddingHorizontal: PADDING_ISI, paddingTop: Spasi.md },
  baris: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spasi.md,
    padding: Spasi.md,
    borderRadius: 14,
    // Tetap 1 di kedua keadaan — alasan yang sama seperti kartu rute.
    borderWidth: 1,
    marginBottom: Spasi.sm,
  },
  kotak: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  isi: { flex: 1, minWidth: 0 },
  nama: { fontSize: Teks.sm, fontWeight: Berat.tebal },
  meta: { fontSize: Teks.xs, marginTop: 2 },
  gagal: { fontSize: Teks.xs, marginTop: 4 },
  kosong: { alignItems: 'center', gap: Spasi.md, paddingVertical: Spasi.xxl },
  kosongTeks: { fontSize: Teks.sm, textAlign: 'center' },
  ditekan: { opacity: 0.6 },
});
